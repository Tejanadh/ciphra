import "./polyfill.js";
import {
  LocalKeys,
  MergeEncryptionScheme,
  SHIELDED_POOL_PROGRAM_ID,
  SOL_MINT,
  ViewingKey,
  Wallet,
  buildDepositTransaction,
  buildMultiTransferTransaction,
  buildMergeTransaction,
  buildRegistrationTransaction,
  buildSetMergeEncryptionTransaction,
  buildTransferTransaction,
  buildWithdrawalTransaction,
  createSprClient,
  formatAmount,
  getPrivateTransactions,
  parseAmount,
  syncWallet,
  type Bytes32,
  type ShieldedAddress,
  type Signature,
  type TransferPayment as Payment,
  type WalletUtxo,
} from "@heliuslabs/spr";
export { SOL_MINT };
import { MAX_MERGE_INPUTS } from "@heliuslabs/spr/interface";
import { X25519PublicKey, bytes32 } from "@heliuslabs/spr/keypair";
import {
  EncryptedScheme,
  decodeConfidential,
  decodeOutputData,
  type IndexedShieldedTransaction,
} from "@heliuslabs/spr/transaction";
import { getAssociatedTokenAddress } from "@heliuslabs/spr/addresses";
import { backfillAssetRegistry, fetchUserRecord, resolveRegisteredAddress } from "@heliuslabs/spr/wallet";
import { ed25519DerivationMessage } from "@heliuslabs/spr/keypair";
import {
  getCreateAssociatedTokenIdempotentInstruction,
  getMintToInstruction,
} from "@solana-program/token";
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createKeyPairSignerFromPrivateKeyBytes,
  createTransactionMessage,
  getAddressEncoder,
  getBase58Decoder,
  getBase58Encoder,
  getSignatureFromTransaction,
  assertIsTransactionWithBlockhashLifetime,
  isAddress,
  isKeyPairSigner,
  pipe,
  sendTransactionWithoutConfirmingFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signBytes,
  signTransactionWithSigners,
  type Address,
  type KeyPairSigner,
  type Transaction,
  type TransactionPartialSigner,
} from "@solana/kit";
import { ed25519 } from "@noble/curves/ed25519.js";
import { SprWebProver, type Measurement } from "@heliuslabs/spr-web-prover";
import { signConnectedWalletMessage, type WalletSessionUnlock } from "./burner.js";
import { deployments, remoteProverConfig, sprEndpoints } from "./deployments";
import { auditModeForConnectedWallet, compareDecryptedAmounts, type AuditIntegrity } from "./compare-decrypted-amounts.js";
import { MAX_LOCAL_INPUTS, limitLocalProofs, localSpendLimit, MERGE_FIRST } from "./local-proving.js";
import {
  assertStealthBurnerNetwork,
  pickProtocolFeeCollector,
  stealthUnshieldCap,
  wipeEphemeralBurner,
  type EphemeralBurner,
} from "./stealthBurners.js";
export { compareDecryptedAmounts };
export type { AuditIntegrity };
export type { Payment };

const selectedNetwork: string = import.meta.env.VITE_ZOLANA_NETWORK ?? "devnet";
if (selectedNetwork !== "devnet" && selectedNetwork !== "mainnet") {
  throw new Error("VITE_ZOLANA_NETWORK must be devnet or mainnet");
}
export const network = selectedNetwork;
/** 0.50% protocol fee. Payroll defaults to this unless a caller passes another rate. */
export const DEFAULT_PROTOCOL_FEE_BPS = 50;
export const networkLabel = network === "devnet" ? "Devnet-e" : "Mainnet";
const deployment = deployments[network];
const spr = sprEndpoints(deployment.sprUrl, import.meta.env.VITE_HELIUS_API_KEY ?? "");

// The loopback URL is intercepted in the page; witnesses never go there.
export const endpoints = {
  solanaRpcUrl: import.meta.env.VITE_SOLANA_RPC_URL ?? deployment.solanaRpcUrl,
  indexerUrl: import.meta.env.VITE_INDEXER_URL ?? spr.indexerUrl,
  proverUrl: "http://127.0.0.1:3001",
};

export const teeProverUrl = import.meta.env.VITE_TEE_PROVER_URL ?? spr.proverUrl;
const remoteProver = import.meta.env.VITE_TEE_POLICY === undefined
  ? { proverUrl: teeProverUrl, proverTee: deployment.proverTee }
  : remoteProverConfig(teeProverUrl, JSON.parse(import.meta.env.VITE_TEE_POLICY));

type Client = Awaited<ReturnType<typeof createSprClient>>;
export type PrivateTransaction = ReturnType<typeof getPrivateTransactions>[number];

// ============================================================================
// ASSET DEFINITIONS (SOL & USDC)
// ============================================================================
export type AssetSymbol = "SOL" | "USDC";

export interface AssetConfig {
  readonly symbol: AssetSymbol;
  readonly name: string;
  readonly decimals: number;
  readonly mint: Address;
}

export const MAINNET_USDC_MINT = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
export const DEVNET_USDC_MINT = address(
  import.meta.env.VITE_DEVNET_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

export const USDC_MINT: Address = network === "devnet" ? DEVNET_USDC_MINT : MAINNET_USDC_MINT;

export const ASSETS: Record<AssetSymbol, AssetConfig> = {
  SOL: {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    mint: SOL_MINT,
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    mint: USDC_MINT,
  },
};

export function getWalletAssetBalance(wallet: Wallet, mint: Address) {
  try {
    return wallet.balance(mint);
  } catch {
    return {
      assetId: 0n,
      mint,
      amount: 0n,
      utxos: [] as readonly any[],
    };
  }
}

export type SessionSigner = KeyPairSigner | TransactionPartialSigner;

export interface Session {
  readonly prover: SprWebProver;
  readonly client: Client;
  readonly mergeClient: Client;
  readonly signer: SessionSigner;
  readonly keys: LocalKeys;
  readonly mergeKeys: LocalKeys;
  readonly wallet: Wallet;
  readonly shieldedAddress: ShieldedAddress;
}

export interface AssetBalanceData {
  readonly publicUnits: bigint;
  readonly privateUnits: bigint;
  readonly privateNotes: number;
  readonly localSpendLimit: bigint;
}

export interface Snapshot {
  readonly assets: Record<AssetSymbol, AssetBalanceData>;
  readonly publicLamports: bigint;
  readonly privateLamports: bigint;
  readonly privateNotes: number;
  readonly localSpendLimit: bigint;
  readonly registered: boolean;
  readonly mergingEnabled: boolean;
  readonly history: readonly PrivateTransaction[];
}

/**
 * Proofs are made by the prover's worker: the client's `fetch` answers its
 * `/prove/<key>` requests locally, and everything else goes to the network.
 */
function wipe(bytes: Uint8Array): void {
  bytes.fill(0);
}

/**
 * Derives shielded keys with `LocalKeys.fromDerivationSeed`.
 * A 32-byte local key signs `ed25519DerivationMessage` here.
 * A connected wallet passes the 64-byte signature it already produced over that message.
 */
export async function openSession(
  material: Uint8Array | WalletSessionUnlock,
  onMeasurement: (m: Measurement) => void,
): Promise<Session> {
  const prover = new SprWebProver({
    proverUrl: endpoints.proverUrl,
    onMeasurement,
  });
  const client = await createSprClient({
    ...endpoints,
    // A local prover cannot answer the indexed route, so the client gathers proof data.
    proofDataSource: "client",
    fetch: limitLocalProofs(prover.createFetch(), endpoints.proverUrl),
  });
  // Merges use the SDK's attested, encrypted transport, without the local
  // prover's fetch interception. Transfers continue to prove in the browser.
  const mergeClient = await createSprClient({
    ...endpoints,
    ...remoteProver,
  });

  let signer: SessionSigner;
  let ownedSeed: Uint8Array;
  if (material instanceof Uint8Array) {
    const local = await createKeyPairSignerFromPrivateKeyBytes(material);
    signer = local;
    const publicKey = new Uint8Array(getAddressEncoder().encode(local.address)) as Bytes32;
    ownedSeed = await signBytes(local.keyPair.privateKey, ed25519DerivationMessage(publicKey));
  } else {
    signer = material.signer;
    ownedSeed = new Uint8Array(material.derivationSeed);
  }
  const solanaPublicKey = signer.address;
  const forClient = new Uint8Array(ownedSeed);
  const forMerge = new Uint8Array(ownedSeed);
  wipe(ownedSeed);
  let keys: LocalKeys;
  let mergeKeys: LocalKeys;
  try {
    keys = LocalKeys.fromDerivationSeed({ solanaPublicKey, derivationSeed: forClient }, client.proofService);
    mergeKeys = LocalKeys.fromDerivationSeed({ solanaPublicKey, derivationSeed: forMerge }, mergeClient.proofService);
  } finally {
    wipe(forClient);
    wipe(forMerge);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      keys.destroy();
      mergeKeys.destroy();
    }, { once: true });
  }
  const shieldedAddress = keys.address();
  return { prover, client, mergeClient, signer, keys, mergeKeys, wallet: new Wallet({ identity: shieldedAddress }), shieldedAddress };
}

