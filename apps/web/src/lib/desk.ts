import { encodePacked, keccak256 } from "viem";

export const PRICE = 10n ** 18n;
export const BPS = 10_000n;

export type DeskDraft = {
  symbolIn: string;
  symbolOut: string;
  amount: string;
  priceLow: string;
  priceHigh: string;
  feeBps: string;
  halfLife: string;
  poolCap: string;
  swapSize: string;
  program: string;
  programHash: string;
  savedAt: number;
};

export const STORAGE_KEY = "walletdesk.desk";

export function parseUnits18(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return 0n;
  const [whole, frac = ""] = trimmed.split(".");
  const padded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole) * PRICE + BigInt(padded);
}

export function formatUnits18(value: bigint, digits = 4): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / PRICE;
  const frac = abs % PRICE;
  const fracStr = frac.toString().padStart(18, "0").slice(0, digits).replace(/0+$/, "");
  const body = fracStr.length > 0 ? `${whole}.${fracStr}` : whole.toString();
  return negative ? `-${body}` : body;
}

export function encodeProgram(input: {
  priceLow: bigint;
  priceHigh: bigint;
  feeBps: number;
  start: number;
  halfLife: number;
}): `0x${string}` {
  const args = encodePacked(
    ["uint256", "uint256", "uint16", "uint32", "uint32"],
    [input.priceLow, input.priceHigh, input.feeBps, input.start, input.halfLife],
  );
  const argBytes = (args.length - 2) / 2;
  return encodePacked(["uint8", "uint8", "bytes"], [0, argBytes, args]);
}

export function quoteExactIn(input: {
  balanceIn: bigint;
  balanceOut: bigint;
  amountIn: bigint;
  priceLow: bigint;
  priceHigh: bigint;
  feeBps: bigint;
  start: bigint;
  halfLife: bigint;
  timestamp: bigint;
}): { amountOut: bigint; feeOut: bigint; priceX18: bigint } | { error: string } {
  if (input.priceLow === 0n || input.priceLow > input.priceHigh) return { error: "Price band is empty." };
  if (input.feeBps > BPS) return { error: "Fee is above 10,000 bps." };
  if (input.balanceOut === 0n) return { error: "Shelf has no output inventory." };
  if (input.amountIn === 0n) return { error: "Input is zero." };
  const denom = input.balanceIn + input.balanceOut;
  const weight = (input.balanceOut * PRICE) / denom;
  const priceX18 = input.priceLow + ((input.priceHigh - input.priceLow) * weight) / PRICE;
  let gross = (input.amountIn * priceX18) / PRICE;
  if (input.halfLife !== 0n && input.timestamp > input.start) {
    const elapsed = input.timestamp - input.start;
    gross = (gross * input.halfLife) / (input.halfLife + elapsed);
  }
  const feeOut = (gross * input.feeBps) / BPS;
  const amountOut = gross - feeOut;
  if (amountOut === 0n) return { error: "Quote rounded to zero." };
  if (amountOut > input.balanceOut) return { error: "Quote is larger than the shelf." };
  return { amountOut, feeOut, priceX18 };
}

export function programHash(program: `0x${string}`): `0x${string}` {
  return keccak256(program);
}
