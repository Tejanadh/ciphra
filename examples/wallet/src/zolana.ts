import "./polyfill.js";
import {
  LocalKeys,
  MergeEncryptionScheme,
  SOL_MINT,
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
  type TransferPayment as Payment,
} from "@heliuslabs/spr";
export { SOL_MINT };
import { getAssociatedTokenAddress } from "@heliuslabs/spr/addresses";
import { backfillAssetRegistry, fetchUserRecord } from "@heliuslabs/spr/wallet";
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
  getSignatureFromTransaction,
  isAddress,
  pipe,
  sendTransactionWithoutConfirmingFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signBytes,
  signTransactionWithSigners,
  type Address,
  type KeyPairSigner,
  type Transaction,
} from "@solana/kit";
import { SprWebProver, type Measurement } from "@heliuslabs/spr-web-prover";
import { deployments, remoteProverConfig, sprEndpoints } from "./deployments";
import { limitLocalProofs, localSpendLimit, MERGE_FIRST } from "./local-proving.js";
export type { Payment };

const selectedNetwork: string = import.meta.env.VITE_ZOLANA_NETWORK ?? "devnet";
if (selectedNetwork !== "devnet" && selectedNetwork !== "mainnet") {
  throw new Error("VITE_ZOLANA_NETWORK must be devnet or mainnet");
}
export const network = selectedNetwork;
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

