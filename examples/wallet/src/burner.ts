/// <reference lib="dom" />
/// <reference types="vite/client" />
// Session secrets stay in this module's memory. Nothing here writes a private
// key, seed, or shielded key into localStorage or sessionStorage.
import { ED25519_SEED_LEN, ed25519DerivationMessage, type Bytes32 } from "@heliuslabs/spr/keypair";
import {
  address,
  getAddressEncoder,
  isSignatureBytes,
  type Address,
  type SignatureBytes,
  type SignatureDictionary,
  type TransactionPartialSigner,
} from "@solana/kit";

/** Legacy storage name. Still exported so startup can delete leftover copies. */
export const burnerStorageKey = (network: string) => `zolana-example-burner-v0.6.0-${network}`;

export const FUNDED_PAYER_ADDRESS = "CochByMjwdvZTWVPK4GqV3po66TmnjLvBxsC3wexTHQ1";

export type WalletType = "demo" | "phantom" | "solflare" | "burner";

export interface ConnectedWalletInfo {
  type: WalletType;
  address: string;
  isExternal: boolean;
  name: string;
}

/** Shielded keys for a connected wallet: the 64-byte signature over `ed25519DerivationMessage`. */
export interface WalletSessionUnlock {
  readonly kind: "wallet-signature";
  readonly solanaPublicKey: Address;
  readonly derivationSeed: Uint8Array;
  readonly signer: TransactionPartialSigner;
}

interface BrowserWalletProvider {
  connect: () => Promise<{ publicKey?: { toString(): string } } | undefined>;
  publicKey?: { toString(): string };
  signMessage?: (message: Uint8Array, display?: string) => Promise<{ signature?: Uint8Array } | Uint8Array>;
  disconnect?: () => Promise<void> | void;
  isPhantom?: boolean;
  isSolflare?: boolean;
}

interface LocalMaterial {
  seed: Uint8Array;
  origin: "funded" | "burner" | "e2e";
}

interface ConnectedWallet {
  type: "phantom" | "solflare";
  address: string;
  network: string;
  solanaPublicKey: Address;
  derivationSeed: Uint8Array;
  signer: TransactionPartialSigner;
  provider: BrowserWalletProvider;
}

const localKeys = new Map<string, LocalMaterial>();
let connected: ConnectedWallet | null = null;

const PERSISTED_SECRET_KEYS = [
  "zolana-example-burner",
  burnerStorageKey("devnet"),
  burnerStorageKey("mainnet"),
  "ciphra_wallet_seed",
  "ciphra_use_funded",
  "veilpay_use_funded",
  "ciphra_wallet_type",
  "ciphra_wallet_address",
];

function wipe(bytes: Uint8Array | undefined): void {
  bytes?.fill(0);
}

/** Deletes leftover plaintext secrets from earlier builds. Public payroll receipts are left alone. */
export function purgePersistedSecrets(): void {
  if (typeof localStorage === "undefined") return;
  for (const key of PERSISTED_SECRET_KEYS) localStorage.removeItem(key);
  if (typeof localStorage.key !== "function" || typeof localStorage.length !== "number") return;
  const found: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null) found.push(key);
  }
  for (const key of found) {
    if (
      key.startsWith("ciphra_wallet_seed_") ||
      key.startsWith("zolana-example-burner") ||
      key.startsWith("veilpay_wallet_seed_")
    ) {
      localStorage.removeItem(key);
    }
  }
}

function viteEnv(): ImportMetaEnv | undefined {
  return import.meta.env;
}

/**
 * Reads the pre-funded keypair bytes strictly from `VITE_FUNDED_KEYPAIR`.
 * Returns null when the variable is absent. The bytes are not written to browser storage.
 */
