import { ShieldedAddress, X25519PublicKey } from "@heliuslabs/spr/keypair";

export type AuditIntegrity = "VERIFIED" | "TAMPERED" | "FAILED" | "NOTHING_TO_VERIFY" | "UNSUPPORTED_RECEIPT";

export interface AuditNote {
  readonly amountBaseUnits: string;
  readonly role: "recipient" | "sender-change" | "opened-note";
  /**
   * Hex of the X25519 viewing public key the slot was encrypted to.
   * Employer mode pairs this with the amount. It is the viewing-key suffix of
   * the recipient shielded address (`signing || nullifier || viewing`).
   */
  readonly recipientViewingKey?: string;
  /**
   * Set only when this zero-amount output was proven to be shape padding.
   * A zero note without this flag is a real output and stays in the comparison.
   */
  readonly paddingProven?: boolean;
}

export interface CompareAuditContext {
  /** Hex shielded address of the wallet whose viewing key opened the paystub notes. */
  readonly paystubShieldedAddress?: string;
  /** Solana address that signed the transfer. A protocol fee paid here is sender change. */
  readonly senderAddress?: string;
  /** Hex shielded address of that sender, when the session has one. */
  readonly senderShieldedAddress?: string;
}

const UNSUPPORTED_AMOUNT = "Unsupported receipt — an amount could not be read. Use an amountBaseUnits integer string.";

/**
 * Check order, and it is the order the tests lock in:
 *  1. Zero decrypted notes return FAILED. This runs before the empty-receipt check,
 *     so an empty receipt plus zero notes is FAILED, not NOTHING_TO_VERIFY.
 *  2. A payout or fee row whose amount cannot be read is UNSUPPORTED_RECEIPT.
 *     The row is not dropped. `amountBaseUnits` is read as an integer string.
 *  3. Notes exist, but the receipt claims no payout amount and no positive fee.
 *     That is NOTHING_TO_VERIFY. VERIFIED requires a real match.
 *  4. Any payout line without a shielded address is UNSUPPORTED_RECEIPT.
 *     There is no amount-only fallback.
 *  5. Paystub mode binds to the verifying recipient's shielded address.
 *  6. Employer mode compares (viewing key, amount) pairs. The confidential
 *     plaintext has no shielded address; the slot is encrypted to the
 *     recipient viewing key, which is the suffix of that shielded address.
 *     Proven zero padding and sender-owned change (including a protocol fee
 *     paid back to the sender) are the only outputs left out.
 *
 * Fees are not one thing on chain.
 *
 * The devnet tree's `feePerNullifier` (5000 lamports on tree 0) is a System
 * Program transfer into the tree account. It is not a confidential output, so
 * it is not a decrypted note and it is not part of this comparison.
 *
 * The app's 0.50% protocol fee is an extra confidential payment. It decrypts
 * as a note owned by the fee collector's viewing key. When that collector is
 * the sender, `decryptIndexedTransaction` marks it `sender-change` and this
 * function leaves it out of the payout multiset with the rest of the change.
 * When the collector is someone else, the note is a recipient output and the
 * receipt must name that collector's shielded address or the receipt is
 * unsupported.
 *
 * Shape padding is random ciphertext. `decodeConfidential` rejects it, and
 * those slots never become notes. A zero-amount note is dropped only when
 * `paddingProven` is set. A real zero-amount change stays, and is excluded
 * only because its owner is the sender.
 */