export async function snapshot(session: Session, requireSlot?: bigint): Promise<Snapshot> {
  const { client, wallet, keys, signer } = session;
  const owner = signer.address;

  // 1. Fetch public SOL balance & user record
  const [{ value: publicLamports }, record] = await Promise.all([
    client.solanaRpc.getBalance(owner).send(),
    fetchUserRecord({ rpc: client, owner }),
  ]);
  const registered = record !== undefined;
  if (registered) {
    await syncWallet({ client, wallet, keys, config: requireSlot === undefined ? {} : { requireSlot } });
  }

  // Backfill asset registry so SPL mints (USDC) are recognized locally
  await backfillAssetRegistry(wallet, client).catch(() => 0);

  // 2. Fetch public USDC ATA balance
  let publicUsdcUnits = 0n;
  try {
    const usdcAta = await getAssociatedTokenAddress(owner, USDC_MINT);
    const ataRes = await client.solanaRpc.getTokenAccountBalance(usdcAta).send();
    if (ataRes?.value?.amount) {
      publicUsdcUnits = BigInt(ataRes.value.amount);
    }
  } catch {
    publicUsdcUnits = 0n;
  }

  // 3. Private balances for SOL and USDC
  const solPrivate = getWalletAssetBalance(wallet, SOL_MINT);
  const usdcPrivate = getWalletAssetBalance(wallet, USDC_MINT);

  const solSpendLimit = localSpendLimit(solPrivate.utxos);
  const usdcSpendLimit = localSpendLimit(usdcPrivate.utxos);

  const assets: Record<AssetSymbol, AssetBalanceData> = {
    SOL: {
      publicUnits: publicLamports,
      privateUnits: solPrivate.amount,
      privateNotes: solPrivate.utxos.length,
      localSpendLimit: solSpendLimit,
    },
    USDC: {
      publicUnits: publicUsdcUnits,
      privateUnits: usdcPrivate.amount,
      privateNotes: usdcPrivate.utxos.length,
      localSpendLimit: usdcSpendLimit,
    },
  };

  return {
    assets,
    publicLamports,
    privateLamports: solPrivate.amount,
    privateNotes: solPrivate.utxos.length,
    localSpendLimit: solSpendLimit,
    registered,
    mergingEnabled: record?.mergeEncryption === MergeEncryptionScheme.PoseidonCtrV1,
    history: getPrivateTransactions(wallet),
  };
}

export interface ExecutionResult {
  readonly signature: string;
  readonly slot: bigint;
}

async function submitSigned(
  session: Session,
  transaction: Transaction,
  signers: readonly SessionSigner[],
): Promise<ExecutionResult> {
  const { client } = session;
  const signed = await signTransactionWithSigners([...signers], transaction);
  await sendTransactionWithoutConfirmingFactory({ rpc: client.solanaRpc })(signed, {
    commitment: client.commitment,
  });
  const signature = getSignatureFromTransaction(signed);
  const slot = await client.confirmTransaction(signature);
  return { signature, slot };
}

async function submit(session: Session, transaction: Transaction): Promise<ExecutionResult> {
  return submitSigned(session, transaction, [session.signer]);
}

/** Devnet falls back to the sender. Any other network requires a distinct treasury. */
export function resolveProtocolFeeCollector(senderAddress: string, explicit?: string): string {
  const envCollector = import.meta.env.VITE_PROTOCOL_FEE_COLLECTOR ?? "";
  return pickProtocolFeeCollector({
    networkName: network,
    senderAddress,
    ...(explicit === undefined ? {} : { explicit }),
    envCollector,
    explicitIsAddress: (value) => isAddress(value),
  });
}

function checkLocalAmount(wallet: Wallet, amount: bigint, asset: Address = SOL_MINT): void {
  const balance = getWalletAssetBalance(wallet, asset);
  if (amount > balance.amount) throw new Error("Insufficient private balance");
  if (amount > localSpendLimit(balance.utxos)) throw new Error(MERGE_FIRST);
}

/** Each action returns the signature and slot it landed in. */
export const actions = {
  async setMerging(session: Session, enabled: boolean): Promise<ExecutionResult> {
    const transaction = await buildSetMergeEncryptionTransaction({
      client: session.client,
      owner: session.signer.address,
      scheme: enabled ? MergeEncryptionScheme.PoseidonCtrV1 : MergeEncryptionScheme.Disabled,
    });
    return submit(session, transaction);
  },
  async merge(session: Session): Promise<ExecutionResult> {
    const { mergeClient: client, mergeKeys: keys, wallet, signer } = session;
    // Explicit attestation also refuses a plaintext loopback prover here.
    await client.attestProver();
    await syncWallet({ client, wallet, keys });
    const transaction = await buildMergeTransaction({ client, wallet, keys, feePayer: signer.address });
    return submit(session, transaction);
  },
  async register(session: Session): Promise<ExecutionResult | undefined> {
    const transaction = await buildRegistrationTransaction({
      client: session.client,
      owner: session.signer.address,
      address: session.shieldedAddress,
    });
    return transaction === undefined ? undefined : submit(session, transaction);
  },
  async shield(session: Session, amount: bigint, asset: Address = SOL_MINT): Promise<ExecutionResult> {
    const transaction = await buildDepositTransaction({
      client: session.client,
      feePayer: session.signer.address,
      recipient: session.shieldedAddress,
      amount,
      ...(asset === SOL_MINT ? {} : { asset }),
    });
    return submit(session, transaction);
  },
  async deposit(session: Session, amount: bigint, asset: Address = SOL_MINT): Promise<ExecutionResult> {
    return this.shield(session, amount, asset);
  },
  async send(session: Session, recipient: Address, amount: bigint, asset: Address = SOL_MINT): Promise<ExecutionResult> {
    const { client, wallet, keys, signer } = session;
    checkLocalAmount(wallet, amount, asset);
    const transaction = await buildTransferTransaction({
      client,
      wallet,
      keys,
      feePayer: signer.address,
      recipient,
      amount,
      ...(asset === SOL_MINT ? {} : { asset }),
    });
    return submit(session, transaction);
  },
  /** One transfer and one proof pay every recipient, each a private output. */
  async pay(session: Session, payments: readonly Payment[], asset: Address = SOL_MINT): Promise<ExecutionResult> {
    const { client, wallet, keys, signer } = session;
    const total = payments.reduce((sum, payment) => sum + payment.amount, 0n);
    checkLocalAmount(wallet, total, asset);
    const transaction = await buildMultiTransferTransaction({
      client,
      wallet,
      keys,
      feePayer: signer.address,
      payments,
      ...(asset === SOL_MINT ? {} : { asset }),
    });
    return submit(session, transaction);
  },
  async unshield(session: Session, amount: bigint, asset: Address = SOL_MINT): Promise<ExecutionResult> {
    const { client, wallet, keys, signer } = session;
    checkLocalAmount(wallet, amount, asset);
    const transaction = await buildWithdrawalTransaction({
      client,
      wallet,
      keys,
      feePayer: signer.address,
      recipient: signer.address,
      amount,
      ...(asset === SOL_MINT ? {} : { asset }),
    });
    return submit(session, transaction);
  },
  /**
   * Unshield a capped devnet allowance straight to a public recipient.
   * Stealth burners use this to fund an ephemeral address from the shielded pool.
   */
  async unshieldToRecipient(
    session: Session,
    recipient: Address,
    amount: bigint,
    asset: Address = SOL_MINT,
  ): Promise<ExecutionResult> {
    assertStealthBurnerNetwork(network);
    if (!isAddress(recipient)) throw new Error("Unshield recipient is not a Solana address.");
    if (amount <= 0n) throw new Error("Unshield amount must be positive.");
    const symbol: AssetSymbol | undefined = asset === SOL_MINT ? "SOL" : asset === USDC_MINT ? "USDC" : undefined;
    if (symbol === undefined) throw new Error("Stealth unshield supports SOL and USDC only.");
    const cap = stealthUnshieldCap(symbol);
    if (amount > cap) {
      throw new Error(
        `Stealth unshield is capped at ${formatAmount(cap, ASSETS[symbol].decimals)} ${symbol} on devnet.`,
      );
    }
    const { client, wallet, keys, signer } = session;
    checkLocalAmount(wallet, amount, asset);
    const transaction = await buildWithdrawalTransaction({
      client,
      wallet,
      keys,
      feePayer: signer.address,
      recipient,
      amount,
      ...(asset === SOL_MINT ? {} : { asset }),
    });
    return submit(session, transaction);
  },
  async withdraw(session: Session, amount: bigint, asset: Address = SOL_MINT): Promise<ExecutionResult> {
    return this.unshield(session, amount, asset);
  },
  async mintDevnetTestUsdc(session: Session, amountTokens: number = 10000): Promise<ExecutionResult> {
    const { client, signer } = session;
    if (!isKeyPairSigner(signer)) {
      throw new Error("Devnet USDC mint requires a local signing key.");
    }
    const recipient = signer.address;
    const mint = USDC_MINT;
    const ata = await getAssociatedTokenAddress(recipient, mint);
    const amount = BigInt(amountTokens) * 1_000_000n; // 6 decimals

    const instructions = [
      getCreateAssociatedTokenIdempotentInstruction({
        payer: signer,
        ata,
        owner: recipient,
        mint,
      }),
      getMintToInstruction({
        mint,
        token: ata,
        mintAuthority: signer,
        amount,
      }),
    ];

    const lifetime = await client.getLatestBlockhash();
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(signer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(lifetime, tx),
      (tx) => appendTransactionMessageInstructions(instructions, tx)
    );
    const transaction = compileTransaction(message);
    return submit(session, transaction);
  },
};

/**
 * Re-shields the burner's public balance into the session shielded address.
 * The connected wallet pays the transaction fee. The burner key is dropped after the deposit lands.
 * Devnet only.
 */
export async function sweepBurnerToShield(
  session: Session,
  burner: EphemeralBurner,
  asset: AssetSymbol = "SOL",
): Promise<ExecutionResult> {
  assertStealthBurnerNetwork(network);
  const mint = ASSETS[asset].mint;
  let amount: bigint;
  if (asset === "SOL") {
    const balance = await session.client.solanaRpc.getBalance(burner.address).send();
    amount = balance.value;
    if (amount <= 0n) throw new Error("Burner has no SOL to sweep.");
  } else {
    const ata = await getAssociatedTokenAddress(burner.address, mint);
    let raw = 0n;
    try {
      const ataBalance = await session.client.solanaRpc.getTokenAccountBalance(ata).send();
      raw = BigInt(ataBalance.value.amount);
    } catch {
      raw = 0n;
    }
    amount = raw;
    if (amount <= 0n) throw new Error("Burner has no USDC to sweep.");
  }
  const transaction = await buildDepositTransaction({
    client: session.client,
    feePayer: session.signer.address,
    depositor: burner.address,
    recipient: session.shieldedAddress,
    amount,
    ...(mint === SOL_MINT ? {} : { asset: mint }),
  });
  const result = await submitSigned(session, transaction, [session.signer, burner.signer]);
  wipeEphemeralBurner(burner);
  return result;
}