export function getFundedKeypairBytes(): Uint8Array | null {
  const envVal = viteEnv()?.VITE_FUNDED_KEYPAIR;
  if (envVal === undefined || envVal === "") return null;
  const trimmed = envVal.trim();
  try {
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed) && (parsed.length === 32 || parsed.length === 64)) {
        const bytes: number[] = [];
        for (const entry of parsed.slice(0, 32)) {
          if (typeof entry !== "number") return null;
          bytes.push(entry);
        }
        return new Uint8Array(bytes);
      }
    }
    if (/^[0-9a-fA-F]{64,128}$/.test(trimmed)) {
      const hex = trimmed.slice(0, 64);
      const pairs = hex.match(/../g);
      if (pairs === null) return null;
      const out = new Uint8Array(pairs.length);
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (pair === undefined) return null;
        out[i] = Number.parseInt(pair, 16);
      }
      return out;
    }
  } catch {
    return null;
  }
  return null;
}

export function hasFundedDevnetPayer(): boolean {
  return getFundedKeypairBytes() !== null;
}

function consumeDevSeed(): Uint8Array | null {
  if (viteEnv()?.DEV !== true) return null;
  const host = globalThis as { __ciphraE2ESeed?: unknown };
  const hex = host.__ciphraE2ESeed;
  if (typeof hex !== "string" || !/^[0-9a-f]{64}$/i.test(hex)) return null;
  delete host.__ciphraE2ESeed;
  return Uint8Array.from(hex.match(/../g) ?? [], (byte) => Number.parseInt(byte, 16));
}

export function getActiveWalletInfo(currentSignerAddress?: string): ConnectedWalletInfo {
  if (connected !== null) {
    const name = connected.type === "phantom" ? "Phantom" : "Solflare";
    return { type: connected.type, address: connected.address, isExternal: true, name };
  }
  const funded = hasFundedDevnetPayer();
  const addressText = currentSignerAddress || (funded ? FUNDED_PAYER_ADDRESS : "");
  return {
    type: funded ? "demo" : "burner",
    address: addressText,
    isExternal: false,
    name: funded ? "Demo Payer" : "Burner",
  };
}

function walletProvider(type: "phantom" | "solflare"): BrowserWalletProvider {
  const win = window as {
    phantom?: { solana?: BrowserWalletProvider };
    solana?: BrowserWalletProvider;
    solflare?: BrowserWalletProvider;
  };
  if (type === "phantom") {
    const provider = win.phantom?.solana || win.solana;
    if (!provider?.isPhantom) {
      throw new Error("Phantom wallet extension not detected. Please install Phantom from https://phantom.app");
    }
    return provider;
  }
  const provider = win.solflare;
  if (!provider?.isSolflare) {
    throw new Error("Solflare wallet extension not detected. Please install Solflare from https://solflare.com");
  }
  return provider;
}

async function signWithProvider(provider: BrowserWalletProvider, message: Uint8Array): Promise<SignatureBytes> {
  if (typeof provider.signMessage !== "function") {
    throw new Error("Connected wallet does not support signMessage for shielded key derivation.");
  }
  const sigRes = await provider.signMessage(message, "utf8");
  const signature = sigRes instanceof Uint8Array ? sigRes : sigRes.signature;
  const candidate = signature ?? new Uint8Array();
  if (!isSignatureBytes(candidate)) {
    throw new Error(
      `Wallet signature must be ${String(ED25519_SEED_LEN)} bytes (ED25519_SEED_LEN) to derive shielded keys.`,
    );
  }
  return candidate;
}

function partialSigner(solanaPublicKey: Address, provider: BrowserWalletProvider): TransactionPartialSigner {
  return {
    address: solanaPublicKey,
    async signTransactions(transactions): Promise<readonly SignatureDictionary[]> {
      const signed: SignatureDictionary[] = [];
      for (const tx of transactions) {
        const signature = await signWithProvider(provider, new Uint8Array(tx.messageBytes));
        signed.push({ [solanaPublicKey]: signature });
      }
      return signed;
    },
  };
}

/**
 * Connects Phantom or Solflare and keeps the shielded derivation seed in memory.
 * The seed is the wallet signature over `ed25519DerivationMessage(publicKey)`,
 * which `LocalKeys.fromDerivationSeed` verifies. It is not a Solana private key.
 */
