import { SHIELDED_POOL_PROGRAM_ID } from "@heliuslabs/spr/interface";
import {
  address,
  appendTransactionMessageInstruction,
  compileTransaction,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  decompileTransactionMessage,
  getBase58Encoder,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  signTransactionWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
  type Transaction,
  type TransactionSigner,
} from "@solana/kit";
import {
  getTransferSolInstruction,
  parseTransferSolInstruction,
  SYSTEM_PROGRAM_ADDRESS,
} from "@solana-program/system";

/** Flat reimbursement the relayer requires before it co-signs as fee payer. */
export const RELAYER_FEE_LAMPORTS = 5_000_000n;

export const TOKEN_PROGRAM_ADDRESS = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const TOKEN_2022_PROGRAM_ADDRESS = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const ASSOCIATED_TOKEN_PROGRAM_ADDRESS = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
/** Not re-exported from `@solana/kit`. Same address the Compute Budget program uses. */
export const COMPUTE_BUDGET_PROGRAM_ADDRESS = address("ComputeBudget111111111111111111111111111111");

const ALLOWED_PROGRAMS = new Set<string>([
  SHIELDED_POOL_PROGRAM_ID,
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  COMPUTE_BUDGET_PROGRAM_ADDRESS,
]);

/** SPL Token Transfer and TransferChecked. Both move value, so the relayer rejects them. */
const TOKEN_TRANSFER_DISCRIMINATORS = new Set([3, 12]);

export function decodeRelayedTransaction(wireBase64: string): Transaction {
  const bytes = getBase64Encoder().encode(wireBase64);
  return getTransactionDecoder().decode(bytes);
}

function accountAddress(account: { readonly address?: string } | string | undefined): string | undefined {
  if (account === undefined) return undefined;
  if (typeof account === "string") return account;
  return account.address;
}

/**
 * Rejects any transaction the relayer should not fee-pay.
 * Exactly one System transfer of 0.005 SOL must pay the relayer, and its destination is the relayer.
 * The relayer pubkey cannot be the source or authority of any other instruction.
 * Decompiled roles mark the fee payer as a signer on every account, so the check uses account position.
 * The shielded-pool payer (account 0) is the one exception: SPR requires that slot to be the fee payer.
 * Lookup tables are refused so a hidden program cannot bypass the allowlist.
 */
export function assertRelayerTransaction(transaction: Transaction, relayer: Address): void {
  const compiled = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
  if ("addressTableLookups" in compiled && Array.isArray(compiled.addressTableLookups) && compiled.addressTableLookups.length > 0) {
    throw new Error("Relayer refuses address lookup tables.");
  }
  const message = decompileTransactionMessage(compiled);
  if (message.feePayer.address !== relayer) {
    throw new Error("Fee payer must be the relayer.");
  }
  let reimbursements = 0;
  for (const instruction of message.instructions) {
    reimbursements += inspectInstruction(instruction, relayer);
  }
  if (reimbursements !== 1) {
    throw new Error("Expected one 0.005 SOL reimbursement to the relayer.");
  }
}

function rejectRelayerAsAuthority(instruction: Instruction, relayer: Address): void {
  const accounts = instruction.accounts ?? [];
  if (instruction.programAddress === SYSTEM_PROGRAM_ADDRESS) return;
  if (instruction.programAddress === SHIELDED_POOL_PROGRAM_ID) {
    for (let index = 1; index < accounts.length; index += 1) {
      if (accounts[index]?.address === relayer) {
        throw new Error("Relayer pubkey cannot be source or authority.");
      }
    }
    return;
  }
  for (const account of accounts) {
    if (account.address === relayer) {
      throw new Error("Relayer pubkey cannot be source or authority.");
    }
  }
}