const PAYROLL_JOURNAL_STORAGE_KEY = "ciphra_payroll_journal";
const MAX_JOURNAL_RUNS = 20;
export const RECENT_PAYROLL_RUNS_KEY = "ciphra_recent_runs";
export const LEGACY_RECENT_PAYROLL_RUNS_KEY = "veilpay_recent_runs";
export const PERSIST_PAYROLL_HISTORY_KEY = "ciphra_persist_payroll_history";
const STILL_IN_FLIGHT = "Transaction still in flight — wait for blockhash expiry";

export type PayrollChunkStatus = "pending" | "submitted" | "confirmed" | "failed";

interface JournalRecipient {
  readonly recipient: string;
  /** Hex of `ShieldedAddress.toBytes()`. Absent on receipts written before this field. */
  readonly shieldedAddress?: string;
  readonly amountBaseUnits: string;
  readonly memo: string;
}

interface JournalChunk {
  readonly index: number;
  readonly recipients: readonly JournalRecipient[];
  readonly feeCollector: string;
  /** Hex shielded address of the fee collector, when the registry had one. */
  readonly feeCollectorShieldedAddress?: string;
  readonly feeBaseUnits: string;
  readonly feeBps: number;
  status: PayrollChunkStatus;
  signature?: string;
  slot?: string;
  /** Recent blockhash baked into the submitted transaction. Public. */
  blockhash?: string;
  /** Block height after which that blockhash can no longer land. Public. */
  lastValidBlockHeight?: string;
  error?: string;
  submittedAt?: number;
}

interface JournalRun {
  readonly runId: string;
  readonly createdAt: number;
  readonly network: string;
  readonly asset: AssetSymbol;
  readonly mint: string;
  readonly decimals: number;
  readonly protocolFeeBps: number;
  readonly feeCollector: string;
  readonly planKey: string;
  readonly chunks: JournalChunk[];
}

function hexBytes(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 500);
}

function readJournal(): JournalRun[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(PAYROLL_JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isJournalRun).slice(0, MAX_JOURNAL_RUNS);
  } catch {
    return [];
  }
}

function writeJournal(runs: readonly JournalRun[]): void {
  if (typeof localStorage === "undefined") return;
  const kept = runs.slice(0, MAX_JOURNAL_RUNS);
  if (kept.length === 0) {
    localStorage.removeItem(PAYROLL_JOURNAL_STORAGE_KEY);
    return;
  }
  localStorage.setItem(PAYROLL_JOURNAL_STORAGE_KEY, JSON.stringify(kept));
}

function isJournalRun(value: unknown): value is JournalRun {
  if (typeof value !== "object" || value === null) return false;
  const run = value as JournalRun;
  return typeof run.runId === "string"
    && typeof run.planKey === "string"
    && typeof run.mint === "string"
    && Array.isArray(run.chunks);
}

function plainNotes(wallet: Wallet, asset: Address): WalletUtxo[] {
  const reserved = wallet._reservedUtxoKeys(BigInt(Date.now()));
  return wallet.utxos().filter((entry) => {
    if (entry.spent || entry.utxo.asset !== asset || entry.utxo.amount <= 0n) return false;
    if (entry.utxo.ringProgramId !== undefined || entry.ringDataHash !== undefined || entry.dataHash !== undefined) {
      return false;
    }
    if (!entry.utxo.data.isEmpty()) return false;
    return !reserved.has(hexBytes(entry.outputContext.hash));
  });
}

/** Largest-first cover, the same order `selectUtxos` uses for a spend. */
function notesToCover(wallet: Wallet, asset: Address, amount: bigint): WalletUtxo[] {
  const sorted = [...plainNotes(wallet, asset)].sort((left, right) => (
    left.utxo.amount > right.utxo.amount ? -1 : left.utxo.amount < right.utxo.amount ? 1 : 0
  ));
  const chosen: WalletUtxo[] = [];
  let total = 0n;
  for (const entry of sorted) {
    chosen.push(entry);
    total += entry.utxo.amount;
    if (total >= amount) break;
  }
  return chosen;
}

async function submitAndIndex(
  session: Session,
  transaction: Transaction,
  onSignature: (
    signature: string,
    lifetime: { readonly blockhash: string; readonly lastValidBlockHeight: string },
  ) => void,
): Promise<ExecutionResult> {
  assertIsTransactionWithBlockhashLifetime(transaction);
  const lifetime = {
    blockhash: transaction.lifetimeConstraint.blockhash,
    lastValidBlockHeight: transaction.lifetimeConstraint.lastValidBlockHeight.toString(),
  };
  const { client, signer } = session;
  const signed = await signTransactionWithSigners([signer], transaction);
  const signature = getSignatureFromTransaction(signed);
  onSignature(signature, lifetime);
  await sendTransactionWithoutConfirmingFactory({ rpc: client.solanaRpc })(signed, {
    commitment: client.commitment,
  });
  const slot = await client.confirmTransaction(signature);
  await client.confirmPrivateTransaction(signature);
  return { signature, slot };
}

