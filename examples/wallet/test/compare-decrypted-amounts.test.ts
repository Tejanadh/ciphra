import assert from "node:assert/strict";
import { test } from "node:test";
import { ShieldedAddress, ShieldedPublicKey, X25519PublicKey, bytes32 } from "@heliuslabs/spr/keypair";
import { compareDecryptedAmounts, type AuditNote } from "../src/compare-decrypted-amounts.ts";

const DECIMALS = 9;
const SENDER = "CochByMjwdvZTWVPK4GqV3po66TmnjLvBxsC3wexTHQ1";
const SENDER_SHIELDED = "sender-shielded";
const ALICE = "alice-shielded";
const BOB = "bob-shielded";
const ZERO_NOTES = "Zero on-chain notes were decrypted with this key.";

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A real shielded address. The viewing key is what a decrypted sender slot exposes. */
function person(id: number): { shielded: string; viewing: string } {
  const seed = new Uint8Array(32);
  seed[0] = id;
  const viewing = new Uint8Array(33);
  viewing[0] = 4;
  viewing[1] = id;
  const address = ShieldedAddress.fromPublicKeys(
    ShieldedPublicKey.fromEd25519(bytes32(seed)),
    bytes32(seed),
    X25519PublicKey.fromBytes(viewing),
  );
  return {
    shielded: bytesToHex(address.toBytes()),
    viewing: bytesToHex(address.viewingPublicKey.toBytes()),
  };
}

const alice = person(1);
const bobPerson = person(2);
const carol = person(3);
const feePerson = person(4);

function note(amount: bigint, role: AuditNote["role"], paddingProven?: boolean, recipientViewingKey?: string): AuditNote {
  return {
    amountBaseUnits: amount.toString(),
    role,
    ...(paddingProven === undefined ? {} : { paddingProven }),
    ...(recipientViewingKey === undefined ? {} : { recipientViewingKey }),
  };
}

function paid(amount: bigint, who: { viewing: string }, role: AuditNote["role"] = "recipient", paddingProven?: boolean): AuditNote {
  return note(amount, role, paddingProven, who.viewing);
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
    [note(50n, "sender-change"), paid(100n, alice), paid(200n, bobPerson)],
    [{ payouts: [line(100n, alice.shielded), line(200n, bobPerson.shielded)] }],
    DECIMALS,
    employer,
  );
  assert.equal(verified.integrity, "VERIFIED");

  const hidden = compareDecryptedAmounts(
    "employer",
    [paid(100n, alice), paid(200n, bobPerson), paid(300n, carol)],
    [{ payouts: [line(100n, alice.shielded), line(200n, bobPerson.shielded)] }],
    DECIMALS,
    employer,
  );
  assert.equal(hidden.integrity, "TAMPERED");
  assert.equal(hidden.reason, "An on-chain payout is missing from the receipt.");

  const extraCount = compareDecryptedAmounts(
    "employer",
    [paid(100n, alice), paid(100n, alice)],
    [{ payouts: [line(100n, alice.shielded)] }],
    DECIMALS,
    employer,
  );
  assert.equal(extraCount.integrity, "TAMPERED");
  assert.equal(extraCount.reason, "An on-chain payout is missing from the receipt.");

  const missingCount = compareDecryptedAmounts(
    "employer",
    [paid(100n, alice)],
    [{ payouts: [line(100n, alice.shielded), line(100n, alice.shielded)] }],
    DECIMALS,
    employer,
  );
  assert.equal(missingCount.integrity, "TAMPERED");
  assert.equal(missingCount.reason, "The receipt lists an amount that is not in the on-chain decrypted outputs.");

  const provenPadding = compareDecryptedAmounts(
    "employer",
    [note(0n, "recipient", true), paid(100n, alice)],
    [{ payouts: [line(100n, alice.shielded)] }],
    DECIMALS,
    employer,
  );
  assert.equal(provenPadding.integrity, "VERIFIED");

  const unprovenZero = compareDecryptedAmounts(
    "employer",
    [paid(0n, carol), paid(100n, alice)],
    [{ payouts: [line(100n, alice.shielded)] }],
    DECIMALS,
    employer,
  );
  assert.equal(unprovenZero.integrity, "TAMPERED");
  assert.equal(unprovenZero.reason, "An on-chain payout is missing from the receipt.");

  const unknownOutput = compareDecryptedAmounts(
    "employer",
    [paid(100n, alice), paid(77n, carol, "opened-note")],
    [{ payouts: [line(100n, alice.shielded)] }],
    DECIMALS,
    employer,
  );
  assert.equal(unknownOutput.integrity, "TAMPERED");

  const nonZeroPaddingFlag = compareDecryptedAmounts(
    "employer",
    [paid(100n, alice, "recipient", true)],
    [{ payouts: [line(100n, alice.shielded)] }],
    DECIMALS,
    employer,
  );
  assert.equal(nonZeroPaddingFlag.integrity, "VERIFIED");

  const realZeroChange = compareDecryptedAmounts(
    "employer",
    [note(0n, "sender-change"), paid(100n, alice)],
    [{ payouts: [line(100n, alice.shielded)] }],
    DECIMALS,
    employer,
  );
  assert.equal(realZeroChange.integrity, "VERIFIED");
});

