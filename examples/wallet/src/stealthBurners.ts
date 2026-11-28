import {
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getTransactionDecoder,
  getBase64Encoder,
  isAddress,
  signTransactionWithSigners,
  type Address,
  type Base64EncodedWireTransaction,
  type KeyPairSigner,
} from "@solana/kit";

/** 0.50% platform fee on a stealth-burner swap quote. */
export const STEALTH_BURNER_FEE_BPS = 50;

/** One stealth unshield cannot exceed 0.1 SOL. */
export const STEALTH_UNSHIELD_CAP_LAMPORTS = 100_000_000n;

/** One stealth unshield cannot exceed 100 USDC (6 decimals). */
export const STEALTH_UNSHIELD_CAP_USDC_BASE_UNITS = 100_000_000n;

export interface EphemeralBurner {
  readonly address: Address;
  readonly createdAt: number;
  /** Non-extractable. Callers keep this only in memory. */
  readonly signer: KeyPairSigner;
}

export interface StealthSwapQuote {
  readonly network: "devnet";
  readonly inputMint: string;
  readonly outputMint: string;
  readonly amountBaseUnits: string;
  readonly feeBps: number;
  readonly platformFeeBaseUnits: string;
  readonly netSwapAmountBaseUnits: string;
  readonly route: "jupiter-devnet-stub";
  readonly note: string;
}

let currentBurner: EphemeralBurner | undefined;

export function assertStealthBurnerNetwork(networkName: string, mainnetUnlocked = false): void {
  if (networkName === "devnet") return;
  if (networkName === "mainnet" && mainnetUnlocked) return;
  throw new Error("Stealth burners run on devnet only. Refusing network " + networkName + ".");
}

export function stealthUnshieldCap(asset: "SOL" | "USDC"): bigint {
  return asset === "SOL" ? STEALTH_UNSHIELD_CAP_LAMPORTS : STEALTH_UNSHIELD_CAP_USDC_BASE_UNITS;
}

/** Integer fee in base units. Truncates the remainder, matching payroll fee math. */
export function calculateStealthFee(amountBaseUnits: bigint, feeBps: number): bigint {
  if (amountBaseUnits < 0n) throw new Error("amountBaseUnits must be non-negative.");
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    throw new Error("feeBps must be an integer from 0 to 10000.");
  }
  return (amountBaseUnits * BigInt(feeBps)) / 10_000n;
}

/**
 * Picks the protocol fee treasury.
 * Mainnet refuses a missing collector and refuses the connected wallet.
 * Devnet uses an explicit collector, then `VITE_PROTOCOL_FEE_COLLECTOR`, then the sender.
 */
export function pickProtocolFeeCollector(input: {
  readonly networkName: string;
  readonly senderAddress: string;
  readonly explicit?: string;
  readonly envCollector?: string;
  readonly explicitIsAddress: (value: string) => boolean;
}): string {
  const explicit = input.explicit?.trim() ?? "";
  const fromEnv = input.envCollector?.trim() ?? "";
  const chosen = explicit !== "" ? explicit : fromEnv;
  if (chosen !== "" && !input.explicitIsAddress(chosen)) {
    throw new Error(
      "Protocol fee collector is not a Solana address. Set VITE_PROTOCOL_FEE_COLLECTOR to a treasury address.",
    );
  }
  if (input.networkName !== "devnet") {
    if (chosen === "" || chosen === input.senderAddress) {
      throw new Error(
        "Set VITE_PROTOCOL_FEE_COLLECTOR to a protocol treasury. Protocol fees must not default to the connected wallet.",
      );
    }
    return chosen;
  }
  return chosen === "" ? input.senderAddress : chosen;
}

/**
 * New in-memory ed25519 signer. The key is a non-extractable CryptoKey.
 * This function never reads or writes localStorage or sessionStorage.
 * Rotating replaces the module reference so the previous key can be collected.
 */
export async function createEphemeralBurner(networkName: string, mainnetUnlocked = false): Promise<EphemeralBurner> {
  assertStealthBurnerNetwork(networkName, mainnetUnlocked);
  const signer = await generateKeyPairSigner();
  const burner: EphemeralBurner = {
    address: signer.address,
    createdAt: Date.now(),
    signer,
  };
  currentBurner = burner;
  return burner;
}