export async function connectBrowserWallet(
  type: "phantom" | "solflare",
  network: string,
): Promise<{ address: string; unlock: WalletSessionUnlock }> {
  purgePersistedSecrets();
  const provider = walletProvider(type);
  const response = await provider.connect();
  const pubkeyStr = (response?.publicKey || provider.publicKey)?.toString();
  if (pubkeyStr === undefined || pubkeyStr === "") {
    throw new Error("Failed to retrieve public key from wallet.");
  }
  const solanaPublicKey = address(pubkeyStr);
  const publicKey = new Uint8Array(getAddressEncoder().encode(solanaPublicKey)) as Bytes32;
  const derivationSeed = await signWithProvider(provider, ed25519DerivationMessage(publicKey));
  if (connected !== null) wipe(connected.derivationSeed);
  const signer = partialSigner(solanaPublicKey, provider);
  connected = { type, address: pubkeyStr, network, solanaPublicKey, derivationSeed, signer, provider };
  return {
    address: pubkeyStr,
    unlock: { kind: "wallet-signature", solanaPublicKey, derivationSeed, signer },
  };
}

/** Signs with the connected wallet when one is in memory. Returns null otherwise. */
export async function signConnectedWalletMessage(message: Uint8Array): Promise<Uint8Array | null> {
  if (connected === null) return null;
  return signWithProvider(connected.provider, message);
}

export function disconnectBrowserWallet(network: string = "devnet"): void {
  const win = window as {
    phantom?: { solana?: BrowserWalletProvider };
    solana?: BrowserWalletProvider;
    solflare?: BrowserWalletProvider;
  };
  try {
    if (win.phantom?.solana?.disconnect) void win.phantom.solana.disconnect();
    else if (win.solana?.disconnect) void win.solana.disconnect();
    if (win.solflare?.disconnect) void win.solflare.disconnect();
  } catch {
    // Ignore a wallet that is already gone.
  }
  if (connected !== null) wipe(connected.derivationSeed);
  connected = null;
  wipe(localKeys.get(network)?.seed);
  localKeys.delete(network);
  purgePersistedSecrets();
}

export function loadBurnerSeed(network: string): Uint8Array {
  purgePersistedSecrets();
  const injected = consumeDevSeed();
  if (injected !== null) {
    const previous = localKeys.get(network);
    if (previous !== undefined) wipe(previous.seed);
    localKeys.set(network, { seed: injected, origin: "e2e" });
    return injected;
  }
  const existing = localKeys.get(network);
  if (existing !== undefined) return existing.seed;

  if (network === "devnet") {
    const funded = getFundedKeypairBytes();
    if (funded !== null) {
      localKeys.set(network, { seed: funded, origin: "funded" });
      return funded;
    }
  }

  const seed = crypto.getRandomValues(new Uint8Array(32));
  localKeys.set(network, { seed, origin: "burner" });
  return seed;
}

export function loadFundedDevnetSeed(network: string): Uint8Array {
  purgePersistedSecrets();
  if (connected !== null) {
    wipe(connected.derivationSeed);
    connected = null;
  }
  const seed = getFundedKeypairBytes();
  if (seed !== null) {
    const previous = localKeys.get(network);
    if (previous !== undefined) wipe(previous.seed);
    localKeys.set(network, { seed, origin: "funded" });
    return seed;
  }
  return loadBurnerSeed(network);
}

/** What `openSession` should unlock with: a wallet derivation signature, or a 32-byte local key. */
export function sessionUnlock(network: string): Uint8Array | WalletSessionUnlock {
  if (connected !== null && connected.network === network) {
    return {
      kind: "wallet-signature",
      solanaPublicKey: connected.solanaPublicKey,
      derivationSeed: connected.derivationSeed,
      signer: connected.signer,
    };
  }
  return loadBurnerSeed(network);
}

export function resetBurner(network: string): void {
  if (connected !== null) wipe(connected.derivationSeed);
  connected = null;
  const existing = localKeys.get(network);
  if (existing !== undefined) wipe(existing.seed);
  localKeys.delete(network);
  purgePersistedSecrets();
}

function wipeAllSecrets(): void {
  if (connected !== null) wipe(connected.derivationSeed);
  connected = null;
  for (const entry of localKeys.values()) wipe(entry.seed);
  localKeys.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", wipeAllSecrets);
}
