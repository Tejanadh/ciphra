import assert from "node:assert/strict";
import { test } from "node:test";
import { compareDecryptedAmounts, type AuditNote } from "../src/compare-decrypted-amounts.ts";

const DECIMALS = 9;
const SENDER = "CochByMjwdvZTWVPK4GqV3po66TmnjLvBxsC3wexTHQ1";
const SENDER_SHIELDED = "sender-shielded";
const ALICE = "alice-shielded";
const BOB = "bob-shielded";
const FEE = "fee-collector-shielded";
const ZERO_NOTES = "Zero on-chain notes were decrypted with this key.";

function note(amount: bigint, role: AuditNote["role"], paddingProven?: boolean): AuditNote {
  return {
    amountBaseUnits: amount.toString(),
    role,
    ...(paddingProven === undefined ? {} : { paddingProven }),
  };
}

function line(amount: bigint, shieldedAddress?: string): { amountBaseUnits: string; shieldedAddress?: string } {
  return {
    amountBaseUnits: amount.toString(),
    ...(shieldedAddress === undefined ? {} : { shieldedAddress }),
  };
}

const employer = { senderAddress: SENDER, senderShieldedAddress: SENDER_SHIELDED };

test("1. zero decrypted notes return FAILED before the empty-receipt check", () => {
  // Empty receipt and zero notes must not become NOTHING_TO_VERIFY.
  const emptyReceipt = compareDecryptedAmounts("paystub", [], [], DECIMALS, { paystubShieldedAddress: BOB });
  assert.equal(emptyReceipt.integrity, "FAILED");
  assert.equal(emptyReceipt.reason, ZERO_NOTES);
  assert.notEqual(emptyReceipt.integrity, "NOTHING_TO_VERIFY");

  const claimedButNoNotes = compareDecryptedAmounts(
    "employer",
    [],
    [{ payouts: [line(100n, ALICE)] }],
    DECIMALS,
    employer,
  );
  assert.equal(claimedButNoNotes.integrity, "FAILED");
  assert.equal(claimedButNoNotes.reason, ZERO_NOTES);
});

test("2. a signature with decrypted notes and no claimed amounts is NOTHING_TO_VERIFY", () => {
  const result = compareDecryptedAmounts(
    "employer",
    [note(100n, "recipient")],
    [{ txSignature: "sig" }],
    DECIMALS,
    employer,
  );
  assert.equal(result.integrity, "NOTHING_TO_VERIFY");
  assert.equal(result.reason, "Nothing to verify — on-chain notes decrypted only");
});

test("3. employer mode matches payouts exactly and refuses hidden outputs, count mismatches, and unproven zeros", () => {
  const verified = compareDecryptedAmounts(
    "employer",
    [note(50n, "sender-change"), note(100n, "recipient"), note(200n, "recipient")],
    [{ payouts: [line(100n, ALICE), line(200n, BOB)] }],
    DECIMALS,
    employer,
  );
  assert.equal(verified.integrity, "VERIFIED");

  const hidden = compareDecryptedAmounts(
    "employer",
    [note(100n, "recipient"), note(200n, "recipient"), note(300n, "recipient")],
    [{ payouts: [line(100n, ALICE), line(200n, BOB)] }],
    DECIMALS,
    employer,
  );
  assert.equal(hidden.integrity, "TAMPERED");
  assert.equal(hidden.reason, "An on-chain payout is missing from the receipt.");

  const extraCount = compareDecryptedAmounts(
    "employer",
    [note(100n, "recipient"), note(100n, "recipient")],
    [{ payouts: [line(100n, ALICE)] }],
    DECIMALS,
    employer,
  );
  assert.equal(extraCount.integrity, "TAMPERED");
  assert.equal(extraCount.reason, "An on-chain payout is missing from the receipt.");

  const missingCount = compareDecryptedAmounts(
    "employer",
    [note(100n, "recipient")],
    [{ payouts: [line(100n, ALICE), line(100n, BOB)] }],
    DECIMALS,
    employer,
  );
  assert.equal(missingCount.integrity, "TAMPERED");
  assert.equal(missingCount.reason, "The receipt lists an amount that is not in the on-chain decrypted outputs.");

  const provenPadding = compareDecryptedAmounts(
    "employer",
    [note(0n, "recipient", true), note(100n, "recipient")],
    [{ payouts: [line(100n, ALICE)] }],
    DECIMALS,
    employer,
  );
  assert.equal(provenPadding.integrity, "VERIFIED");

  const unprovenZero = compareDecryptedAmounts(
    "employer",
    [note(0n, "recipient"), note(100n, "recipient")],
    [{ payouts: [line(100n, ALICE)] }],
    DECIMALS,
    employer,
  );
  assert.equal(unprovenZero.integrity, "TAMPERED");
  assert.equal(unprovenZero.reason, "An on-chain payout is missing from the receipt.");

  const unknownOutput = compareDecryptedAmounts(
    "employer",
    [note(100n, "recipient"), note(77n, "opened-note")],
    [{ payouts: [line(100n, ALICE)] }],
    DECIMALS,
    employer,
  );
  assert.equal(unknownOutput.integrity, "TAMPERED");

  const nonZeroPaddingFlag = compareDecryptedAmounts(
    "employer",
    [note(100n, "recipient", true)],
    [{ payouts: [line(100n, ALICE)] }],
    DECIMALS,
    employer,
  );
  assert.equal(nonZeroPaddingFlag.integrity, "VERIFIED");

  const realZeroChange = compareDecryptedAmounts(
    "employer",
    [note(0n, "sender-change"), note(100n, "recipient")],
    [{ payouts: [line(100n, ALICE)] }],
    DECIMALS,
    employer,
  );
  assert.equal(realZeroChange.integrity, "VERIFIED");
});

