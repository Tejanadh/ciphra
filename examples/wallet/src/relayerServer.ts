import {
  createSolanaRpc,
  getSignatureFromTransaction,
  sendTransactionWithoutConfirmingFactory,
} from "@solana/kit";
import { coSignRelayerFeePayer, decodeRelayedTransaction, relayerSignerFromSecret } from "./relayerPolicy.js";

export { coSignRelayerFeePayer, relayerSignerFromSecret };

export async function relayPublicKey(secret: string): Promise<{ pubkey: string }> {
  const signer = await relayerSignerFromSecret(secret);
  return { pubkey: signer.address };
}

export async function relayAndSend(input: {
  readonly secret: string;
  readonly rpcUrl: string;
  readonly transaction: string;
}): Promise<{ signature: string }> {
  const signed = await coSignRelayerFeePayer(decodeRelayedTransaction(input.transaction), input.secret);
  const rpc = createSolanaRpc(input.rpcUrl);
  await sendTransactionWithoutConfirmingFactory({ rpc })(signed, { commitment: "confirmed" });
  return { signature: getSignatureFromTransaction(signed) };
}