export function compareDecryptedAmounts(
  mode: "paystub" | "employer",
  notes: readonly AuditNote[],
  chunks: readonly any[],
  decimals: number,
  context: CompareAuditContext = {},
): { integrity: AuditIntegrity; reason: string } {
  // 1. No decrypted notes fails before an empty receipt can look like "nothing to verify".
  if (notes.length === 0) {
    return { integrity: "FAILED", reason: "Zero on-chain notes were decrypted with this key." };
  }

  const payoutRows: any[] = [];
  const feeRows: any[] = [];
  for (const chunk of chunks) {
    const rows = Array.isArray(chunk?.payouts) ? chunk.payouts : [];
    payoutRows.push(...rows);
    if (chunk?.protocolFee) feeRows.push(chunk.protocolFee);
  }
  const payoutUnits = readClaimedUnits(payoutRows, decimals);
  const feeUnits = readClaimedUnits(feeRows, decimals);
  // 2. A row that exists but cannot be parsed is unsupported. It is not ignored.
  if (payoutUnits === undefined || feeUnits === undefined) {
    return { integrity: "UNSUPPORTED_RECEIPT", reason: UNSUPPORTED_AMOUNT };
  }

  // 3. A signature with no claimed amounts has notes, but nothing to check them against.
  if (payoutUnits.length === 0 && feeUnits.every((units) => units === 0n)) {
    return { integrity: "NOTHING_TO_VERIFY", reason: "Nothing to verify — on-chain notes decrypted only" };
  }

  // 4. Amount-only matching of receipts that cannot name a shielded recipient is refused.
  if (payoutRows.some((row) => typeof row?.shieldedAddress !== "string" || row.shieldedAddress.trim() === "")) {
    return {
      integrity: "UNSUPPORTED_RECEIPT",
      reason: "Unsupported receipt — a payout line has no shielded address.",
    };
  }

  if (mode === "paystub") {
    const viewer = context.paystubShieldedAddress?.trim().toLowerCase();
    if (viewer === undefined || viewer === "") {
      return {
        integrity: "UNSUPPORTED_RECEIPT",
        reason: "Unsupported receipt — paystub verification needs the recipient shielded address.",
      };
    }
    const ownRows = payoutRows.filter((row) => samePayee(String(row.shieldedAddress), viewer));
    if (ownRows.length === 0) {
      return {
        integrity: "TAMPERED",
        reason: "This viewing key is not one of the shielded addresses on the receipt.",
      };
    }
    const claimed = readClaimedUnits(ownRows, decimals);
    if (claimed === undefined) {
      return { integrity: "UNSUPPORTED_RECEIPT", reason: UNSUPPORTED_AMOUNT };
    }
    const opened = comparableNotes(notes, "paystub").map((note) => BigInt(note.amountBaseUnits));
    return multisetVerdict(opened, claimed);
  }

  const thirdPartyFees: { viewingKey: string; units: bigint }[] = [];
  for (let index = 0; index < feeRows.length; index += 1) {
    const fee = feeRows[index];
    const units = feeUnits[index];
    if (units === undefined || units === 0n) continue;
    const ownedBySender = feeOwnedBySender(fee, context);
    if (ownedBySender === "yes") continue;
    if (ownedBySender !== "no") {
      return {
        integrity: "UNSUPPORTED_RECEIPT",
        reason: "Unsupported receipt — the protocol fee has no shielded address, so it cannot be separated from a pool charge.",
      };
    }
    const viewingKey = viewingKeyFromShieldedAddress(fee?.shieldedAddress);
    if (viewingKey === undefined) {
      return {
        integrity: "UNSUPPORTED_RECEIPT",
        reason: "Unsupported receipt — the protocol fee shielded address does not identify a viewing key.",
      };
    }
    thirdPartyFees.push({ viewingKey, units });
  }

  const claimed: string[] = [];
  for (let index = 0; index < payoutRows.length; index += 1) {
    const units = payoutUnits[index];
    if (units === undefined) return { integrity: "UNSUPPORTED_RECEIPT", reason: UNSUPPORTED_AMOUNT };
    const viewingKey = viewingKeyFromShieldedAddress(payoutRows[index]?.shieldedAddress);
    if (viewingKey === undefined) {
      return {
        integrity: "UNSUPPORTED_RECEIPT",
        reason: "Unsupported receipt — a payout shielded address does not identify a viewing key.",
      };
    }
    claimed.push(pairKey(viewingKey, units));
  }
  for (const fee of thirdPartyFees) claimed.push(pairKey(fee.viewingKey, fee.units));

  const onChain: string[] = [];
  for (const note of comparableNotes(notes, "employer")) {
    const viewingKey = noteViewingKey(note);
    if (viewingKey === undefined) {
      return {
        integrity: "UNSUPPORTED_RECEIPT",
        reason: "Unsupported receipt — a decrypted output has no recipient viewing key, so it cannot be matched to a shielded address.",
      };
    }
    onChain.push(pairKey(viewingKey, BigInt(note.amountBaseUnits)));
  }
  return multisetVerdict(onChain, claimed);
}

/**
 * Paystub mode checks one viewing key. A batch receipt verified by the sender
 * does not list that sender as a payee, so the caller must open every output
 * and use employer mode instead of reporting the payee field as missing.
 */
export function auditModeForConnectedWallet(
  requested: "paystub" | "employer",
  viewerShieldedAddress: string | undefined,
  chunks: readonly any[],
): "paystub" | "employer" {
  if (requested === "employer") return "employer";
  if (viewerShieldedAddress === undefined || viewerShieldedAddress.trim() === "") return "paystub";
  return paystubViewerIsListed(viewerShieldedAddress, chunks) ? "paystub" : "employer";
}

export function paystubViewerIsListed(viewer: string, chunks: readonly any[]): boolean {
  for (const chunk of chunks) {
    const rows = Array.isArray(chunk?.payouts) ? chunk.payouts : [];
    for (const row of rows) {
      if (typeof row?.shieldedAddress === "string" && samePayee(row.shieldedAddress, viewer)) return true;
    }
  }
  return false;
}

function samePayee(rowAddress: string, viewer: string): boolean {
  const listed = rowAddress.trim().toLowerCase().replace(/^0x/, "");
  const needle = viewer.trim().toLowerCase().replace(/^0x/, "");
  if (listed !== "" && listed === needle) return true;
  const listedKey = viewingKeyFromShieldedAddress(listed);
  const viewerKey = viewingKeyFromShieldedAddress(needle);
  return listedKey !== undefined && listedKey === viewerKey;
}

