const QUOTE_URL = "https://api.jup.ag/swap/v1/quote";

/** Same-origin proxy so the wallet's COEP header can reach Jupiter. Forces the 50 bps fee. */
export async function GET(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(QUOTE_URL);
  incoming.searchParams.forEach((value, key) => {
    if (key !== "platformFeeBps") target.searchParams.set(key, value);
  });
  target.searchParams.set("platformFeeBps", "50");
  const headers: Record<string, string> = {};
  const apiKey = process.env["JUPITER_API_KEY"];
  if (apiKey !== undefined && apiKey !== "") headers["x-api-key"] = apiKey;
  const response = await fetch(target, { headers });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}