test("3b. a sender-owned protocol fee stays out of the multiset; a third-party fee must be named", () => {
  const selfFee = compareDecryptedAmounts(
    "employer",
    [note(11n, "sender-change"), paid(100n, alice)],
    [{
      payouts: [line(100n, alice.shielded)],
      protocolFee: { amountBaseUnits: "11", collector: SENDER },
    }],
    DECIMALS,
    employer,
  );
  assert.equal(selfFee.integrity, "VERIFIED");

  const thirdParty = compareDecryptedAmounts(
    "employer",
    [paid(100n, alice), paid(11n, feePerson)],
    [{
      payouts: [line(100n, alice.shielded)],
      protocolFee: { amountBaseUnits: "11", shieldedAddress: feePerson.shielded, collector: "OtherCollector" },
    }],
    DECIMALS,
    employer,
  );
  assert.equal(thirdParty.integrity, "VERIFIED");

  const thirdPartyHidden = compareDecryptedAmounts(
    "employer",
    [paid(100n, alice)],
    [{
      payouts: [line(100n, alice.shielded)],
      protocolFee: { amountBaseUnits: "11", shieldedAddress: feePerson.shielded, collector: "OtherCollector" },
    }],
    DECIMALS,
    employer,
  );
  assert.equal(thirdPartyHidden.integrity, "TAMPERED");
  assert.equal(thirdPartyHidden.reason, "The receipt lists an amount that is not in the on-chain decrypted outputs.");

  const unnamedFee = compareDecryptedAmounts(
    "employer",
    [paid(100n, alice), paid(11n, feePerson)],
    [{
      payouts: [line(100n, alice.shielded)],
      protocolFee: { amountBaseUnits: "11", collector: "OtherCollector" },
    }],
    DECIMALS,
    employer,
  );
  assert.equal(unnamedFee.integrity, "UNSUPPORTED_RECEIPT");
  assert.match(unnamedFee.reason, /protocol fee has no shielded address/);

  // Calling the fee sender-owned does not hide the note encrypted to someone else.
  const falselySenderOwned = compareDecryptedAmounts(
    "employer",
    [paid(100n, alice), paid(11n, feePerson)],
    [{
      payouts: [line(100n, alice.shielded)],
      protocolFee: { amountBaseUnits: "11", collector: SENDER },
    }],
    DECIMALS,
    employer,
  );
  assert.equal(falselySenderOwned.integrity, "TAMPERED");
  assert.equal(falselySenderOwned.reason, "An on-chain payout is missing from the receipt.");
});

test("3c. employer mode binds each amount to the recipient viewing key", () => {
  const swapped = compareDecryptedAmounts(
    "employer",
    [paid(100n, alice), paid(200n, bobPerson)],
    [{ payouts: [line(100n, bobPerson.shielded), line(200n, alice.shielded)] }],
    DECIMALS,
    employer,
  );
  assert.equal(swapped.integrity, "TAMPERED");
  assert.equal(swapped.reason, "The receipt lists an amount that is not in the on-chain decrypted outputs.");

  const paidToSomeoneElse = compareDecryptedAmounts(
    "employer",
    [paid(100n, carol)],
    [{ payouts: [line(100n, alice.shielded)] }],
    DECIMALS,
    employer,
  );
  assert.equal(paidToSomeoneElse.integrity, "TAMPERED");
  assert.notEqual(paidToSomeoneElse.integrity, "VERIFIED");
});

test("3d. an unreadable amount is unsupported, including a line that would otherwise be ignored", () => {
  const extraGarbageLine = compareDecryptedAmounts(
    "employer",
    [paid(100n, alice)],
    [{ payouts: [
      { amountBaseUnits: "100", shieldedAddress: alice.shielded },
      { amountBaseUnits: "12.5", shieldedAddress: bobPerson.shielded },
    ] }],
    DECIMALS,
    employer,
  );
  assert.equal(extraGarbageLine.integrity, "UNSUPPORTED_RECEIPT");
  assert.match(extraGarbageLine.reason, /amount could not be read/);
  assert.notEqual(extraGarbageLine.integrity, "VERIFIED");

  const notNothing = compareDecryptedAmounts(
    "employer",
    [paid(100n, alice)],
    [{ payouts: [{ amount: "not-a-number", shieldedAddress: alice.shielded }] }],
    DECIMALS,
    employer,
  );
  assert.equal(notNothing.integrity, "UNSUPPORTED_RECEIPT");
  assert.notEqual(notNothing.integrity, "NOTHING_TO_VERIFY");

  const huge = "9007199254740993";
  const precise = compareDecryptedAmounts(
    "paystub",
    [note(BigInt(huge), "opened-note")],
    [{ payouts: [{ amountBaseUnits: huge, shieldedAddress: BOB }] }],
    DECIMALS,
    { paystubShieldedAddress: BOB },
  );
  assert.equal(precise.integrity, "VERIFIED");
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