test("3b. a sender-owned protocol fee stays out of the multiset; a third-party fee must be named", () => {
  const selfFee = compareDecryptedAmounts(
    "employer",
    [note(11n, "sender-change"), note(100n, "recipient")],
    [{
      payouts: [line(100n, ALICE)],
      protocolFee: { amountBaseUnits: "11", collector: SENDER },
    }],
    DECIMALS,
    employer,
  );
  assert.equal(selfFee.integrity, "VERIFIED");

  const thirdParty = compareDecryptedAmounts(
    "employer",
    [note(100n, "recipient"), note(11n, "recipient")],
    [{
      payouts: [line(100n, ALICE)],
      protocolFee: { amountBaseUnits: "11", shieldedAddress: FEE, collector: "OtherCollector" },
    }],
    DECIMALS,
    employer,
  );
  assert.equal(thirdParty.integrity, "VERIFIED");

  const thirdPartyHidden = compareDecryptedAmounts(
    "employer",
    [note(100n, "recipient")],
    [{
      payouts: [line(100n, ALICE)],
      protocolFee: { amountBaseUnits: "11", shieldedAddress: FEE, collector: "OtherCollector" },
    }],
    DECIMALS,
    employer,
  );
  assert.equal(thirdPartyHidden.integrity, "TAMPERED");
  assert.equal(thirdPartyHidden.reason, "The receipt lists an amount that is not in the on-chain decrypted outputs.");

  const unnamedFee = compareDecryptedAmounts(
    "employer",
    [note(100n, "recipient"), note(11n, "recipient")],
    [{
      payouts: [line(100n, ALICE)],
      protocolFee: { amountBaseUnits: "11", collector: "OtherCollector" },
    }],
    DECIMALS,
    employer,
  );
  assert.equal(unnamedFee.integrity, "UNSUPPORTED_RECEIPT");
  assert.match(unnamedFee.reason, /protocol fee has no shielded address/);
});

test("4. paystub mode binds to this recipient and refuses receipts with no shielded address", () => {
  // Alice still claims the original 100. Only Bob's line was edited, and Bob is the viewer.
  const editedOwnLine = compareDecryptedAmounts(
    "paystub",
    [note(100n, "opened-note")],
    [{ payouts: [line(100n, ALICE), line(50n, BOB)] }],
    DECIMALS,
    { paystubShieldedAddress: BOB },
  );
  assert.equal(editedOwnLine.integrity, "TAMPERED");
  assert.equal(editedOwnLine.reason, "The receipt lists an amount that is not in the on-chain decrypted outputs.");

  const exactOwnLine = compareDecryptedAmounts(
    "paystub",
    [note(100n, "opened-note")],
    [{ payouts: [line(100n, ALICE), line(100n, BOB)] }],
    DECIMALS,
    { paystubShieldedAddress: BOB },
  );
  assert.equal(exactOwnLine.integrity, "VERIFIED");

  const oldReceipt = compareDecryptedAmounts(
    "paystub",
    [note(100n, "opened-note")],
    [{ payouts: [{ amountBaseUnits: "100", recipient: "SomeSolanaAddress" }, line(100n, BOB)] }],
    DECIMALS,
    { paystubShieldedAddress: BOB },
  );
  assert.equal(oldReceipt.integrity, "UNSUPPORTED_RECEIPT");
  assert.match(oldReceipt.reason, /no shielded address/);
  assert.notEqual(oldReceipt.integrity, "VERIFIED");

  const employerOldReceipt = compareDecryptedAmounts(
    "employer",
    [note(100n, "recipient")],
    [{ payouts: [{ amountBaseUnits: "100", recipient: "SomeSolanaAddress" }] }],
    DECIMALS,
    employer,
  );
  assert.equal(employerOldReceipt.integrity, "UNSUPPORTED_RECEIPT");

  const missingViewer = compareDecryptedAmounts(
    "paystub",
    [note(100n, "opened-note")],
    [{ payouts: [line(100n, ALICE)] }],
    DECIMALS,
    { paystubShieldedAddress: BOB },
  );
  assert.equal(missingViewer.integrity, "TAMPERED");
  assert.equal(missingViewer.reason, "The recipient shielded address is missing from the receipt.");

  const pastedKey = compareDecryptedAmounts(
    "paystub",
    [note(100n, "opened-note")],
    [{ payouts: [line(100n, BOB)] }],
    DECIMALS,
    {},
  );
  assert.equal(pastedKey.integrity, "UNSUPPORTED_RECEIPT");
  assert.match(pastedKey.reason, /paystub verification needs the recipient shielded address/);
});