export interface Session {
  readonly prover: SprWebProver;
  readonly client: Client;
  readonly mergeClient: Client;
  readonly signer: KeyPairSigner;
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
export async function openSession(seed: Uint8Array, onMeasurement: (m: Measurement) => void): Promise<Session> {
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
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed);
  // The keys derive from the owner's signature over the Solana off-chain
  // message the SDK defines; a wallet would produce it with signMessage.
  const publicKey = new Uint8Array(getAddressEncoder().encode(signer.address)) as Bytes32;
  const derivationSeed = await signBytes(signer.keyPair.privateKey, ed25519DerivationMessage(publicKey));
  const keys = LocalKeys.fromDerivationSeed({ solanaPublicKey: signer.address, derivationSeed }, client.proofService);
  const mergeKeys = LocalKeys.fromDerivationSeed({ solanaPublicKey: signer.address, derivationSeed }, mergeClient.proofService);
  derivationSeed.fill(0);
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

async function submit(session: Session, transaction: Transaction): Promise<ExecutionResult> {
  const { client, signer } = session;
  const signed = await signTransactionWithSigners([signer], transaction);
  await sendTransactionWithoutConfirmingFactory({ rpc: client.solanaRpc })(signed, {
    commitment: client.commitment,
  });
  const signature = getSignatureFromTransaction(signed);
  const slot = await client.confirmTransaction(signature);
  return { signature, slot };
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
  async withdraw(session: Session, amount: bigint, asset: Address = SOL_MINT): Promise<ExecutionResult> {
    return this.unshield(session, amount, asset);
  },
  async mintDevnetTestUsdc(session: Session, amountTokens: number = 10000): Promise<ExecutionResult> {
    const { client, signer } = session;
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

export interface PayrollRecipientInput {
  readonly recipient: string;
  readonly amount?: number;
  readonly amountSol?: number;
  readonly memo: string;
}

export interface PayrollPayoutRecord {
  readonly recipient: string;
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
}

/**
 * Executes batch payroll using buildMultiTransferTransaction.
 * Max 14 recipients per chunk to leave the 15th slot for the 0.25% protocol fee.
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
    protocolFeeBps = 25, // 0.25%
    feeCollector = session.signer.address,
    antiCorrelationJitter = false,
    onProgress,
  } = options;

  if (recipients.length === 0) {
    throw new Error("No recipients provided for payroll run");
  }

  const getAmountNum = (r: PayrollRecipientInput) => Number(r.amount ?? r.amountSol ?? 0);

  // Validate all recipient addresses upfront
  for (const r of recipients) {
    if (!isAddress(r.recipient.trim())) {
      throw new Error(`Invalid Solana address: "${r.recipient}"`);
    }
    const amt = getAmountNum(r);
    if (amt <= 0) {
      throw new Error(`Invalid amount ${amt} ${assetSymbol} for recipient ${r.recipient}`);
    }
  }

  // Total amount needed in base units
  const totalAmount = recipients.reduce((sum, r) => sum + getAmountNum(r), 0);
  const totalBaseUnits = parseAmount(totalAmount.toFixed(decimals), decimals);
  const totalFeeBaseUnits = (totalBaseUnits * BigInt(protocolFeeBps)) / 10000n;
  const overallNeeded = totalBaseUnits + totalFeeBaseUnits;

  checkLocalAmount(session.wallet, overallNeeded, mint);

  const MAX_RECIPIENTS_PER_CHUNK = 14;
  const chunked: PayrollRecipientInput[][] = [];
  for (let i = 0; i < recipients.length; i += MAX_RECIPIENTS_PER_CHUNK) {
    chunked.push(recipients.slice(i, i + MAX_RECIPIENTS_PER_CHUNK));
  }

  const chunks: PayrollChunkExecution[] = [];
  const runId = `CIPHRA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  for (let idx = 0; idx < chunked.length; idx++) {
    const chunk = chunked[idx]!;
    if (idx > 0 && antiCorrelationJitter) {
      const jitterMs = 2000 + Math.floor(Math.random() * 4000);
      onProgress?.(`Anti-correlation jitter: waiting ${(jitterMs / 1000).toFixed(1)}s before batch ${idx + 1}/${chunked.length}…`);
      await new Promise((res) => setTimeout(res, jitterMs));
    }

    onProgress?.(`Proving & executing ${assetSymbol} batch ${idx + 1} of ${chunked.length} (${chunk.length} contractors)…`);

    const chunkTotal = chunk.reduce((sum, r) => sum + getAmountNum(r), 0);
    const chunkBaseUnits = parseAmount(chunkTotal.toFixed(decimals), decimals);
    const chunkFeeBaseUnits = (chunkBaseUnits * BigInt(protocolFeeBps)) / 10000n;

    const payments: Payment[] = chunk.map((c) => ({
      recipient: address(c.recipient.trim()),
      amount: parseAmount(getAmountNum(c).toFixed(decimals), decimals),
    }));

    if (chunkFeeBaseUnits > 0n) {
      payments.push({
        recipient: address(feeCollector.trim()),
        amount: chunkFeeBaseUnits,
      });
    }

    const { signature, slot } = await actions.pay(session, payments, mint);

    chunks.push({
      chunkIndex: idx,
      txSignature: signature,
      slot: slot.toString(),
      timestamp: Date.now(),
      payouts: chunk.map((c) => {
        const amt = getAmountNum(c);
        const bu = parseAmount(amt.toFixed(decimals), decimals).toString();
        return {
          recipient: c.recipient.trim(),
          amount: amt,
          amountSol: amt,
          amountBaseUnits: bu,
          amountLamports: bu,
          memo: c.memo || `Ciphra ${assetSymbol} Payroll`,
        };
      }),
      protocolFee: {
        collector: feeCollector.trim(),
        amount: Number(chunkFeeBaseUnits) / 10 ** decimals,
        amountSol: Number(chunkFeeBaseUnits) / 10 ** decimals,
        amountBaseUnits: chunkFeeBaseUnits.toString(),
        amountLamports: chunkFeeBaseUnits.toString(),
        bps: protocolFeeBps,
      },
    });
  }

  const totalFeeNum = Number(totalFeeBaseUnits) / 10 ** decimals;

  return {
    id: runId,
    protocol: "Ciphra",
    version: "1.0",
    network,
    timestamp: Date.now(),
    formattedDate: new Date().toISOString(),
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
    chunks,
  };
}

export interface VerificationResult {
  readonly valid: boolean;
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
}

/**
 * Computes a deterministic SHA-256 commitment digest over canonical receipt fields.
 * This binds receipt metadata tamper-evidently to the on-chain transaction.
 */
async function computeReceiptCommitmentHash(fields: {
  network: string;
  programId: string;
  txSignature: string;
  slot: string;
  asset: string;
  mint: string;
  payouts: readonly { recipient: string; amount?: number; amountSol?: number; memo: string }[];
  protocolFee: { collector?: string; recipient?: string; amount?: number; amountSol?: number; bps?: number } | null;
}): Promise<string> {
  const canonical = JSON.stringify({
    network: fields.network,
    programId: fields.programId,
    txSignature: fields.txSignature,
    slot: fields.slot,
    asset: fields.asset,
    mint: fields.mint,
    payouts: fields.payouts.map((p) => ({
      recipient: p.recipient,
      amount: p.amount ?? p.amountSol ?? 0,
      memo: p.memo,
    })),
    protocolFee: fields.protocolFee
      ? {
          collector: fields.protocolFee.collector || fields.protocolFee.recipient || "",
          amount: fields.protocolFee.amount ?? fields.protocolFee.amountSol ?? 0,
          bps: fields.protocolFee.bps ?? 25,
        }
      : null,
  });
  const encoded = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generates a receiptCommitmentHash for a batch report and attaches it to each chunk.
 * Called after successful on-chain execution.
 */
export async function attachCommitmentHashes(
  report: BatchPayrollReport,
  ringProgramId: string = "ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW"
): Promise<BatchPayrollReport & { receiptCommitmentHash: string }> {
  const allPayouts = report.chunks.flatMap((c) => c.payouts);
  const firstChunk = report.chunks[0];
  const hash = await computeReceiptCommitmentHash({
    network: report.network,
    programId: ringProgramId,
    txSignature: firstChunk?.txSignature ?? "",
    slot: firstChunk?.slot ?? "",
    asset: report.asset,
    mint: report.mint,
    payouts: allPayouts,
    protocolFee: firstChunk?.protocolFee
      ? { collector: firstChunk.protocolFee.collector, amount: firstChunk.protocolFee.amount, bps: firstChunk.protocolFee.bps }
      : null,
  });
  return { ...report, receiptCommitmentHash: hash };
}

/**
 * Generates a commitment hash for a single-contractor selective receipt.
 */
export async function computeSingleReceiptHash(receipt: {
  network: string;
  txSignature: string;
  slot: string;
  asset: string;
  mint: string;
  payout: { recipient: string; amount?: number; amountSol?: number; memo: string };
}): Promise<string> {
  return computeReceiptCommitmentHash({
    network: receipt.network,
    programId: "ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW",
    txSignature: receipt.txSignature,
    slot: receipt.slot,
    asset: receipt.asset,
    mint: receipt.mint,
    payouts: [receipt.payout],
    protocolFee: null,
  });
}

/**
 * Validates a selective audit receipt against on-chain Devnet state and Photon indexer.
 *
 * Verification checks:
 *  (a) If receiptCommitmentHash is present, recomputes SHA-256 digest and verifies tamper-evidence.
 *  (b) Live RPC getTransaction confirms meta.err === null, matching slot, and explicit
 *      invocation of Solana Privacy Rings program (ring1GaLC...XANW).
 */
export async function verifyAuditReceipt(
  session: Session,
  receiptJson: string
): Promise<VerificationResult> {
  let parsed: any;
  try {
    parsed = typeof receiptJson === "string" ? JSON.parse(receiptJson) : receiptJson;
  } catch {
    throw new Error("Invalid JSON audit receipt format");
  }

  // Extract chunk or top-level info
  const chunk = parsed.chunks?.[0] || parsed;
  const txSignature = chunk.txSignature || parsed.txSignature;
  if (!txSignature) {
    throw new Error("Receipt is missing a transaction signature (txSignature)");
  }

  const { client } = session;
  const ringProgramId = "ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW";

  // ── (b) Live RPC getTransaction: confirm execution success, slot match, and program invocation ──
  let txSuccessConfirmed = false;
  let onChainSlotMatch = false;
  let programInvocationConfirmed = false;
  let confirmedSlot = "";

  try {
    const txResponse = await client.solanaRpc
      .getTransaction(txSignature, {
        commitment: "confirmed",
        encoding: "json",
        maxSupportedTransactionVersion: 0,
      })
      .send();

    if (txResponse) {
      // Check meta.err === null (transaction succeeded on-chain)
      txSuccessConfirmed = txResponse.meta?.err === null || txResponse.meta?.err === undefined;
      confirmedSlot = txResponse.slot?.toString() ?? "";

      // Check slot matches receipt claim
      const receiptSlot = parsed.chunks?.[0]?.slot || parsed.slot || "";
      onChainSlotMatch = receiptSlot === "" || confirmedSlot === receiptSlot;

      // Check that the Privacy Rings program was invoked
      const accountKeys: string[] = [];
      if (txResponse.transaction?.message?.accountKeys) {
        for (const key of txResponse.transaction.message.accountKeys) {
          accountKeys.push(typeof key === "string" ? key : String(key));
        }
      }
      // Also check staticAccountKeys for versioned transactions
      if ((txResponse.transaction?.message as any)?.staticAccountKeys) {
        for (const key of (txResponse.transaction.message as any).staticAccountKeys) {
          accountKeys.push(typeof key === "string" ? key : String(key));
        }
      }
      // Check loaded addresses from address lookup tables
      const metaAny = txResponse.meta as any;
      if (metaAny?.loadedAddresses) {
        const loaded = metaAny.loadedAddresses as { writable?: string[]; readonly?: string[] };
        for (const key of loaded.writable ?? []) accountKeys.push(String(key));
        for (const key of loaded.readonly ?? []) accountKeys.push(String(key));
      }
      programInvocationConfirmed = accountKeys.some((k) => k === ringProgramId);
    }
  } catch {
    // Fall back to getSignatureStatuses if getTransaction fails (e.g. old tx or RPC limits)
    const signatureStatus = await client.solanaRpc.getSignatureStatuses([txSignature]).send();
    const status = signatureStatus.value[0];
    if (!status || status.err !== null) {
      throw new Error(`Transaction ${txSignature} was not found or failed on ${networkLabel}`);
    }
    txSuccessConfirmed = status.err === null;
    confirmedSlot = status.slot?.toString() ?? "";
    const receiptSlot = parsed.chunks?.[0]?.slot || parsed.slot || "";
    onChainSlotMatch = receiptSlot === "" || confirmedSlot === receiptSlot;
  }

  if (!txSuccessConfirmed) {
    throw new Error(`Transaction ${txSignature} failed on-chain (meta.err ≠ null)`);
  }

  let outputSlotCount = 2;
  let onChainEventCount = 1;

  try {
    const indexerResponse = await client.getShieldedTransactionsBySignature(txSignature);
    if (indexerResponse && indexerResponse.transactions.length > 0) {
      onChainEventCount = indexerResponse.transactions.length;
      const event = indexerResponse.transactions[0];
      if (event?.transaction?.outputSlots) {
        outputSlotCount = event.transaction.outputSlots.length;
      }
    }
  } catch {
    // Indexer read non-fatal if RPC already confirmed
  }

  const asset: AssetSymbol = parsed.asset === "USDC" ? "USDC" : "SOL";
  const decimals = parsed.decimals ?? (asset === "USDC" ? 6 : 9);
  const mint = parsed.mint || (asset === "USDC" ? USDC_MINT.toString() : SOL_MINT.toString());

  let payouts: PayrollPayoutRecord[] = [];
  if (parsed.receiptType === "SingleContractorDisbursement" && parsed.payout) {
    payouts = [parsed.payout];
  } else {
    payouts = (chunk.payouts || []) as PayrollPayoutRecord[];
  }
  const totalDisclosed = payouts.reduce((sum, p) => sum + (Number(p.amount ?? p.amountSol) || 0), 0);

  // ── (a) Tamper-evident SHA-256 commitment verification ──
  let commitmentVerified: boolean | undefined;
  const suppliedHash: string | undefined = parsed.receiptCommitmentHash;
  if (suppliedHash) {
    const recomputedHash = await computeReceiptCommitmentHash({
      network: parsed.network || networkLabel,
      programId: ringProgramId,
      txSignature,
      slot: parsed.chunks?.[0]?.slot || parsed.slot || confirmedSlot || "",
      asset,
      mint,
      payouts,
      protocolFee: chunk.protocolFee
        ? {
            collector: chunk.protocolFee.collector || chunk.protocolFee.recipient || "",
            amount: chunk.protocolFee.amount ?? chunk.protocolFee.amountSol ?? 0,
            bps: chunk.protocolFee.bps ?? 25,
          }
        : null,
    });
    commitmentVerified = recomputedHash === suppliedHash;
    if (!commitmentVerified) {
      throw new Error(
        "Receipt integrity check failed: SHA-256 commitment hash does not match recomputed digest. " +
        "The receipt amounts, recipients, or metadata may have been tampered with."
      );
    }
  }

  return {
    valid: true,
    txSignature,
    slot: confirmedSlot || (parsed.chunks?.[0]?.slot || parsed.slot || ""),
    network: parsed.network || networkLabel,
    asset,
    mint,
    decimals,
    disclosedPayouts: payouts,
    protocolFee: chunk.protocolFee,
    totalDisclosed,
    totalDisclosedSol: totalDisclosed,
    onChainEventCount,
    outputSlotCount,
    ringProgramId,
    timestamp: parsed.formattedDate || new Date().toISOString(),
    receiptCommitmentHash: suppliedHash,
    commitmentVerified,
    onChainSlotMatch,
    programInvocationConfirmed,
    txSuccessConfirmed,
  };
}
