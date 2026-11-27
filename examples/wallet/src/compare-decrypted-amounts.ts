import { parseAmount } from "@heliuslabs/spr";

export type AuditIntegrity = "VERIFIED" | "TAMPERED" | "FAILED" | "NOTHING_TO_VERIFY" | "UNSUPPORTED_RECEIPT";

export interface AuditNote {
  readonly amountBaseUnits: string;
  readonly role: "recipient" | "sender-change" | "opened-note";
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

/**
 * Check order, and it is the order the tests lock in:
 *  1. Zero decrypted notes return FAILED. This runs before the empty-receipt check,
 *     so an empty receipt plus zero notes is FAILED, not NOTHING_TO_VERIFY.
 *  2. Notes exist, but the receipt claims no payout amount and no positive fee.
 *     That is NOTHING_TO_VERIFY. VERIFIED requires a real match.
 *  3. Any payout line without a shielded address is UNSUPPORTED_RECEIPT.
 *     There is no amount-only fallback.
 *  4. Paystub mode binds to the verifying recipient's shielded address.
 *  5. Employer mode compares a multiset. Proven zero padding and sender-owned
 *     change (including a protocol fee paid back to the sender) are the only
 *     outputs left out. Every other decrypted output stays.
 *
 * Fees are not one thing on chain.
 *
 * The devnet tree's `feePerNullifier` (5000 lamports on tree 0) is a System
 * Program transfer into the tree account. It is not a confidential output, so
 * it is not a decrypted note and it is not part of this comparison.
 *
 * The app's 0.25% protocol fee is an extra confidential payment. It decrypts
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
  const payoutUnits = payoutRows.flatMap((row) => {
    const units = claimedUnits(row, decimals);
    return units === undefined ? [] : [units];
  });
  const feeUnits = feeRows.flatMap((row) => {
    const units = claimedUnits(row, decimals);
    return units === undefined || units === 0n ? [] : [units];
  });

  // 2. A signature with no claimed amounts has notes, but nothing to check them against.
  if (payoutUnits.length === 0 && feeUnits.length === 0) {
    return { integrity: "NOTHING_TO_VERIFY", reason: "Nothing to verify — on-chain notes decrypted only" };
  }

  // 3. Amount-only matching of receipts that cannot name a shielded recipient is refused.
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
    const ownRows = payoutRows.filter((row) => String(row.shieldedAddress).trim().toLowerCase() === viewer);
    if (ownRows.length === 0) {
      return {
        integrity: "TAMPERED",
        reason: "The recipient shielded address is missing from the receipt.",
      };
    }
    const claimed = ownRows.flatMap((row) => {
      const units = claimedUnits(row, decimals);
      return units === undefined ? [] : [units];
    });
    const opened = comparableNotes(notes, "paystub").map((note) => BigInt(note.amountBaseUnits));
    return multisetVerdict(opened, claimed);
  }

  const thirdPartyFees: bigint[] = [];
  for (const fee of feeRows) {
    const units = claimedUnits(fee, decimals);
    if (units === undefined || units === 0n) continue;
    const ownedBySender = feeOwnedBySender(fee, context);
    if (ownedBySender === "yes") continue;
    if (ownedBySender === "no") {
      thirdPartyFees.push(units);
      continue;
    }
    return {
      integrity: "UNSUPPORTED_RECEIPT",
      reason: "Unsupported receipt — the protocol fee has no shielded address, so it cannot be separated from a pool charge.",
    };
  }

  const claimed = [
    ...payoutRows.flatMap((row) => {
      const units = claimedUnits(row, decimals);
      return units === undefined ? [] : [units];
    }),
    ...thirdPartyFees,
  ];
  const onChain = comparableNotes(notes, "employer").map((note) => BigInt(note.amountBaseUnits));
  return multisetVerdict(onChain, claimed);
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

function multisetVerdict(onChain: readonly bigint[], claimed: readonly bigint[]): { integrity: AuditIntegrity; reason: string } {
  const check = subtractAmounts(onChain, claimed);
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

function claimedUnits(value: { amountBaseUnits?: unknown; amount?: unknown; amountSol?: unknown }, decimals: number): bigint | undefined {
  if (typeof value.amountBaseUnits === "string" && /^\d+$/.test(value.amountBaseUnits)) {
    return BigInt(value.amountBaseUnits);
  }
  const amount = Number(value.amount ?? value.amountSol);
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  return parseAmount(amount.toFixed(decimals), decimals);
}

function subtractAmounts(haystack: readonly bigint[], needles: readonly bigint[]): { missing: bigint[]; leftover: bigint[] } {
  const left = [...haystack];
  const missing: bigint[] = [];
  for (const needle of needles) {
    const index = left.findIndex((value) => value === needle);
    if (index < 0) missing.push(needle);
    else left.splice(index, 1);
  }
  return { missing, leftover: left };
}