/** Drops the module reference. The caller must drop its own reference too. */
export function wipeEphemeralBurner(burner?: EphemeralBurner): void {
  if (burner === undefined || currentBurner?.address === burner.address) {
    currentBurner = undefined;
  }
}

/**
 * Devnet quote only. No Jupiter request is made.
 * Net amount is the input minus the 50 bps platform fee.
 */
export function quoteStealthBurnerSwapStub(
  networkName: string,
  amountBaseUnits: bigint,
  inputMint: string,
  outputMint: string,
  feeBps: number = STEALTH_BURNER_FEE_BPS,
): StealthSwapQuote {
  assertStealthBurnerNetwork(networkName);
  if (amountBaseUnits <= 0n) throw new Error("Swap amount must be positive.");
  const platformFeeBaseUnits = calculateStealthFee(amountBaseUnits, feeBps);
  const net = amountBaseUnits - platformFeeBaseUnits;
  return {
    network: "devnet",
    inputMint,
    outputMint,
    amountBaseUnits: amountBaseUnits.toString(),
    feeBps,
    platformFeeBaseUnits: platformFeeBaseUnits.toString(),
    netSwapAmountBaseUnits: net.toString(),
    route: "jupiter-devnet-stub",
    note: "Devnet stub. No Jupiter route is requested and no swap is sent.",
  };
}

export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const JUPITER_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const RELAYER_UNAVAILABLE_NOTICE = "No relayer server is running. The connected wallet pays the transaction fee.";

/** Live Jupiter stays off unless the app is on an unlocked mainnet or the flag is exactly "true". */
export function liveJupiterEnabled(networkName: string, flag: string | undefined): boolean {
  return networkName === "mainnet" || flag === "true";
}

/**
 * Jupiter collects the platform fee in one mint of the pair.
 * Prefer the output mint. Only WSOL and USDC are accepted, so a meme-coin pair fails.
 */
export function selectJupiterFeeAccount(input: {
  readonly inputMint: string;
  readonly outputMint: string;
  readonly wsolAta?: string;
  readonly usdcAta?: string;
}): string {
  const hasWsol = input.inputMint === WSOL_MINT || input.outputMint === WSOL_MINT;
  const hasUsdc = input.inputMint === JUPITER_USDC_MINT || input.outputMint === JUPITER_USDC_MINT;
  if (!hasWsol && !hasUsdc) {
    throw new Error("Jupiter fee hook only collects WSOL or USDC. This pair has neither.");
  }
  const outputIsWsol = input.outputMint === WSOL_MINT;
  const outputIsUsdc = input.outputMint === JUPITER_USDC_MINT;
  const useWsol = outputIsWsol || (!outputIsUsdc && hasWsol);
  if (useWsol) {
    const ata = input.wsolAta?.trim() ?? "";
    if (ata === "") throw new Error("Set VITE_FEE_ATA_WSOL to the WSOL fee token account.");
    return ata;
  }
  const ata = input.usdcAta?.trim() ?? "";
  if (ata === "") throw new Error("Set VITE_FEE_ATA_USDC to the USDC fee token account.");
  return ata;
}

/** Refuses an amount above the burner balance, and above the devnet cap when the network is devnet. */
export function clampStealthSwapAmount(input: {
  readonly requested: bigint;
  readonly burnerBalance: bigint;
  readonly networkName: string;
  readonly asset: "SOL" | "USDC";
}): bigint {
  if (input.requested <= 0n) throw new Error("Swap amount must be positive.");
  let cap = input.burnerBalance;
  if (input.networkName === "devnet") {
    const devnetCap = stealthUnshieldCap(input.asset);
    if (devnetCap < cap) cap = devnetCap;
  }
  if (input.requested > cap) {
    throw new Error(
      input.networkName === "devnet"
        ? "Swap amount exceeds the burner balance or the devnet cap."
        : "Swap amount exceeds the burner balance.",
    );
  }
  return input.requested;
}

export async function fetchRelayerStatus(fetchImpl: typeof fetch = fetch): Promise<
  | { readonly active: true; readonly pubkey: Address }
  | { readonly active: false; readonly notice: string }
