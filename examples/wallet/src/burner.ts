// A demo signer kept in browser storage, standing in for a wallet extension.
// Each network and protocol release has its own testing key.
export const burnerStorageKey = (network: string) => `zolana-example-burner-v0.6.0-${network}`;

// Public address of pre-funded Devnet payer (CochBy...HQ1)
export const FUNDED_PAYER_ADDRESS = "CochByMjwdvZTWVPK4GqV3po66TmnjLvBxsC3wexTHQ1";

export type WalletType = "demo" | "phantom" | "solflare" | "burner";

export interface ConnectedWalletInfo {
  type: WalletType;
  address: string;
  isExternal: boolean;
  name: string;
}

/**
 * Reads the pre-funded keypair bytes strictly from environment variable `VITE_FUNDED_KEYPAIR`.
 * Returns null if not provided, ensuring zero hardcoded secrets exist in the codebase.
 */
export function getFundedKeypairBytes(): Uint8Array | null {
  const envVal: string | undefined = import.meta.env.VITE_FUNDED_KEYPAIR;
  if (envVal) {
    const trimmed = envVal.trim();
    try {
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && (parsed.length === 32 || parsed.length === 64)) {
          return new Uint8Array(parsed.slice(0, 32));
        }
      }
      if (/^[0-9a-fA-F]{64,128}$/.test(trimmed)) {
        const hex = trimmed.slice(0, 64);
        return Uint8Array.from(hex.match(/../g) ?? [], (b) => Number.parseInt(b, 16));
      }
    } catch {
      // Ignore parse error and return null
    }
  }
  return null;
}

export function hasFundedDevnetPayer(): boolean {
  return getFundedKeypairBytes() !== null;
}

export function getActiveWalletInfo(currentSignerAddress?: string): ConnectedWalletInfo {
  const hasFunded = hasFundedDevnetPayer();
  const storedType = localStorage.getItem("ciphra_wallet_type") as WalletType | null;
  const type: WalletType = storedType || (hasFunded ? "demo" : "burner");
  const address = localStorage.getItem("ciphra_wallet_address") || currentSignerAddress || (hasFunded ? FUNDED_PAYER_ADDRESS : "");
  const isExternal = type === "phantom" || type === "solflare";
  const name = type === "phantom" ? "Phantom" : type === "solflare" ? "Solflare" : type === "demo" ? "Demo Payer" : "Burner";
  return { type, address, isExternal, name };
}

export async function connectBrowserWallet(type: "phantom" | "solflare"): Promise<{ address: string; seed: Uint8Array }> {
  let provider: any = null;
  const win = window as any;

  if (type === "phantom") {
    provider = win.phantom?.solana || win.solana;
    if (!provider || !provider.isPhantom) {
      throw new Error("Phantom wallet extension not detected. Please install Phantom from https://phantom.app");
    }
  } else if (type === "solflare") {
    provider = win.solflare;
    if (!provider || !provider.isSolflare) {
      throw new Error("Solflare wallet extension not detected. Please install Solflare from https://solflare.com");
    }
  }

  const response = await provider.connect();
  const pubkeyStr: string = (response?.publicKey || provider.publicKey)?.toString();
  if (!pubkeyStr) {
    throw new Error("Failed to retrieve public key from wallet.");
  }

  // Check for cached deterministic session seed
  const cacheKey = `ciphra_wallet_seed_${pubkeyStr}`;
  const cachedHex = localStorage.getItem(cacheKey);
  if (cachedHex && /^[0-9a-f]{64}$/i.test(cachedHex)) {
    const seed = Uint8Array.from(cachedHex.match(/../g) ?? [], (b) => Number.parseInt(b, 16));
    localStorage.setItem("ciphra_wallet_type", type);
    localStorage.setItem("ciphra_wallet_address", pubkeyStr);
    const netKey = burnerStorageKey("devnet");
    localStorage.setItem(netKey, cachedHex);
    localStorage.removeItem("ciphra_use_funded");
    return { address: pubkeyStr, seed };
  }

  // Prompt the user to sign an off-chain auth message to derive their zero-knowledge session seed
  const authMessage = `Ciphra Confidential Payroll Authentication\n\nSign this message to initialize zero-knowledge proving on Solana Privacy Rings.\n\nWallet: ${pubkeyStr}`;
  const encoded = new TextEncoder().encode(authMessage);
  let signature: Uint8Array;

  if (typeof provider.signMessage === "function") {
    const sigRes = await provider.signMessage(encoded, "utf8");
    signature = sigRes?.signature || sigRes;
  } else {
    throw new Error("Connected wallet does not support signMessage for zero-knowledge key derivation.");
  }

  if (!signature || signature.length < 32) {
    throw new Error("Invalid signature received from wallet.");
  }

  // Derive 32-byte Ed25519 session seed from the first 32 bytes of the signature
  const seed = signature.slice(0, 32);
  const seedHex = Array.from(seed, (byte) => byte.toString(16).padStart(2, "0")).join("");

  localStorage.setItem(cacheKey, seedHex);
  localStorage.setItem("ciphra_wallet_type", type);
  localStorage.setItem("ciphra_wallet_address", pubkeyStr);

  const netKey = burnerStorageKey("devnet");
  localStorage.setItem(netKey, seedHex);
  localStorage.removeItem("ciphra_use_funded");

  return { address: pubkeyStr, seed };
}

