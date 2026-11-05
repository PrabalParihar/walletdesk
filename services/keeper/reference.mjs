/**
 * Off-chain reference price for the demo pool, used by the keeper as a LOCAL stand-in for the Chainlink CRE
 * workflow in services/cre. The demo pool is two 18-decimal mock stablecoins, so the reference is the USDT/USD
 * price from two public venues, median-aggregated. On a real chain the CRE workflow writes this instead.
 */
export const SOURCES = [
  {
    name: "coinbase",
    url: "https://api.coinbase.com/v2/prices/USDT-USD/spot",
    parse: (body) => Number(body?.data?.amount),
  },
  {
    name: "kraken",
    url: "https://api.kraken.com/0/public/Ticker?pair=USDTUSD",
    parse: (body) => Number(body?.result?.USDTZUSD?.c?.[0]),
  },
];

/** A price is usable only if it is a finite number inside a sane stablecoin range. */
export function saneStablePrice(value) {
  return Number.isFinite(value) && value > 0.5 && value < 1.5;
}

/** Median of the usable prices, or null if none. */
export function aggregate(prices) {
  const ok = prices.filter(saneStablePrice).sort((a, b) => a - b);
  if (ok.length === 0) return null;
  const mid = Math.floor(ok.length / 2);
  return ok.length % 2 === 1 ? ok[mid] : (ok[mid - 1] + ok[mid]) / 2;
}

/** Human price (token1 per token0) to the on-chain unit: raw token1 per raw token0, scaled by 1e18. */
export function toPriceX18(price, decimals0 = 18, decimals1 = 18) {
  if (!saneStablePrice(price)) throw new Error(`unusable price ${price}`);
  const micros = BigInt(Math.round(price * 1e6));
  return (micros * 10n ** 12n * 10n ** BigInt(decimals1)) / 10n ** BigInt(decimals0);
}

export async function fetchReference(fetchImpl = fetch) {
  const settled = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const response = await fetchImpl(source.url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`${source.name} ${response.status}`);
      return { name: source.name, price: source.parse(await response.json()) };
    }),
  );
  const quotes = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const price = aggregate(quotes.map((q) => q.price));
  return { price, sources: quotes.filter((q) => saneStablePrice(q.price)).map((q) => q.name) };
}
