import assert from "node:assert/strict";
import { test } from "node:test";
import { SHIELDED_POOL_PROGRAM_ID } from "@heliuslabs/spr/interface";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  blockhash,
  compileTransaction,
  createKeyPairSignerFromPrivateKeyBytes,
  createTransactionMessage,
  generateKeyPairSigner,
  isFullySignedTransaction,
  partiallySignTransactionWithSigners,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
} from "@solana/kit";
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  COMPUTE_BUDGET_PROGRAM_ADDRESS,
  RELAYER_FEE_LAMPORTS,
  TOKEN_PROGRAM_ADDRESS,
  assertRelayerTransaction,
  coSignRelayerFeePayer,
} from "../src/relayerPolicy.ts";

const LIFETIME = {
  blockhash: blockhash("4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY"),
  lastValidBlockHeight: 100n,
};

function poolInstruction(): Instruction {
  return {
    programAddress: SHIELDED_POOL_PROGRAM_ID,
    accounts: [],
    data: new Uint8Array([1]),
  } as Instruction;
}

/** Discriminator 2, 5 bytes. Matches SetComputeUnitLimit. Kit does not export the helper. */
function setComputeUnitLimit(units: number): Instruction {
  const data = new Uint8Array(5);
  data[0] = 2;
  new DataView(data.buffer).setUint32(1, units, true);
  return {
    programAddress: COMPUTE_BUDGET_PROGRAM_ADDRESS,
    data,
  } as Instruction;
}

async function build(instructions: readonly Instruction[], feePayer: string) {
  const message = pipe(
    createTransactionMessage({ version: 1 }),
    (current) => setTransactionMessageFeePayer(address(feePayer), current),
    (current) => setTransactionMessageLifetimeUsingBlockhash(LIFETIME, current),
    (current) => appendTransactionMessageInstructions(instructions, current),
  );
  return compileTransaction(message);
}

test("relayer accepts a shielded-pool transaction that pays 0.005 SOL", async () => {
  const user = await generateKeyPairSigner();
  const seed = new Uint8Array(32);
  seed[0] = 9;
  const relayer = await createKeyPairSignerFromPrivateKeyBytes(seed);
  const tx = await build([
    setComputeUnitLimit(200_000),
    getTransferSolInstruction({ source: user, destination: relayer.address, amount: RELAYER_FEE_LAMPORTS }),
    poolInstruction(),
  ], relayer.address);
  assert.doesNotThrow(() => assertRelayerTransaction(tx, relayer.address));
  const partial = await partiallySignTransactionWithSigners([user], tx);
  const secret = [...seed].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const signed = await coSignRelayerFeePayer(partial, secret);
  assert.equal(isFullySignedTransaction(signed), true);
});

