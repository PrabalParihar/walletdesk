/** Scale an 18-decimal shelf fee down to 6-decimal USDC units. This is a decimal conversion, not a market price. */
export function feeToUsdc6(feeAmount, feeDecimals = 18) {
  if (typeof feeAmount !== "bigint") throw new Error("fee amount must be a bigint");
  if (feeDecimals === 6) return feeAmount;
  if (feeDecimals !== 18) throw new Error(`unsupported fee decimals: ${feeDecimals}`);
  return feeAmount / 10n ** 12n;
}

export function isLoopbackRpc(url) {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}