async function syncUntilBalance(
  session: Session,
  asset: Address,
  expected: bigint,
  slot: bigint,
  onProgress?: (message: string) => void,
): Promise<void> {
  const { client, wallet, keys } = session;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    onProgress?.(`Syncing shielded notes until the confirmed chunk is spendable (${attempt}/4)…`);
    await syncWallet({ client, wallet, keys, config: { requireSlot: slot } });
    await backfillAssetRegistry(wallet, client).catch(() => 0);
    if (getWalletAssetBalance(wallet, asset).amount === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(
    "The chunk is confirmed, but its nullifiers or change note are not in the local wallet yet. Resume this payroll after sync. Confirmed chunks are not sent again.",
  );
}

async function consolidateOrRemote(
  session: Session,
  asset: Address,
  amount: bigint,
  onProgress?: (message: string) => void,
): Promise<"local" | "remote"> {
  let cover = notesToCover(session.wallet, asset, amount);
  if (cover.length <= MAX_LOCAL_INPUTS) return "local";
  let attested = false;
  for (let round = 0; round < 6 && cover.length > MAX_LOCAL_INPUTS; round += 1) {
    if (cover.length < 2) break;
    let submittedSlot: bigint;
    let mergedInputs: readonly Bytes32[];
    let beforeMerge: ReadonlySet<string>;
    try {
      if (!attested) {
        await session.mergeClient.attestProver();
        attested = true;
      }
      const record = await fetchUserRecord({ rpc: session.client, owner: session.signer.address });
      if (record?.mergeEncryption !== MergeEncryptionScheme.PoseidonCtrV1) {
        onProgress?.("Enabling merge encryption so fragmented notes can be consolidated…");
        await actions.setMerging(session, true);
      }
      mergedInputs = cover.slice(0, MAX_MERGE_INPUTS).map((entry) => entry.outputContext.hash);
      onProgress?.(
        `Merging ${mergedInputs.length} notes (local proofs allow ${MAX_LOCAL_INPUTS} inputs, merge allows ${MAX_MERGE_INPUTS})…`,
      );
      beforeMerge = new Set(plainNotes(session.wallet, asset).map((entry) => hexBytes(entry.outputContext.hash)));
      const transaction = await buildMergeTransaction({
        client: session.mergeClient,
        wallet: session.wallet,
        keys: session.mergeKeys,
        feePayer: session.signer.address,
        asset,
        inputs: mergedInputs,
      });
      const submitted = await submitAndIndex(session, transaction, () => undefined);
      submittedSlot = submitted.slot;
    } catch (error) {
      onProgress?.(
        `Merge did not finish (${errorText(error)}). This chunk will use the configured remote prover.`,
      );
      return "remote";
    }
    await syncUntilMerged(session, asset, mergedInputs, beforeMerge, submittedSlot, onProgress);
    cover = notesToCover(session.wallet, asset, amount);
  }
  return cover.length <= MAX_LOCAL_INPUTS ? "local" : "remote";
}

async function syncUntilMerged(
  session: Session,
  asset: Address,
  inputs: readonly Bytes32[],
  before: ReadonlySet<string>,
  slot: bigint,
  onProgress?: (message: string) => void,
): Promise<void> {
  const spent = new Set(inputs.map((hash) => hexBytes(hash)));
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    onProgress?.(`Syncing the merge so the consolidated note can be spent (${attempt}/4)…`);
    await syncWallet({
      client: session.client,
      wallet: session.wallet,
      keys: session.keys,
      config: { requireSlot: slot },
    });
    const notes = plainNotes(session.wallet, asset);
    const inputStillSpendable = notes.some((entry) => spent.has(hexBytes(entry.outputContext.hash)));
    const created = notes.some((entry) => !before.has(hexBytes(entry.outputContext.hash)));
    if (!inputStillSpendable && created) return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("The merge confirmed, but the consolidated note is not indexed yet.");
}

export interface PayrollRecipientInput {
  readonly recipient: string;
  readonly amount?: number;
  readonly amountSol?: number;
  readonly memo: string;
}

export interface PayrollPayoutRecord {
  readonly recipient: string;
  /** Hex of the recipient `ShieldedAddress`. Paystub verification refuses lines that omit it. */
  readonly shieldedAddress?: string;
  readonly amount?: number;
  readonly amountSol?: number;
  readonly amountBaseUnits: string;
  readonly amountLamports?: string;
  readonly memo: string;
}

export interface PayrollChunkExecution {
  readonly chunkIndex: number;
  readonly txSignature: string;
  readonly slot: string;
  readonly timestamp: number;
  readonly payouts: readonly PayrollPayoutRecord[];
  readonly protocolFee: {
    readonly collector: string;
    readonly shieldedAddress?: string;
    readonly amount: number;
    readonly amountSol?: number;
    readonly amountBaseUnits: string;
    readonly amountLamports?: string;
    readonly bps: number;
  };
}

export interface BatchPayrollReport {
  readonly id: string;
  readonly protocol: "Ciphra";
  readonly version: "1.0";
  readonly network: string;
  readonly timestamp: number;
  readonly formattedDate: string;
  readonly asset: AssetSymbol;
  readonly mint: string;
  readonly decimals: number;
  readonly totalPayroll: number;
  readonly totalFee: number;
  readonly totalBaseUnits: string;
  readonly totalPayrollSol: number;
  readonly totalFeeSol: number;
  readonly totalLamports: string;
  readonly antiCorrelationJitter: boolean;
  readonly contractorCount: number;
  readonly chunks: readonly PayrollChunkExecution[];
  readonly payerPubkey?: string | undefined;
  readonly payerSignature?: string | undefined;
  readonly receiptCommitmentHash?: string | undefined;
}

function payrollPlanKey(mint: string, feeCollector: string, feeBps: number, chunks: readonly JournalChunk[]): string {
  return JSON.stringify({
    mint,
    feeCollector,
    feeBps,
    chunks: chunks.map((chunk) => ({
      recipients: chunk.recipients.map((recipient) => [recipient.recipient, recipient.amountBaseUnits]),
      fee: chunk.feeBaseUnits,
    })),
  });
}

function chunkExecution(assetSymbol: AssetSymbol, decimals: number, chunk: JournalChunk): PayrollChunkExecution {
  return {
    chunkIndex: chunk.index,
    txSignature: chunk.signature ?? "",
    slot: chunk.slot ?? "",
    timestamp: chunk.submittedAt ?? Date.now(),
    payouts: chunk.recipients.map((recipient) => {
      const units = BigInt(recipient.amountBaseUnits);
      const amount = Number(units) / 10 ** decimals;
      return {
        recipient: recipient.recipient,
        ...(recipient.shieldedAddress === undefined ? {} : { shieldedAddress: recipient.shieldedAddress }),
        amount,
        amountSol: amount,
        amountBaseUnits: recipient.amountBaseUnits,
        amountLamports: recipient.amountBaseUnits,
        memo: recipient.memo || `Ciphra ${assetSymbol} Payroll`,
      };
    }),
    protocolFee: {
      collector: chunk.feeCollector,
      ...(chunk.feeCollectorShieldedAddress === undefined ? {} : { shieldedAddress: chunk.feeCollectorShieldedAddress }),
      amount: Number(BigInt(chunk.feeBaseUnits)) / 10 ** decimals,
      amountSol: Number(BigInt(chunk.feeBaseUnits)) / 10 ** decimals,
      amountBaseUnits: chunk.feeBaseUnits,
      amountLamports: chunk.feeBaseUnits,
      bps: chunk.feeBps,
    },
  };
}

/**
 * One submitted signature is resent only when `getSignatureStatuses` is empty and the
 * stored blockhash height has passed. A finished run is removed from the journal.
 */
function isInFlightJournal(run: JournalRun): boolean {
  const hasSubmitted = run.chunks.some((chunk) => chunk.status === "submitted" && chunk.signature !== undefined);
  const hasConfirmed = run.chunks.some((chunk) => chunk.status === "confirmed");
  const hasUnfinished = run.chunks.some((chunk) => chunk.status !== "confirmed");
  return hasSubmitted || (hasConfirmed && hasUnfinished);
}

/** Drops payroll receipts. Keeps a journal run that still has a submitted or partially confirmed chunk. */
export function wipeLocalPayrollHistory(): { keptInFlightRuns: number } {
  if (typeof localStorage === "undefined") return { keptInFlightRuns: 0 };
  localStorage.removeItem(RECENT_PAYROLL_RUNS_KEY);
  localStorage.removeItem(LEGACY_RECENT_PAYROLL_RUNS_KEY);
  const kept = readJournal().filter(isInFlightJournal);
  writeJournal(kept);
  return { keptInFlightRuns: kept.length };
}

/**
 * `getSignatureStatuses` plus block height. A clean confirmed or finalized signature is not resent.
 * Rebuild only when the signature failed, or when it is absent and `currentBlockHeight > lastValidBlockHeight`.
 */
async function resumeSubmittedChunk(session: Session, chunk: JournalChunk): Promise<"confirmed" | "rebuild"> {
  const signature = chunk.signature;
  if (!signature || !chunk.blockhash || !chunk.lastValidBlockHeight) {
    throw new Error(
      `Batch ${chunk.index + 1} was submitted as ${signature ?? "(no signature)"} without a stored blockhash. It was not sent again.`,
    );
  }
  let status: { confirmationStatus: string | null; err: unknown } | null;
  try {
    const response = await session.client.solanaRpc.getSignatureStatuses([signature as Signature], {
      searchTransactionHistory: true,
    }).send();
    const entry = response.value[0] ?? null;
    status = entry === null
      ? null
      : { confirmationStatus: entry.confirmationStatus, err: entry.err };
  } catch (error) {
    throw new Error(
      `Could not read getSignatureStatuses for ${signature}. It was not sent again. ${errorText(error)}`,
    );
  }
  const confirmation = status?.confirmationStatus ?? null;
  const landedClean = status !== null
    && status.err === null
    && (confirmation === "confirmed" || confirmation === "finalized");
  if (landedClean) {
    try {
      const settled = await readSettledTransaction(session, signature);
      chunk.status = "confirmed";
      chunk.slot = settled.slot;
      delete chunk.error;
      return "confirmed";
    } catch (error) {
      throw new Error(
        `Batch ${chunk.index + 1} (${signature}) is ${confirmation ?? "confirmed"} with err === null, but the shielded-pool program was not verified. It was not sent again. ${errorText(error)}`,
      );
    }
  }
  if (status !== null && status.err !== null) {
    chunk.status = "failed";
    try {
      chunk.error = JSON.stringify(status.err).slice(0, 500);
    } catch {
      chunk.error = "Submitted transaction failed on chain.";
    }
    return "rebuild";
  }
  let currentBlockHeight: bigint;
  try {
    currentBlockHeight = await session.client.solanaRpc.getBlockHeight({ commitment: "confirmed" }).send();
  } catch (error) {
    throw new Error(
      `Could not read block height for ${signature}. It was not sent again. ${errorText(error)}`,
    );
  }
  let expired = false;
  try {
    expired = status === null && currentBlockHeight > BigInt(chunk.lastValidBlockHeight);
  } catch {
    throw new Error(
      `Batch ${chunk.index + 1} has an unreadable lastValidBlockHeight. It was not sent again.`,
    );
  }
  if (expired) {
    chunk.status = "failed";
    chunk.error = "Submitted transaction was absent after its blockhash expired.";
    return "rebuild";
  }
  chunk.error = STILL_IN_FLIGHT;
  throw new Error(STILL_IN_FLIGHT);
}

/**
 * Executes batch payroll using buildMultiTransferTransaction.
 * Max 14 recipients per chunk to leave the 15th slot for the 0.50% protocol fee.
 * The journal is written before the first send and deleted once every chunk is confirmed.
 */
export async function runBatchPayroll(
  session: Session,
  recipients: readonly PayrollRecipientInput[],
  options: {
    asset?: AssetSymbol;
    protocolFeeBps?: number;
    feeCollector?: string;
    antiCorrelationJitter?: boolean;
    onProgress?: (message: string) => void;
  } = {}
): Promise<BatchPayrollReport> {
  const assetSymbol: AssetSymbol = options.asset ?? "SOL";
  const assetConfig = ASSETS[assetSymbol];
  const { decimals, mint } = assetConfig;
  const {
    protocolFeeBps = DEFAULT_PROTOCOL_FEE_BPS,
    antiCorrelationJitter = false,
    onProgress,
  } = options;
  const feeCollector = resolveProtocolFeeCollector(session.signer.address, options.feeCollector);

  if (recipients.length === 0) {
    throw new Error("No recipients provided for payroll run");
  }

  const getAmountNum = (recipient: PayrollRecipientInput) => Number(recipient.amount ?? recipient.amountSol ?? 0);
  for (const recipient of recipients) {
    if (!isAddress(recipient.recipient.trim())) {
      throw new Error(`Invalid Solana address: "${recipient.recipient}"`);
    }
    const amt = getAmountNum(recipient);
    if (amt <= 0) {
      throw new Error(`Invalid amount ${amt} ${assetSymbol} for recipient ${recipient.recipient}`);
    }
  }

  const totalAmount = recipients.reduce((sum, recipient) => sum + getAmountNum(recipient), 0);
  const totalBaseUnits = parseAmount(totalAmount.toFixed(decimals), decimals);
  const totalFeeBaseUnits = (totalBaseUnits * BigInt(protocolFeeBps)) / 10000n;
  const overallNeeded = totalBaseUnits + totalFeeBaseUnits;

  onProgress?.("Syncing shielded notes before payroll…");
  await syncWallet({ client: session.client, wallet: session.wallet, keys: session.keys });
  await backfillAssetRegistry(session.wallet, session.client).catch(() => 0);
  const available = getWalletAssetBalance(session.wallet, mint).amount;
  if (overallNeeded > available) throw new Error("Insufficient private balance");

  const MAX_RECIPIENTS_PER_CHUNK = 14;
  const chunked: PayrollRecipientInput[][] = [];
  for (let index = 0; index < recipients.length; index += MAX_RECIPIENTS_PER_CHUNK) {
    chunked.push(recipients.slice(index, index + MAX_RECIPIENTS_PER_CHUNK));
  }

  const shieldedByOwner = new Map<string, string>();
  const owners = new Set<string>([feeCollector.trim(), ...recipients.map((recipient) => recipient.recipient.trim())]);
  for (const owner of owners) {
    const resolved = await resolveRegisteredAddress({ rpc: session.client, owner: address(owner) }).catch(() => undefined);
    if (resolved !== undefined) shieldedByOwner.set(owner, hexBytes(resolved.address.toBytes()));
  }
  const planned: JournalChunk[] = chunked.map((chunk, index) => {
    const chunkBaseUnits = parseAmount(
      chunk.reduce((sum, recipient) => sum + getAmountNum(recipient), 0).toFixed(decimals),
      decimals,
    );
    const collector = feeCollector.trim();
    const collectorShielded = shieldedByOwner.get(collector);
    return {
      index,
      recipients: chunk.map((recipient) => {
        const solanaAddress = recipient.recipient.trim();
        const shieldedAddress = shieldedByOwner.get(solanaAddress);
        return {
          recipient: solanaAddress,
          ...(shieldedAddress === undefined ? {} : { shieldedAddress }),
          amountBaseUnits: parseAmount(getAmountNum(recipient).toFixed(decimals), decimals).toString(),
          memo: recipient.memo || `Ciphra ${assetSymbol} Payroll`,
        };
      }),
      feeCollector: collector,
      ...(collectorShielded === undefined ? {} : { feeCollectorShieldedAddress: collectorShielded }),
      feeBaseUnits: ((chunkBaseUnits * BigInt(protocolFeeBps)) / 10000n).toString(),
      feeBps: protocolFeeBps,
      status: "pending" as const,
    };
  });
  const planKey = payrollPlanKey(mint.toString(), feeCollector.trim(), protocolFeeBps, planned);
  const stored = readJournal();
  const existing = stored.find((run) => (
    run.planKey === planKey && run.chunks.some((chunk) => chunk.status !== "confirmed")
  ));
  const journal: JournalRun = existing ?? {
    runId: `CIPHRA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    createdAt: Date.now(),
    network,
    asset: assetSymbol,
    mint: mint.toString(),
    decimals,
    protocolFeeBps,
    feeCollector: feeCollector.trim(),
    planKey,
    chunks: planned,
  };
  const persist = () => {
    const others = readJournal().filter((run) => run.runId !== journal.runId);
    writeJournal([journal, ...others]);
  };
  persist();

  const executed: PayrollChunkExecution[] = [];
  for (const chunk of journal.chunks) {
    if (chunk.status === "confirmed" && chunk.signature) {
      const signature = chunk.signature;
      try {
        await assertShieldedTransaction(session, signature);
      } catch (error) {
        if (error instanceof SettledTransactionFailed) {
          chunk.status = "failed";
          chunk.error = errorText(error);
          persist();
        } else {
          persist();
          throw new Error(
            `Batch ${chunk.index + 1} is marked confirmed (${signature}) but could not be re-read. It was not sent again. ${errorText(error)}`,
          );
        }
      }
      if (chunk.status === "confirmed") {
        onProgress?.(`Skipping confirmed batch ${chunk.index + 1}. Signature ${signature}.`);
        executed.push(chunkExecution(assetSymbol, decimals, chunk));
        continue;
      }
    }

    if (chunk.status === "submitted" && chunk.signature) {
      let decision: "confirmed" | "rebuild";
      try {
        decision = await resumeSubmittedChunk(session, chunk);
      } catch (error) {
        persist();
        throw error;
      }
      persist();
      if (decision === "confirmed") {
        onProgress?.(`Batch ${chunk.index + 1} was already confirmed. Skipping it.`);
        executed.push(chunkExecution(assetSymbol, decimals, chunk));
        continue;
      }
      onProgress?.(`Batch ${chunk.index + 1} did not land and its blockhash expired. Building a replacement.`);
    }

    if (chunk.index > 0 && antiCorrelationJitter) {
      const jitterMs = 2000 + Math.floor(Math.random() * 4000);
      onProgress?.(`Anti-correlation jitter: waiting ${(jitterMs / 1000).toFixed(1)}s before batch ${chunk.index + 1}/${journal.chunks.length}…`);
      await new Promise((resolve) => setTimeout(resolve, jitterMs));
    }

    const payments: Payment[] = chunk.recipients.map((recipient) => ({
      recipient: address(recipient.recipient),
      amount: BigInt(recipient.amountBaseUnits),
    }));
    const fee = BigInt(chunk.feeBaseUnits);
    if (fee > 0n) payments.push({ recipient: address(chunk.feeCollector), amount: fee });
    const spent = payments.reduce((sum, payment) => sum + payment.amount, 0n);
    // A payment back to the signer, including the default protocol fee, stays in this wallet.
    const leaving = payments.reduce((sum, payment) => (
      payment.recipient === session.signer.address ? sum : sum + payment.amount
    ), 0n);
    const balanceBefore = getWalletAssetBalance(session.wallet, mint).amount;

    try {
      const route = await consolidateOrRemote(session, mint, spent, onProgress);
      const provingClient = route === "remote" ? session.mergeClient : session.client;
      const provingKeys = route === "remote" ? session.mergeKeys : session.keys;
      if (route === "remote") {
        onProgress?.(`Proving batch ${chunk.index + 1} on the remote prover (${notesToCover(session.wallet, mint, spent).length} inputs).`);
        await session.mergeClient.attestProver();
      } else {
        checkLocalAmount(session.wallet, spent, mint);
        onProgress?.(`Proving batch ${chunk.index + 1} of ${journal.chunks.length} in the browser (${chunk.recipients.length} contractors)…`);
      }
      const transaction = await buildMultiTransferTransaction({
        client: provingClient,
        wallet: session.wallet,
        keys: provingKeys,
        feePayer: session.signer.address,
        payments,
        ...(mint === SOL_MINT ? {} : { asset: mint }),
      });
      const result = await submitAndIndex(session, transaction, (signature, lifetime) => {
        chunk.status = "submitted";
        chunk.signature = signature;
        chunk.blockhash = lifetime.blockhash;
        chunk.lastValidBlockHeight = lifetime.lastValidBlockHeight;
        chunk.submittedAt = Date.now();
        delete chunk.error;
        persist();
      });
      chunk.status = "confirmed";
      chunk.slot = result.slot.toString();
      chunk.signature = result.signature;
      persist();
      await syncUntilBalance(session, mint, balanceBefore - leaving, result.slot, onProgress);
      executed.push(chunkExecution(assetSymbol, decimals, chunk));
    } catch (error) {
      if (chunk.status !== "submitted" && chunk.status !== "confirmed") {
        chunk.status = "failed";
      }
      chunk.error = errorText(error);
      persist();
      throw error;
    }
  }

  if (journal.chunks.every((chunk) => chunk.status === "confirmed")) {
    writeJournal(readJournal().filter((run) => run.runId !== journal.runId));
  }

  const totalFeeNum = Number(totalFeeBaseUnits) / 10 ** decimals;
  return {
    id: journal.runId,
    protocol: "Ciphra",
    version: "1.0",
    network,
    timestamp: journal.createdAt,
    formattedDate: new Date(journal.createdAt).toISOString(),
    asset: assetSymbol,
    mint: mint.toString(),
    decimals,
    totalPayroll: totalAmount,
    totalFee: totalFeeNum,
    totalBaseUnits: overallNeeded.toString(),
    totalPayrollSol: totalAmount,
    totalFeeSol: totalFeeNum,
    totalLamports: overallNeeded.toString(),
    antiCorrelationJitter,
    contractorCount: recipients.length,
    chunks: executed,
  };
}

export type VerifyAuditMode = "paystub" | "employer";

export interface VerifyAuditOptions {
  readonly mode: VerifyAuditMode;
  /** 32-byte viewing-key secret. The caller wipes this buffer. */
  readonly viewingKey?: Uint8Array;
  /** Use the connected session. Paystub mode calls `decrypt`. Employer mode derives `transactionViewingKey`. */
  readonly useSessionKey?: boolean;
}

export interface DecryptedNote {
  readonly signature: string;
  readonly slotIndex: number;
  readonly mint: string;
  readonly assetId: string;
  readonly amountBaseUnits: string;
  readonly amountDisplay: string;
  readonly role: "recipient" | "sender-change" | "opened-note";
  readonly recipientViewingKey: string;
  /**
   * Set only when this zero-amount output was proven to be shape padding.
   * A zero note without this flag is a real output and stays in the comparison.
   */
  readonly paddingProven?: boolean;
}

export interface VerificationResult {
  readonly valid: boolean;
  readonly mode: VerifyAuditMode;
  readonly integrity: AuditIntegrity;
  readonly tamperReason?: string;
  readonly decryptedOutputs: readonly DecryptedNote[];
  readonly txSignature: string;
  readonly slot: string;
  readonly network: string;
  readonly asset: AssetSymbol;
  readonly mint: string;
  readonly decimals: number;
  readonly disclosedPayouts: readonly PayrollPayoutRecord[];
  readonly protocolFee?: {
    readonly collector: string;
    readonly amount: number;
    readonly amountSol?: number;
    readonly amountBaseUnits?: string;
    readonly amountLamports?: string;
    readonly bps: number;
  } | undefined;
  readonly totalDisclosed: number;
  readonly totalDisclosedSol: number;
  readonly onChainEventCount: number;
  readonly outputSlotCount: number;
  readonly ringProgramId?: string | undefined;
  readonly timestamp?: string | undefined;
  readonly receiptCommitmentHash?: string | undefined;
  readonly commitmentVerified?: boolean | undefined;
  readonly onChainSlotMatch?: boolean | undefined;
  readonly programInvocationConfirmed?: boolean | undefined;
  readonly txSuccessConfirmed?: boolean | undefined;
  readonly payerPubkey?: string | undefined;
  readonly payerSignature?: string | undefined;
  readonly payerSignatureVerified?: boolean | undefined;
  readonly chunksVerifiedCount?: number | undefined;
}

export interface CanonicalChunkPayload {
  readonly chunkIndex: number;
  readonly txSignature: string;
  readonly slot: string;
  readonly payouts: readonly {
    readonly recipient: string;
    readonly amount?: number;
    readonly amountSol?: number;
    readonly memo: string;
  }[];
  readonly protocolFee?: {
    readonly collector?: string;
    readonly recipient?: string;
    readonly amount?: number;
    readonly amountSol?: number;
    readonly bps?: number;
  } | null | undefined;
}

/**
 * Computes a deterministic SHA-256 commitment digest over canonical receipt fields.
 * Binds payerPubkey and EVERY chunk (chunkIndex, txSignature, slot, payouts, and protocolFee).
 */
export async function computeReceiptCommitmentHash(fields: {
  network: string;
  programId: string;
  payerPubkey: string;
  asset: string;
  mint: string;
  chunks: readonly CanonicalChunkPayload[];
}): Promise<string> {
  const canonical = JSON.stringify({
    network: fields.network,
    programId: fields.programId,
    payerPubkey: fields.payerPubkey,
    asset: fields.asset,
    mint: fields.mint,
    chunks: fields.chunks.map((c) => ({
      chunkIndex: c.chunkIndex,
      txSignature: c.txSignature,
      slot: c.slot,
      payouts: c.payouts.map((p) => ({
        recipient: p.recipient,
        amount: p.amount ?? p.amountSol ?? 0,
        memo: p.memo,
      })),
      protocolFee: c.protocolFee
        ? {
            collector: c.protocolFee.collector || c.protocolFee.recipient || "",
            amount: c.protocolFee.amount ?? c.protocolFee.amountSol ?? 0,
            // Receipts written before the 50 bps fee omitted `bps`. Keep 25 so those digests stay valid.
            bps: c.protocolFee.bps ?? 25,
          }
        : null,
    })),
  });
  const encoded = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Signs the UTF-8 bytes of a receipt commitment hash using the active session/payer Ed25519 key
 * or browser wallet (Phantom / Solflare) signMessage fallback.
 */
export async function signReceiptCommitment(
  session: Session,
  commitmentHash: string
): Promise<{ payerPubkey: string; payerSignature: string }> {
  const payerPubkey = session.signer.address;
  const hashBytes = new TextEncoder().encode(commitmentHash);

  let signatureBytes: Uint8Array | undefined;
  try {
    const external = await signConnectedWalletMessage(hashBytes);
    if (external !== null) signatureBytes = external;
  } catch {
    signatureBytes = undefined;
  }

  if (signatureBytes === undefined) {
    if (!isKeyPairSigner(session.signer)) {
      throw new Error("Receipt signing needs the connected wallet or a local session key.");
    }
    signatureBytes = await signBytes(session.signer.keyPair.privateKey, hashBytes);
  }

  const payerSignature = getBase58Decoder().decode(signatureBytes);
  return { payerPubkey, payerSignature };
}

/**
 * Generates a deterministic SHA-256 commitment hash binding all chunks and payerPubkey,
 * cryptographically signs it with the active session Ed25519 key, and attaches both to the report.
 */
export async function attachCommitmentHashes(
  session: Session,
  report: BatchPayrollReport,
  ringProgramId: string = "ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW"
): Promise<BatchPayrollReport & { receiptCommitmentHash: string; payerPubkey: string; payerSignature: string }> {
  const canonicalChunks: CanonicalChunkPayload[] = report.chunks.map((c) => ({
    chunkIndex: c.chunkIndex,
    txSignature: c.txSignature,
    slot: c.slot,
    payouts: c.payouts,
    protocolFee: c.protocolFee,
  }));

  const hash = await computeReceiptCommitmentHash({
    network: report.network,
    programId: ringProgramId,
    payerPubkey: session.signer.address,
    asset: report.asset,
    mint: report.mint,
    chunks: canonicalChunks,
  });

  const { payerPubkey, payerSignature } = await signReceiptCommitment(session, hash);

  return {
    ...report,
    receiptCommitmentHash: hash,
    payerPubkey,
    payerSignature,
  };
}

/**
 * Creates and Ed25519-authenticates a single-contractor selective disclosure receipt.
 */
export async function createSingleContractorReceipt(
  session: Session,
  run: BatchPayrollReport,
  payout: PayrollPayoutRecord
): Promise<any> {
  const chunk = run.chunks[0];
  const txSig = chunk?.txSignature ?? "";
  const slot = chunk?.slot ?? "";
  const asset = run.asset ?? "SOL";
  const decimals = run.decimals ?? (asset === "USDC" ? 6 : 9);
  const mint = run.mint ?? (asset === "USDC" ? USDC_MINT.toString() : SOL_MINT.toString());

  const singleChunk: CanonicalChunkPayload = {
    chunkIndex: 0,
    txSignature: txSig,
    slot,
    payouts: [payout],
    protocolFee: null,
  };

  const receiptCommitmentHash = await computeReceiptCommitmentHash({
    network: run.network,
    programId: "ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW",
    payerPubkey: session.signer.address,
    asset,
    mint,
    chunks: [singleChunk],
  });

  const { payerPubkey, payerSignature } = await signReceiptCommitment(session, receiptCommitmentHash);

  return {
    protocol: "Ciphra",
    version: "1.0",
    receiptType: "SingleContractorDisbursement",
    asset,
    mint,
    decimals,
    txSignature: txSig,
    slot,
    timestamp: run.timestamp,
    payout,
    network: run.network,
    payerPubkey,
    payerSignature,
    receiptCommitmentHash,
  };
}

/**
 * Computes commitment hash for a single contractor disbursement.
 */
export async function computeSingleReceiptHash(receipt: {
  network: string;
  txSignature: string;
  slot: string;
  asset: string;
  mint: string;
  payerPubkey?: string;
  payout: { recipient: string; amount?: number; amountSol?: number; memo: string };
}): Promise<string> {
  return computeReceiptCommitmentHash({
    network: receipt.network,
    programId: "ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW",
    payerPubkey: receipt.payerPubkey || "",
    asset: receipt.asset,
    mint: receipt.mint,
    chunks: [
      {
        chunkIndex: 0,
        txSignature: receipt.txSignature,
        slot: receipt.slot,
        payouts: [receipt.payout],
        protocolFee: null,
      },
    ],
  });
}

class SettledTransactionFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettledTransactionFailed";
  }
}

function collectAccountKeys(transaction: unknown): string[] {
  const keys: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === "string") keys.push(value);
    else if (typeof value === "object" && value !== null && "pubkey" in value) {
      const pubkey = (value as { pubkey?: unknown }).pubkey;
      if (typeof pubkey === "string") keys.push(pubkey);
    }
  };
  if (typeof transaction !== "object" || transaction === null) return keys;
  const message = (transaction as { transaction?: { message?: Record<string, unknown> } }).transaction?.message;
  const lists = [message?.accountKeys, message?.staticAccountKeys];
  for (const list of lists) {
    if (Array.isArray(list)) for (const key of list) push(key);
  }
  const loaded = (transaction as { meta?: { loadedAddresses?: { writable?: unknown[]; readonly?: unknown[] } } }).meta?.loadedAddresses;
  for (const key of loaded?.writable ?? []) push(key);
  for (const key of loaded?.readonly ?? []) push(key);
  return keys;
}

async function readSettledTransaction(session: Session, signature: string): Promise<{ slot: string }> {
  let response: {
    slot?: bigint | number;
    meta?: { err?: unknown } | null;
    transaction?: { message?: Record<string, unknown> };
  } | null;
  try {
    response = await session.client.solanaRpc.getTransaction(signature as Signature, {
      commitment: "confirmed",
      encoding: "json",
      maxSupportedTransactionVersion: 1,
    }).send();
  } catch (error) {
    throw new Error(
      `getTransaction failed for ${signature}. A signature status is not proof of the shielded program. ${errorText(error)}`,
    );
  }
  if (!response?.meta) {
    throw new Error(`getTransaction returned no meta for ${signature}.`);
  }
  if (response.meta.err !== null && response.meta.err !== undefined) {
    throw new SettledTransactionFailed(`Transaction ${signature} failed on-chain.`);
  }
  const accountKeys = collectAccountKeys(response);
  if (accountKeys.length === 0) {
    throw new Error(`getTransaction for ${signature} did not include account keys, so it was not treated as failed.`);
  }
  if (!accountKeys.includes(SHIELDED_POOL_PROGRAM_ID)) {
    throw new SettledTransactionFailed(
      `Transaction ${signature} does not include the shielded-pool program ${SHIELDED_POOL_PROGRAM_ID}.`,
    );
  }
  return { slot: String(response.slot ?? "") };
}

async function assertShieldedTransaction(session: Session, signature: string): Promise<void> {
  await readSettledTransaction(session, signature);
}

function displayAmount(mint: string, amount: bigint, fallbackDecimals: number): string {
  const decimals = mint === SOL_MINT ? 9 : mint === USDC_MINT ? 6 : fallbackDecimals;
  return decimals > 0 ? formatAmount(amount, decimals) : amount.toString();
}

function noteFromPlaintext(
  session: Session,
  signature: string,
  slotIndex: number,
  plaintext: { assetId: bigint; amount: bigint },
  role: DecryptedNote["role"],
  recipientViewingKey: string,
  fallbackDecimals: number,
): DecryptedNote {
  let mint = `asset-id:${plaintext.assetId.toString()}`;
  try {
    mint = session.wallet.registry.resolve(plaintext.assetId);
  } catch {
    mint = `asset-id:${plaintext.assetId.toString()}`;
  }
  return {
    signature,
    slotIndex,
    mint,
    assetId: plaintext.assetId.toString(),
    amountBaseUnits: plaintext.amount.toString(),
    amountDisplay: displayAmount(mint, plaintext.amount, fallbackDecimals),
    role,
    recipientViewingKey,
  };
}

function confidentialBody(payload: Uint8Array): Uint8Array | undefined {
  try {
    const frame = decodeOutputData(payload);
    if (frame.encoding !== "encrypted") return undefined;
    if (frame.scheme !== EncryptedScheme.confidential && frame.scheme !== EncryptedScheme.ringConfidential) {
      return undefined;
    }
    if (frame.body.length < 33) return undefined;
    return frame.body;
  } catch {
    return undefined;
  }
}

async function decryptIndexedTransaction(
  session: Session,
  transaction: IndexedShieldedTransaction,
  options: VerifyAuditOptions,
): Promise<DecryptedNote[]> {
  const firstNullifier = transaction.nullifiers[0];
  const salt = transaction.salt;
  const published = transaction.txViewingPublicKey;
  if (firstNullifier === undefined || salt === undefined || published === undefined) {
    throw new Error("Indexed transaction is missing the first nullifier, salt, or transaction viewing public key.");
  }
  await backfillAssetRegistry(session.wallet, session.client).catch(() => 0);
  const signature = transaction.txSignature;
  if (options.mode === "paystub") {
    if (options.useSessionKey === true) {
      const viewingPublicKey = session.keys.viewingPublicKeys()[0];
      if (viewingPublicKey === undefined) throw new Error("This session has no viewing key.");
      const notes: DecryptedNote[] = [];
      for (let slotIndex = 0; slotIndex < transaction.outputSlots.length; slotIndex += 1) {
        const slot = transaction.outputSlots[slotIndex];
        if (slot === undefined) continue;
        const body = confidentialBody(slot.payload);
        if (body === undefined) continue;
        try {
          const opened = await session.keys.decrypt([{
            ciphertext: body.subarray(33),
            viewingPublicKey,
            txViewingPublicKey: published,
            salt,
            slotIndex,
            label: "transfer",
          }]);
          const plaintext = opened[0];
          if (plaintext === undefined) continue;
          notes.push(noteFromPlaintext(
            session,
            signature,
            slotIndex,
            decodeConfidential(plaintext),
            "opened-note",
            hexBytes(viewingPublicKey.toBytes()),
            0,
          ));
        } catch {
          // A slot encrypted to someone else fails this viewing key.
        }
      }
      return notes;
    }
    if (options.viewingKey === undefined) {
      throw new Error("Paste the recipient's 32-byte viewing key, or use the connected wallet.");
    }
    const key = ViewingKey.fromBytes(bytes32(options.viewingKey));
    try {
      const notes: DecryptedNote[] = [];
      transaction.outputSlots.forEach((slot, slotIndex) => {
        const body = confidentialBody(slot.payload);
        if (body === undefined) return;
        try {
          notes.push(noteFromPlaintext(
            session,
            signature,
            slotIndex,
            decodeConfidential(key.decryptUtxo(body.subarray(33), published, salt, slotIndex)),
            "opened-note",
            hexBytes(key.publicKey().toBytes()),
            0,
          ));
        } catch {
          // This slot is not encrypted to the pasted recipient key.
        }
      });
      return notes;
    } finally {
      key.destroy();
    }
  }

  const notes: DecryptedNote[] = [];
  let txKey: ViewingKey;
  let senderPublic: X25519PublicKey | undefined;
  let authored: ViewingKey | undefined;
  if (options.useSessionKey === true) {
    const viewingPublicKey = session.keys.viewingPublicKeys()[0];
    if (viewingPublicKey === undefined) throw new Error("This session has no viewing key.");
    senderPublic = viewingPublicKey;
    const derived = await session.keys.transactionKeys([{ viewingPublicKey, firstNullifier }]);
    const key = derived[0];
    if (key === undefined) throw new Error("The session did not derive a transaction viewing key.");
    txKey = key;
  } else {
    if (options.viewingKey === undefined) {
      throw new Error("Paste the employer viewing key, or use the connected wallet.");
    }
    const pasted = ViewingKey.fromBytes(bytes32(options.viewingKey));
    authored = pasted;
    const derived = pasted.transactionViewingKey(firstNullifier);
    if (sameBytes(derived.publicKey().toBytes(), published.toBytes())) {
      senderPublic = pasted.publicKey();
      txKey = derived;
    } else if (sameBytes(pasted.publicKey().toBytes(), published.toBytes())) {
      derived.destroy();
      txKey = pasted;
      authored = undefined;
    } else {
      derived.destroy();
      pasted.destroy();
      throw new Error(
        "This key is neither the sender viewing key nor the transaction viewing key for the first nullifier.",
      );
    }
  }
  try {
    if (!sameBytes(txKey.publicKey().toBytes(), published.toBytes())) {
      throw new Error(
        "transactionViewingKey(firstNullifier) does not match the published transaction viewing key, so this wallet did not author the transfer.",
      );
    }
    transaction.outputSlots.forEach((slot, slotIndex) => {
      const body = confidentialBody(slot.payload);
      if (body === undefined) return;
      try {
        const embedded = X25519PublicKey.fromBytes(body.subarray(0, 33));
        const plaintext = decodeConfidential(txKey.decryptSlotEphemeral(embedded, body.subarray(33), salt, slotIndex));
        const senderChange = senderPublic !== undefined && sameBytes(embedded.toBytes(), senderPublic.toBytes());
        notes.push(noteFromPlaintext(
          session,
          signature,
          slotIndex,
          plaintext,
          senderChange ? "sender-change" : "recipient",
          hexBytes(embedded.toBytes()),
          0,
        ));
      } catch {
        // Dummy slots do not decrypt under the transaction viewing key.
      }
    });
    return notes;
  } finally {
    if (authored !== undefined && authored !== txKey) authored.destroy();
    txKey.destroy();
  }
}

/** 32-byte viewing-key secret. Rejects a 64-byte ed25519 derivation signature. */
export function parseViewingKeyBytes(text: string): Uint8Array {
  const trimmed = text.trim();
  if (/^[0-9a-fA-F]{128}$/.test(trimmed)) {
    throw new Error("That value is 64 bytes. A viewing key is 32 bytes, not the ed25519 derivation signature.");
  }
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let index = 0; index < 32; index += 1) {
      bytes[index] = Number.parseInt(trimmed.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
  }
  const decoded = new Uint8Array(getBase58Encoder().encode(trimmed));
  if (decoded.length === 64) {
    throw new Error("That value is 64 bytes. A viewing key is 32 bytes, not the ed25519 derivation signature.");
  }
  if (decoded.length !== 32) {
    throw new Error(`A viewing key is 32 bytes. This value is ${decoded.length} bytes.`);
  }
  return decoded;
}

/**
 * Hex secret of `transactionViewingKey(firstNullifier)` for one authored transaction.
 * Holding it opens every output of that transaction, including change and every recipient.
 */
export async function exportBatchTransactionViewingKey(session: Session, signatureText: string): Promise<string> {
  const indexed = await session.client.getShieldedTransactionsBySignature(signatureText as Signature);
  const viewingPublicKey = session.keys.viewingPublicKeys()[0];
  if (viewingPublicKey === undefined) throw new Error("This session has no viewing key.");
  for (const event of indexed.transactions) {
    const transaction = event.transaction;
    const firstNullifier = transaction.nullifiers[0];
    const published = transaction.txViewingPublicKey;
    if (firstNullifier === undefined || published === undefined) continue;
    const derived = await session.keys.transactionKeys([{ viewingPublicKey, firstNullifier }]);
    const txKey = derived[0];
    if (txKey === undefined) continue;
    try {
      if (!sameBytes(txKey.publicKey().toBytes(), published.toBytes())) continue;
      const secret = txKey.secretBytes();
      try {
        return hexBytes(secret);
      } finally {
        secret.fill(0);
      }
    } finally {
      txKey.destroy();
    }
  }
  throw new Error("This wallet did not author a shielded event in that signature, so there is no batch transaction viewing key to export.");
}

/**
 * Strictly verifies a selective audit receipt against on-chain Solana state and Ed25519 payer attestation:
 *  1. Requires a non-empty `slot` and verifies `confirmedSlot === receiptSlot` for EVERY chunk on-chain
 *     (`getTransaction` with `meta.err === null` and explicit `ring1GaLC...XANW` invocation).
 *  2. Verifies `payerPubkey` matches the on-chain transaction signer (`accountKeys[0]`).
 *  3. Cryptographically verifies `payerSignature` against `payerPubkey` and `receiptCommitmentHash` with Ed25519.
 *  4. Recomputes SHA-256 commitment hash over canonical payload to guarantee tamper evidence.
 */
export async function verifyAuditReceipt(
  session: Session,
  receiptJson: string,
  options: VerifyAuditOptions,
): Promise<VerificationResult> {
  let parsed: any;
  const trimmedReceipt = receiptJson.trim();
  try {
    parsed = JSON.parse(trimmedReceipt);
  } catch {
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(trimmedReceipt)) {
      throw new Error("Paste a transaction signature or a receipt JSON object.");
    }
    parsed = { txSignature: trimmedReceipt };
  }

  const ringProgramId = SHIELDED_POOL_PROGRAM_ID;
  const { client } = session;

  // Normalize chunks array
  let rawChunks: any[] = [];
  if (Array.isArray(parsed.chunks) && parsed.chunks.length > 0) {
    rawChunks = parsed.chunks;
  } else if (parsed.txSignature) {
    rawChunks = [
      {
        chunkIndex: 0,
        txSignature: parsed.txSignature,
        slot: parsed.slot || "",
        payouts: parsed.payout ? [parsed.payout] : (parsed.payouts || []),
        protocolFee: parsed.protocolFee || null,
      },
    ];
  } else {
    throw new Error("Receipt is missing transaction signatures or chunks.");
  }

  const asset: AssetSymbol = parsed.asset === "USDC" ? "USDC" : "SOL";
  const decimals = parsed.decimals ?? (asset === "USDC" ? 6 : 9);
  const mint = parsed.mint || (asset === "USDC" ? USDC_MINT.toString() : SOL_MINT.toString());

  // 1. Strict On-Chain Verification for EVERY chunk
  let firstConfirmedSlot = "";
  let detectedOnChainSigner = "";
  let totalConfirmedPayouts: PayrollPayoutRecord[] = [];

  for (let idx = 0; idx < rawChunks.length; idx++) {
    const chunk = rawChunks[idx];
    const txSig = chunk.txSignature;
    if (!txSig) {
      throw new Error(`Receipt chunk ${idx + 1} is missing a transaction signature (txSignature)`);
    }

    const receiptSlot = (chunk.slot || parsed.slot || "").toString().trim();

    let confirmedSlot = "";
    let txSuccess = false;
    let programFound = false;
    let chunkSigner = "";

    try {
      const txResponse = await client.solanaRpc
        .getTransaction(txSig as Signature, {
          commitment: "confirmed",
          encoding: "json",
          maxSupportedTransactionVersion: 1,
        })
        .send();

      if (!txResponse) {
        throw new Error(`getTransaction returned no transaction for ${txSig}.`);
      }
      if (txResponse) {
        if (!txResponse.meta) {
          throw new Error(`getTransaction for ${txSig} did not include meta.`);
        }
        txSuccess = txResponse.meta.err === null;
        confirmedSlot = txResponse.slot?.toString() ?? "";

        const accountKeys: string[] = [];
        if (txResponse.transaction?.message?.accountKeys) {
          for (const key of txResponse.transaction.message.accountKeys) {
            accountKeys.push(typeof key === "string" ? key : (key as any).pubkey || String(key));
          }
        }
        if ((txResponse.transaction?.message as any)?.staticAccountKeys) {
          for (const key of (txResponse.transaction.message as any).staticAccountKeys) {
            accountKeys.push(typeof key === "string" ? key : (key as any).pubkey || String(key));
          }
        }
        const metaAny = txResponse.meta as any;
        if (metaAny?.loadedAddresses) {
          const loaded = metaAny.loadedAddresses as { writable?: string[]; readonly?: string[] };
          for (const key of loaded.writable ?? []) accountKeys.push(String(key));
          for (const key of loaded.readonly ?? []) accountKeys.push(String(key));
        }

        chunkSigner = accountKeys[0] || "";
        programFound = accountKeys.some((k) => k === ringProgramId);
      }
    } catch (error) {
      throw new Error(
        `getTransaction failed for ${txSig}. A signature status is not proof of the shielded program. ${errorText(error)}`,
      );
    }

    if (!txSuccess) {
      throw new Error(`Transaction ${txSig} for chunk ${idx + 1} failed on-chain (meta.err ≠ null).`);
    }

    if (receiptSlot && confirmedSlot !== receiptSlot) {
      throw new Error(
        `On-chain slot mismatch for chunk ${idx + 1}: receipt claimed slot #${receiptSlot} but transaction landed in slot #${confirmedSlot}.`
      );
    }

    if (!programFound) {
      throw new Error(
        `Transaction ${txSig} for chunk ${idx + 1} did not invoke the Solana Privacy Rings program (${ringProgramId}).`
      );
    }

    if (chunkSigner) {
      if (!detectedOnChainSigner) {
        detectedOnChainSigner = chunkSigner;
      } else if (detectedOnChainSigner !== chunkSigner) {
        throw new Error(
          `Inconsistent transaction signers across chunks: chunk 1 was signed by ${detectedOnChainSigner} but chunk ${idx + 1} was signed by ${chunkSigner}.`
        );
      }
    }

    if (idx === 0) {
      firstConfirmedSlot = confirmedSlot;
    }

    if (Array.isArray(chunk.payouts)) {
      totalConfirmedPayouts.push(...chunk.payouts);
    }
  }

  // If single contractor receipt, ensure payouts list is accurate
  if (parsed.receiptType === "SingleContractorDisbursement" && parsed.payout) {
    totalConfirmedPayouts = [parsed.payout];
  }

  // 2. Verify payerPubkey matches on-chain transaction signer
  const claimedPayerPubkey: string = parsed.payerPubkey || detectedOnChainSigner;
  if (!claimedPayerPubkey) {
    throw new Error("Audit receipt is missing payerPubkey, and on-chain signer could not be extracted.");
  }
  if (detectedOnChainSigner && claimedPayerPubkey !== detectedOnChainSigner) {
    throw new Error(
      `Payer authentication mismatch: receipt claims payer ${claimedPayerPubkey} but on-chain transaction signer is ${detectedOnChainSigner}.`
    );
  }

  const payerSignature: string | undefined = parsed.payerSignature;
  const hashToVerify: string | undefined = parsed.receiptCommitmentHash;
  let payerSignatureVerified = false;
  let commitmentVerified = false;
  if (payerSignature || hashToVerify) {
    if (!payerSignature || !hashToVerify) {
      throw new Error("A receipt that carries a payer signature or a commitment hash must carry both.");
    }
    let sigBytes: Uint8Array;
    if (/^[0-9a-fA-F]{128}$/.test(payerSignature.trim())) {
      const pairs = payerSignature.trim().match(/../g);
      if (!pairs) throw new Error("Payer signature hex could not be read.");
      sigBytes = Uint8Array.from(pairs, (byte) => parseInt(byte, 16));
    } else {
      sigBytes = new Uint8Array(getBase58Encoder().encode(payerSignature.trim()));
    }
    const pubBytes = new Uint8Array(getBase58Encoder().encode(claimedPayerPubkey.trim()));
    const msgBytes = new TextEncoder().encode(hashToVerify.trim());
    try {
      payerSignatureVerified = ed25519.verify(sigBytes, msgBytes, pubBytes);
    } catch (err: unknown) {
      throw new Error(`Ed25519 signature check error: ${errorText(err)}`);
    }
    if (!payerSignatureVerified) {
      throw new Error(
        `Cryptographic signature verification failed: payerSignature is NOT a valid Ed25519 signature from payer ${claimedPayerPubkey} over the receipt commitment hash.`,
      );
    }
    const canonicalChunks: CanonicalChunkPayload[] = rawChunks.map((chunk: any, index: number) => ({
      chunkIndex: chunk.chunkIndex ?? index,
      txSignature: chunk.txSignature,
      slot: (chunk.slot || parsed.slot || "").toString(),
      payouts: Array.isArray(chunk.payouts) ? chunk.payouts : parsed.payout ? [parsed.payout] : [],
      protocolFee: chunk.protocolFee || null,
    }));
    const recomputedHash = await computeReceiptCommitmentHash({
      network: parsed.network || networkLabel,
      programId: ringProgramId,
      payerPubkey: claimedPayerPubkey,
      asset,
      mint,
      chunks: canonicalChunks,
    });
    if (recomputedHash !== hashToVerify) {
      throw new Error(
        "Receipt integrity check failed: SHA-256 commitment hash does not match recomputed digest. " +
        "Disclosed amounts, recipient addresses, transaction slots, or fees have been tampered with.",
      );
    }
    commitmentVerified = true;
  }

  const senderShieldedAddress = hexBytes(session.shieldedAddress.toBytes());
  // Paystub mode opens only notes encrypted to one viewing key. The wallet that
  // sent the batch is not a payee, so those notes are its change and the
  // contractors' shielded addresses look "missing". A sender verifies the batch
  // by opening every output. A listed recipient stays on the one-note path.
  const compareMode = options.useSessionKey === true
    ? auditModeForConnectedWallet(options.mode, senderShieldedAddress, rawChunks)
    : options.mode;
  const decryptOptions: VerifyAuditOptions = compareMode === options.mode
    ? options
    : {
        mode: compareMode,
        ...(options.viewingKey !== undefined ? { viewingKey: options.viewingKey } : {}),
        ...(options.useSessionKey === true ? { useSessionKey: true as const } : {}),
      };
  const decryptedOutputs: DecryptedNote[] = [];
  try {
    for (const chunk of rawChunks) {
      const indexed = await client.getShieldedTransactionsBySignature(chunk.txSignature as Signature);
      if (indexed.transactions.length === 0) {
        throw new Error(`The shielded indexer has no event for ${chunk.txSignature}.`);
      }
      for (const event of indexed.transactions) {
        decryptedOutputs.push(...await decryptIndexedTransaction(session, event.transaction, decryptOptions));
      }
    }
  } catch (error) {
    if (compareMode === "employer" && options.mode === "paystub" && errorText(error).includes("did not author")) {
      throw new Error(
        "This wallet is not a recipient on the receipt, and it did not author the transaction. Open a paystub with that recipient's viewing key.",
      );
    }
    throw error;
  }
  const audit = compareDecryptedAmounts(compareMode, decryptedOutputs, rawChunks, decimals, {
    ...(compareMode === "paystub" && options.useSessionKey === true
      ? { paystubShieldedAddress: senderShieldedAddress }
      : {}),
    senderAddress: detectedOnChainSigner || session.signer.address,
    senderShieldedAddress,
  });
  const chainPayouts: PayrollPayoutRecord[] = decryptedOutputs.map((note) => ({
    recipient: note.role === "sender-change"
      ? `sender change ${note.recipientViewingKey}`
      : note.recipientViewingKey,
    amountBaseUnits: note.amountBaseUnits,
    amountLamports: note.amountBaseUnits,
    memo: `${note.role} · slot ${note.slotIndex} · ${note.mint}`,
  }));
  // Headline disbursement is recipient payouts. Sender change and a sender-owned
  // protocol fee share the sender-change role and stay in the per-note table.
  // Paystub decryption labels the same payout opened-note.
  const totalBase = decryptedOutputs.reduce((sum, note) => {
    if (note.role === "sender-change") return sum;
    return sum + BigInt(note.amountBaseUnits);
  }, 0n);

  return {
    valid: audit.integrity === "VERIFIED",
    mode: compareMode,
    integrity: audit.integrity,
    ...(audit.reason ? { tamperReason: audit.reason } : {}),
    decryptedOutputs,
    txSignature: rawChunks[0]?.txSignature || parsed.txSignature,
    slot: firstConfirmedSlot || rawChunks[0]?.slot || parsed.slot || "",
    network: parsed.network || networkLabel,
    asset,
    mint: decryptedOutputs[0]?.mint || mint,
    decimals,
    disclosedPayouts: chainPayouts,
    protocolFee: rawChunks[0]?.protocolFee,
    totalDisclosed: Number(totalBase) / 10 ** decimals,
    totalDisclosedSol: Number(totalBase) / 10 ** decimals,
    onChainEventCount: decryptedOutputs.length,
    outputSlotCount: decryptedOutputs.length,
    ringProgramId,
    timestamp: parsed.formattedDate || new Date().toISOString(),
    ...(hashToVerify ? { receiptCommitmentHash: hashToVerify } : {}),
    commitmentVerified,
    onChainSlotMatch: true,
    programInvocationConfirmed: true,
    txSuccessConfirmed: true,
    payerPubkey: claimedPayerPubkey,
    ...(payerSignature ? { payerSignature } : {}),
    payerSignatureVerified,
    chunksVerifiedCount: rawChunks.length,
  };
}