export function disconnectBrowserWallet(network: string = "devnet"): void {
  const win = window as any;
  try {
    if (win.phantom?.solana?.disconnect) void win.phantom.solana.disconnect();
    else if (win.solana?.disconnect) void win.solana.disconnect();
    if (win.solflare?.disconnect) void win.solflare.disconnect();
  } catch {
    // Ignore disconnect error
  }
  localStorage.removeItem("ciphra_wallet_type");
  localStorage.removeItem("ciphra_wallet_address");
  loadFundedDevnetSeed(network);
}

export function loadBurnerSeed(network: string): Uint8Array {
  const key = burnerStorageKey(network);
  const fundedSeed = getFundedKeypairBytes();
  const fundedHex = fundedSeed
    ? Array.from(fundedSeed, (byte) => byte.toString(16).padStart(2, "0")).join("")
    : null;

  // Check if an external browser wallet is active
  const walletType = localStorage.getItem("ciphra_wallet_type");
  const externalAddress = localStorage.getItem("ciphra_wallet_address");
  if ((walletType === "phantom" || walletType === "solflare") && externalAddress) {
    const cachedHex = localStorage.getItem(`ciphra_wallet_seed_${externalAddress}`);
    if (cachedHex && /^[0-9a-f]{64}$/i.test(cachedHex)) {
      return Uint8Array.from(cachedHex.match(/../g) ?? [], (b) => Number.parseInt(b, 16));
    }
  }

  if (network === "devnet" && fundedSeed && fundedHex) {
    // If explicitly requested, use funded payer
    if (localStorage.getItem("ciphra_use_funded") === "true" || localStorage.getItem("veilpay_use_funded") === "true") {
      localStorage.setItem(key, fundedHex);
      return fundedSeed;
    }
  }

  const stored = localStorage.getItem(key);
  if (stored !== null && /^[0-9a-f]{64}$/u.test(stored)) {
    return Uint8Array.from(stored.match(/../gu) ?? [], (byte) => Number.parseInt(byte, 16));
  }

  // Default to pre-funded payer if configured in .env
  if (network === "devnet" && fundedSeed && fundedHex) {
    localStorage.setItem(key, fundedHex);
    localStorage.setItem("ciphra_use_funded", "true");
    return fundedSeed;
  }

  // Otherwise generate a fresh ephemeral seed in browser storage
  const seed = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(key, Array.from(seed, (byte) => byte.toString(16).padStart(2, "0")).join(""));
  return seed;
}

export function loadFundedDevnetSeed(network: string): Uint8Array {
  const key = burnerStorageKey(network);
  const seed = getFundedKeypairBytes();
  if (seed) {
    const hex = Array.from(seed, (byte) => byte.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(key, hex);
    localStorage.setItem("ciphra_use_funded", "true");
    localStorage.setItem("ciphra_wallet_type", "demo");
    localStorage.setItem("ciphra_wallet_address", FUNDED_PAYER_ADDRESS);
    return seed;
  }
  // Gracefully fallback to ephemeral burner if no funded key is configured in .env
  return loadBurnerSeed(network);
}

export function resetBurner(network: string): void {
  localStorage.removeItem(burnerStorageKey(network));
  localStorage.removeItem("ciphra_use_funded");
  localStorage.removeItem("veilpay_use_funded");
  localStorage.removeItem("ciphra_wallet_type");
  localStorage.removeItem("ciphra_wallet_address");
}
