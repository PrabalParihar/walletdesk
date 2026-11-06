// Pure price helpers for the desk-guard workflow.
// No SDK imports here, so this file runs the same way in bun tests and in the
// CRE WASM (QuickJS) runtime. All price math is bigint fixed point, never float.

export const ONE_X18 = 10n ** 18n
const ONE_X36 = 10n ** 36n
const BPS = 10_000n

export type SourceFormat = "coinbase-spot" | "kraken-ticker"

// Parses a plain decimal string ("0.99845", "1", "1.0014") into 1e18 fixed point.
// Digits beyond 18 decimals are truncated. Exponents, signs and empty strings are rejected.
export function parseDecimalX18(value: string): bigint {
  const s = value.trim()
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error(`not a plain decimal: "${value}"`)
  }
  const [whole, frac = ""] = s.split(".")
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18)
  return BigInt(whole) * ONE_X18 + BigInt(fracPadded)
}

// Formats a 1e18 fixed point value as a decimal string with `digits` decimals (truncated).
export function formatX18(value: bigint, digits = 6): string {
  const neg = value < 0n
  const v = neg ? -value : value
  const whole = v / ONE_X18
  const frac = (v % ONE_X18).toString().padStart(18, "0").slice(0, digits)
  return `${neg ? "-" : ""}${whole}${digits > 0 ? "." + frac : ""}`
}

// 1 / x in 1e18 fixed point (floor).
export function invertX18(x: bigint): bigint {
  if (x <= 0n) throw new Error("cannot invert a non-positive price")
  return ONE_X36 / x
}

// Median of a non-empty list. Even length returns the floor mean of the two middle values.
export function medianBigint(values: readonly bigint[]): bigint {
  if (values.length === 0) throw new Error("median of empty list")
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2n
}

// (max - min) / min in basis points (floor).
export function spreadBps(values: readonly bigint[]): bigint {
  if (values.length < 2) return 0n
  let min = values[0]
  let max = values[0]
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min <= 0n) throw new Error("non-positive price in spread")
  return ((max - min) * BPS) / min
}

// |a - b| / b in basis points (floor). b is the reference.
export function deviationBps(a: bigint, b: bigint): bigint {
  if (b <= 0n) throw new Error("non-positive reference in deviation")
  const diff = a > b ? a - b : b - a
  return (diff * BPS) / b
}

// Converts a human price (token1 per token0, 1e18 fixed point) into raw units:
// raw token1 units per 1 raw token0 unit, times 1e18. This is the same unit as
// Uniswap v4 sqrtPriceX96^2 / 2^192, scaled by 1e18.
export function toRawPriceX18(humanX18: bigint, token0Decimals: number, token1Decimals: number): bigint {
  const shift = token1Decimals - token0Decimals
  if (shift >= 0) return humanX18 * 10n ** BigInt(shift)
  return humanX18 / 10n ** BigInt(-shift)
}

// Extracts a price (quote per base, 1e18 fixed point) from a source response body.
//
// coinbase-spot:  GET https://api.coinbase.com/v2/prices/USDT-USDC/spot
//                 {"data":{"amount":"0.99845","base":"USDT","currency":"USDC"}}
// kraken-ticker:  GET https://api.kraken.com/0/public/Ticker?pair=USDCUSDT
//                 {"error":[],"result":{"USDCUSDT":{"a":["1.0014",...],"b":["1.0013",...],...}}}
//                 Uses the mid of best ask and best bid.
export function parseSourceBody(format: SourceFormat, body: string): bigint {
  const data = JSON.parse(body) as unknown
  if (format === "coinbase-spot") {
    const amount = (data as { data?: { amount?: unknown } }).data?.amount
    if (typeof amount !== "string") throw new Error("coinbase-spot: missing data.amount")
    return parseDecimalX18(amount)
  }
  if (format === "kraken-ticker") {
    const k = data as { error?: unknown[]; result?: Record<string, { a?: unknown[]; b?: unknown[] }> }
    if (Array.isArray(k.error) && k.error.length > 0) {
      throw new Error(`kraken-ticker: ${k.error.join(", ")}`)
    }
    const pairs = k.result ? Object.values(k.result) : []
    if (pairs.length !== 1) throw new Error(`kraken-ticker: expected 1 pair, got ${pairs.length}`)
    const ask = pairs[0].a?.[0]
    const bid = pairs[0].b?.[0]
    if (typeof ask !== "string" || typeof bid !== "string") {
      throw new Error("kraken-ticker: missing best ask/bid")
    }
    return (parseDecimalX18(ask) + parseDecimalX18(bid)) / 2n
  }
  throw new Error(`unknown source format: ${format as string}`)
}