> {
  try {
    const response = await fetchImpl("/api/relay");
    if (!response.ok) return { active: false, notice: RELAYER_UNAVAILABLE_NOTICE };
    const body = await response.json() as { pubkey?: string };
    if (body.pubkey === undefined || !isAddress(body.pubkey)) {
      return { active: false, notice: RELAYER_UNAVAILABLE_NOTICE };
    }
    return { active: true, pubkey: body.pubkey };
  } catch {
    return { active: false, notice: RELAYER_UNAVAILABLE_NOTICE };
  }
}

export async function submitRelayedTransaction(wireBase64: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl("/api/relay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: wireBase64 }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text === "" ? "Relayer rejected the transaction." : text);
  }
  const body = JSON.parse(text) as { signature?: string };
  if (body.signature === undefined || body.signature === "") {
    throw new Error("Relayer did not return a signature.");
  }
  return body.signature;
}

export interface LiveJupiterConfig {
  readonly networkName: string;
  readonly liveJupiterFlag?: string;
  readonly wsolAta?: string;
  readonly usdcAta?: string;
  readonly jupiterBaseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

function jupiterBase(config: LiveJupiterConfig): string {
  return config.jupiterBaseUrl ?? "/api/jupiter";
}

export async function quoteLiveJupiterSwap(
  networkName: string,
  amountBaseUnits: bigint,
  inputMint: string,
  outputMint: string,
  config: LiveJupiterConfig,
): Promise<JupiterQuoteResponse> {
  if (!liveJupiterEnabled(networkName, config.liveJupiterFlag)) {
    throw new Error("Live Jupiter is disabled. Devnet uses the stub quote.");
  }
  if (amountBaseUnits <= 0n) throw new Error("Swap amount must be positive.");
  selectJupiterFeeAccount({
    inputMint,
    outputMint,
    ...(config.wsolAta === undefined ? {} : { wsolAta: config.wsolAta }),
    ...(config.usdcAta === undefined ? {} : { usdcAta: config.usdcAta }),
  });
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountBaseUnits.toString(),
    slippageBps: "50",
    platformFeeBps: String(STEALTH_BURNER_FEE_BPS),
  });
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(`${jupiterBase(config)}/quote?${params.toString()}`);
  if (!response.ok) throw new Error("Jupiter quote failed: " + (await response.text()));
  const quote = await response.json() as JupiterQuoteResponse;
  if (quote.inputMint !== inputMint || quote.outputMint !== outputMint) {
    throw new Error("Jupiter quote mint does not match the request.");
  }
  return quote;
}

export interface JupiterQuoteResponse {
  readonly inputMint: string;
  readonly outputMint: string;
  readonly inAmount: string;
  readonly outAmount: string;
}

export interface SwapSender {
  send(wireBase64: Base64EncodedWireTransaction): Promise<string>;
}

/**
 * Builds the Jupiter swap transaction for the in-memory burner and submits it.
 * The burner key signs. It is not written to browser storage.
 */
export async function executeStealthBurnerSwap(
  burner: EphemeralBurner,
  quoteResponse: JupiterQuoteResponse,
  rpc: SwapSender,
  config: LiveJupiterConfig,
): Promise<{ signature: string }> {
  if (!liveJupiterEnabled(config.networkName, config.liveJupiterFlag)) {
    throw new Error("Live Jupiter is disabled. Devnet uses the stub quote.");
  }
  const feeAccount = selectJupiterFeeAccount({
    inputMint: quoteResponse.inputMint,
    outputMint: quoteResponse.outputMint,
    ...(config.wsolAta === undefined ? {} : { wsolAta: config.wsolAta }),
    ...(config.usdcAta === undefined ? {} : { usdcAta: config.usdcAta }),
  });
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(`${jupiterBase(config)}/swap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: burner.address,
      feeAccount,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      platformFeeBps: STEALTH_BURNER_FEE_BPS,
    }),
  });
  if (!response.ok) throw new Error("Jupiter swap build failed: " + (await response.text()));
  const body = await response.json() as { swapTransaction?: string };
  if (body.swapTransaction === undefined || body.swapTransaction === "") {
    throw new Error("Jupiter did not return a swap transaction.");
  }
  const transaction = getTransactionDecoder().decode(getBase64Encoder().encode(body.swapTransaction));
  const signed = await signTransactionWithSigners([burner.signer], transaction);
  const signature = await rpc.send(getBase64EncodedWireTransaction(signed));
  return { signature };
}