test("relayer rejects an unrecognized program and a transfer that is not the reimbursement", async () => {
  const user = await generateKeyPairSigner();
  const relayer = await generateKeyPairSigner();
  const stranger = await generateKeyPairSigner();
  const memo = {
    programAddress: address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
    accounts: [],
    data: new Uint8Array(),
  } as Instruction;
  const withMemo = await build([
    getTransferSolInstruction({ source: user, destination: relayer.address, amount: RELAYER_FEE_LAMPORTS }),
    poolInstruction(),
    memo,
  ], relayer.address);
  assert.throws(() => assertRelayerTransaction(withMemo, relayer.address), /Unrecognized program/);

  const wrongAmount = await build([
    getTransferSolInstruction({ source: user, destination: relayer.address, amount: 1n }),
    poolInstruction(),
  ], relayer.address);
  assert.throws(() => assertRelayerTransaction(wrongAmount, relayer.address), /Arbitrary system transfer/);

  const wrongDestination = await build([
    getTransferSolInstruction({ source: user, destination: stranger.address, amount: RELAYER_FEE_LAMPORTS }),
    poolInstruction(),
  ], relayer.address);
  assert.throws(() => assertRelayerTransaction(wrongDestination, relayer.address), /Arbitrary system transfer/);

  const fromRelayer = await build([
    getTransferSolInstruction({ source: user, destination: relayer.address, amount: RELAYER_FEE_LAMPORTS }),
    getTransferSolInstruction({ source: relayer, destination: stranger.address, amount: 1n }),
    poolInstruction(),
  ], relayer.address);
  assert.throws(() => assertRelayerTransaction(fromRelayer, relayer.address), /source or authority/);

  const missing = await build([poolInstruction()], relayer.address);
  assert.throws(() => assertRelayerTransaction(missing, relayer.address), /Expected one 0\.005 SOL/);

  const tokenTransfer = {
    programAddress: TOKEN_PROGRAM_ADDRESS,
    accounts: [],
    data: new Uint8Array([3]),
  } as Instruction;
  const withTokenTransfer = await build([
    getTransferSolInstruction({ source: user, destination: relayer.address, amount: RELAYER_FEE_LAMPORTS }),
    tokenTransfer,
  ], relayer.address);
  assert.throws(() => assertRelayerTransaction(withTokenTransfer, relayer.address), /Arbitrary token transfer/);

  const badBudget = {
    programAddress: COMPUTE_BUDGET_PROGRAM_ADDRESS,
    data: new Uint8Array([0, 0, 0, 0, 0]),
  } as Instruction;
  const withBadBudget = await build([
    getTransferSolInstruction({ source: user, destination: relayer.address, amount: RELAYER_FEE_LAMPORTS }),
    badBudget,
  ], relayer.address);
  assert.throws(() => assertRelayerTransaction(withBadBudget, relayer.address), /Unrecognized compute budget/);

  const doubled = await build([
    getTransferSolInstruction({ source: user, destination: relayer.address, amount: RELAYER_FEE_LAMPORTS }),
    getTransferSolInstruction({ source: user, destination: relayer.address, amount: RELAYER_FEE_LAMPORTS }),
  ], relayer.address);
  assert.throws(() => assertRelayerTransaction(doubled, relayer.address), /Expected one 0\.005 SOL/);
});

test("relayer pubkey cannot be source or authority except the shielded-pool payer", async () => {
  const user = await generateKeyPairSigner();
  const relayer = await generateKeyPairSigner();
  const stranger = await generateKeyPairSigner();
  const reimbursement = getTransferSolInstruction({
    source: user,
    destination: relayer.address,
    amount: RELAYER_FEE_LAMPORTS,
  });

  const poolPayer = {
    programAddress: SHIELDED_POOL_PROGRAM_ID,
    accounts: [{ address: relayer.address, role: AccountRole.WRITABLE_SIGNER }],
    data: new Uint8Array([1]),
  } as Instruction;
  const allowed = await build([reimbursement, poolPayer], relayer.address);
  assert.doesNotThrow(() => assertRelayerTransaction(allowed, relayer.address));

  const ownerSigner = {
    programAddress: SHIELDED_POOL_PROGRAM_ID,
    accounts: [
      { address: relayer.address, role: AccountRole.WRITABLE_SIGNER },
      { address: relayer.address, role: AccountRole.READONLY_SIGNER },
    ],
    data: new Uint8Array([1]),
  } as Instruction;
  const poolAuthority = await build([reimbursement, ownerSigner], relayer.address);
  assert.throws(() => assertRelayerTransaction(poolAuthority, relayer.address), /source or authority/);

  const approve = {
    programAddress: TOKEN_PROGRAM_ADDRESS,
    accounts: [
      { address: user.address, role: AccountRole.WRITABLE },
      { address: stranger.address, role: AccountRole.READONLY },
      { address: relayer.address, role: AccountRole.READONLY_SIGNER },
    ],
    data: new Uint8Array([4, 1, 0, 0, 0, 0, 0, 0, 0]),
  } as Instruction;
  const tokenAuthority = await build([reimbursement, poolInstruction(), approve], relayer.address);
  assert.throws(() => assertRelayerTransaction(tokenAuthority, relayer.address), /source or authority/);

  const ataPayer = {
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    accounts: [
      { address: relayer.address, role: AccountRole.WRITABLE_SIGNER },
      { address: stranger.address, role: AccountRole.WRITABLE },
    ],
    data: new Uint8Array([1]),
  } as Instruction;
  const ataDrain = await build([reimbursement, poolInstruction(), ataPayer], relayer.address);
  assert.throws(() => assertRelayerTransaction(ataDrain, relayer.address), /source or authority/);
});
