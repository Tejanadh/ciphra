import { generateKeyPairSigner, type Address, type KeyPairSigner } from "@solana/kit";

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

export function assertStealthBurnerNetwork(networkName: string): void {
  if (networkName !== "devnet") {
    throw new Error("Stealth burners run on devnet only. Refusing network " + networkName + ".");
  }
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
export async function createEphemeralBurner(networkName: string): Promise<EphemeralBurner> {
  assertStealthBurnerNetwork(networkName);
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