function feeOwnedBySender(fee: any, context: CompareAuditContext): "yes" | "no" | "unknown" {
  const shielded = typeof fee?.shieldedAddress === "string" ? fee.shieldedAddress.trim().toLowerCase() : "";
  const senderShielded = context.senderShieldedAddress?.trim().toLowerCase() ?? "";
  if (shielded !== "" && senderShielded !== "") return shielded === senderShielded ? "yes" : "no";
  const collector = String(fee?.collector ?? fee?.recipient ?? "").trim();
  const sender = context.senderAddress?.trim() ?? "";
  if (collector !== "" && sender !== "" && collector === sender) return "yes";
  if (shielded !== "") return "no";
  return "unknown";
}

/** Drops proven zero padding. Employer mode also drops notes the sender owns. */
function comparableNotes(notes: readonly AuditNote[], mode: "paystub" | "employer"): AuditNote[] {
  return notes.filter((note) => {
    if (note.paddingProven === true && BigInt(note.amountBaseUnits) === 0n) return false;
    if (mode === "employer" && note.role === "sender-change") return false;
    return true;
  });
}

function pairKey(viewingKey: string, units: bigint): string {
  return `${viewingKey}:${units.toString()}`;
}

function multisetVerdict<T>(onChain: readonly T[], claimed: readonly T[]): { integrity: AuditIntegrity; reason: string } {
  const check = subtractValues(onChain, claimed);
  if (check.missing.length === 0 && check.leftover.length === 0) {
    return { integrity: "VERIFIED", reason: "" };
  }
  if (check.missing.length > 0) {
    return {
      integrity: "TAMPERED",
      reason: "The receipt lists an amount that is not in the on-chain decrypted outputs.",
    };
  }
  return {
    integrity: "TAMPERED",
    reason: "An on-chain payout is missing from the receipt.",
  };
}

/** Every row must parse. `undefined` means a row was present and unreadable. */
function readClaimedUnits(rows: readonly any[], decimals: number): bigint[] | undefined {
  const units: bigint[] = [];
  for (const row of rows) {
    const parsed = claimedUnits(row, decimals);
    if (parsed === undefined) return undefined;
    units.push(parsed);
  }
  return units;
}

/**
 * `amountBaseUnits` wins, and it must be a base-10 integer string.
 * A display `amount` is accepted only when it is a decimal string, or a number
 * that round-trips through `toFixed` at this asset's scale.
 */
function claimedUnits(value: { amountBaseUnits?: unknown; amount?: unknown; amountSol?: unknown }, decimals: number): bigint | undefined {
  if (value !== null && typeof value === "object" && "amountBaseUnits" in value && value.amountBaseUnits !== undefined && value.amountBaseUnits !== null) {
    return typeof value.amountBaseUnits === "string" && /^\d+$/.test(value.amountBaseUnits)
      ? BigInt(value.amountBaseUnits)
      : undefined;
  }
  const amount = value?.amount ?? value?.amountSol;
  if (typeof amount === "string") return parseDecimalUnits(amount, decimals);
  if (typeof amount === "number") {
    if (!Number.isFinite(amount) || amount < 0) return undefined;
    const text = amount.toFixed(decimals);
    if (Number(text) !== amount) return undefined;
    return parseDecimalUnits(text, decimals);
  }
  return undefined;
}

function parseDecimalUnits(text: string, decimals: number): bigint | undefined {
  const trimmed = text.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) return undefined;
  const padded = fraction.padEnd(decimals, "0");
  const fractionUnits = padded === "" ? 0n : BigInt(padded);
  return BigInt(whole) * 10n ** BigInt(decimals) + fractionUnits;
}

function viewingKeyFromShieldedAddress(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const bytes = hexToBytes(value.trim());
  if (bytes === undefined) return undefined;
  try {
    return bytesToHex(ShieldedAddress.fromBytes(bytes).viewingPublicKey.toBytes());
  } catch {
    return undefined;
  }
}

function noteViewingKey(note: AuditNote): string | undefined {
  const bytes = note.recipientViewingKey === undefined ? undefined : hexToBytes(note.recipientViewingKey.trim());
  if (bytes === undefined) return undefined;
  try {
    return bytesToHex(X25519PublicKey.fromBytes(bytes).toBytes());
  } catch {
    return undefined;
  }
}

function hexToBytes(hex: string): Uint8Array | undefined {
  const text = hex.toLowerCase();
  if (text.length === 0 || text.length % 2 !== 0 || !/^[0-9a-f]+$/.test(text)) return undefined;
  const bytes = new Uint8Array(text.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(text.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function subtractValues<T>(haystack: readonly T[], needles: readonly T[]): { missing: T[]; leftover: T[] } {
  const left = [...haystack];
  const missing: T[] = [];
  for (const needle of needles) {
    const index = left.findIndex((value) => value === needle);
    if (index < 0) missing.push(needle);
    else left.splice(index, 1);
  }
  return { missing, leftover: left };
}