function inspectInstruction(instruction: Instruction, relayer: Address): number {
  const program = instruction.programAddress;
  if (!ALLOWED_PROGRAMS.has(program)) {
    throw new Error("Unrecognized program " + program + ".");
  }
  rejectRelayerAsAuthority(instruction, relayer);
  if (program === SYSTEM_PROGRAM_ADDRESS) {
    let parsed: ReturnType<typeof parseTransferSolInstruction>;
    try {
      parsed = parseTransferSolInstruction(instruction as Instruction & { accounts: readonly { address: string }[]; data: Uint8Array });
    } catch {
      throw new Error("Unrecognized system instruction.");
    }
    const source = accountAddress(parsed.accounts.source);
    const destination = accountAddress(parsed.accounts.destination);
    if (source === undefined || destination === undefined) {
      throw new Error("Unrecognized system instruction.");
    }
    if (source === relayer) {
      throw new Error("Relayer pubkey cannot be source or authority.");
    }
    if (destination !== relayer || parsed.data.amount !== RELAYER_FEE_LAMPORTS) {
      throw new Error("Arbitrary system transfer rejected. Expected 0.005 SOL to the relayer.");
    }
    return 1;
  }
  if (program === COMPUTE_BUDGET_PROGRAM_ADDRESS) {
    if (!isAllowedComputeBudgetInstruction(instruction)) {
      throw new Error("Unrecognized compute budget instruction.");
    }
    return 0;
  }
  if (program === TOKEN_PROGRAM_ADDRESS || program === TOKEN_2022_PROGRAM_ADDRESS) {
    const data = "data" in instruction ? instruction.data : undefined;
    const first = data?.[0];
    if (first === undefined || TOKEN_TRANSFER_DISCRIMINATORS.has(first)) {
      throw new Error("Arbitrary token transfer rejected.");
    }
    return 0;
  }
  return 0;
}

/**
 * Compute Budget layouts that do not move lamports.
 * 1 heap frame (5 bytes), 2 unit limit (5), 3 unit price (9), 4 loaded-accounts size (5).
 */
function isAllowedComputeBudgetInstruction(instruction: Instruction): boolean {
  if (!("data" in instruction) || instruction.data == null) return false;
  const data = instruction.data;
  const discriminator = data[0];
  if (discriminator === 3) return data.byteLength === 9;
  if (discriminator === 1 || discriminator === 2 || discriminator === 4) return data.byteLength === 5;
  return false;
}

export async function relayerSignerFromSecret(secret: string): Promise<KeyPairSigner> {
  const trimmed = secret.trim();
  if (trimmed === "") throw new Error("Relayer is not configured.");
  const bytes = decodeSecret(trimmed);
  if (bytes.length === 64) return createKeyPairSignerFromBytes(bytes);
  if (bytes.length === 32) return createKeyPairSignerFromPrivateKeyBytes(bytes);
  throw new Error("Relayer key must be 32 or 64 bytes.");
}

function decodeSecret(secret: string): Uint8Array {
  if (secret.startsWith("[")) {
    const parsed: unknown = JSON.parse(secret);
    if (!Array.isArray(parsed) || !parsed.every((part) => typeof part === "number")) {
      throw new Error("Relayer key must be 32 or 64 bytes.");
    }
    return Uint8Array.from(parsed);
  }
  if (/^[0-9a-fA-F]+$/.test(secret) && (secret.length === 64 || secret.length === 128)) {
    const bytes = new Uint8Array(secret.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(secret.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
  }
  return Uint8Array.from(getBase58Encoder().encode(secret));
}

/** Verifies the allowlist, then co-signs as fee payer. The returned transaction keeps the fully-signed brand. */
export async function coSignRelayerFeePayer(transaction: Transaction, secret: string) {
  const relayer = await relayerSignerFromSecret(secret);
  assertRelayerTransaction(transaction, relayer.address);
  return signTransactionWithSigners([relayer], transaction);
}

/**
 * Moves an associated-token create off the relayer.
 * Account 0 is the rent payer. The connected wallet or burner pays it and signs it.
 */
function moveAtaPayerOffRelayer(instruction: Instruction, relayer: Address, payer: TransactionSigner): Instruction {
  if (instruction.programAddress !== ASSOCIATED_TOKEN_PROGRAM_ADDRESS || instruction.accounts === undefined) {
    return instruction;
  }
  const payerAccount = instruction.accounts[0];
  if (payerAccount === undefined || payerAccount.address !== relayer) return instruction;
  const accounts = instruction.accounts.map((account, index) => {
    if (index !== 0) return account;
    return { address: payer.address, role: account.role };
  });
  return { ...instruction, accounts };
}

/** Appends the required reimbursement and rebuilds the message. Caller partial-signs; the relayer does not. */
export function withRelayerReimbursement(
  transaction: Transaction,
  source: TransactionSigner,
  relayer: Address,
): Transaction {
  const compiled = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
  const message = decompileTransactionMessage(compiled);
  const instructions: Instruction[] = [];
  for (const instruction of message.instructions) {
    instructions.push(moveAtaPayerOffRelayer(instruction, relayer, source));
  }
  const rewritten = { ...message, instructions };
  const next = appendTransactionMessageInstruction(
    getTransferSolInstruction({
      source,
      destination: relayer,
      amount: RELAYER_FEE_LAMPORTS,
    }),
    rewritten,
  );
  return compileTransaction(next);
}
