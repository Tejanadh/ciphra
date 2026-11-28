const SWAP_URL = "https://api.jup.ag/swap/v1/swap";

/** Forwards a Jupiter swap build. The fee account must already be the WSOL or USDC ATA. */
export async function POST(request: Request): Promise<Response> {
  let body: { feeAccount?: string; quoteResponse?: { inputMint?: string; outputMint?: string } };
  try {
    body = await request.json() as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "Expected a JSON swap request." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (body.feeAccount === undefined || body.feeAccount === "") {
    return new Response(JSON.stringify({ error: "feeAccount is required." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const headers: Record<string, string> = { "content-type": "application/json" };
  const apiKey = process.env["JUPITER_API_KEY"];
  if (apiKey !== undefined && apiKey !== "") headers["x-api-key"] = apiKey;
  const response = await fetch(SWAP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, platformFeeBps: 50 }),
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}
