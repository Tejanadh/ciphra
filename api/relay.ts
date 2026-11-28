import { relayAndSend, relayPublicKey } from "../examples/wallet/src/relayerServer.ts";

const DEVNET_RPC = "https://api.devnet.solana.com";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Public key only. The secret stays in RELAYER_PRIVATE_KEY and is never a VITE_ variable. */
export async function GET(): Promise<Response> {
  const secret = process.env["RELAYER_PRIVATE_KEY"] ?? "";
  if (secret.trim() === "") return json({ error: "Relayer unavailable." }, 503);
  try {
    return json(await relayPublicKey(secret));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Relayer unavailable.";
    return json({ error: message }, 503);
  }
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env["RELAYER_PRIVATE_KEY"] ?? "";
  if (secret.trim() === "") return json({ error: "Relayer unavailable." }, 503);
  let transaction = "";
  try {
    const body = await request.json() as { transaction?: string };
    transaction = body.transaction ?? "";
  } catch {
    return json({ error: "Expected a JSON body with a base64 transaction." }, 400);
  }
  if (transaction === "") return json({ error: "Expected a base64 transaction." }, 400);
  try {
    const result = await relayAndSend({
      secret,
      rpcUrl: process.env["RELAYER_RPC_URL"] ?? DEVNET_RPC,
      transaction,
    });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Relayer rejected the transaction.";
    return json({ error: message }, 400);
  }
}
