// Pure types and formatting for the Live page and the home live strip. No `@/` imports so Node's test runner can load it.

export type Fill = {
  maker: `0x${string}`;
  residualIn: bigint;
  filledOut: bigint;
  feeOut: bigint;
  fillId: `0x${string}`;
};

export type KeeperFill = {
  fillId: string;
  txHash: string;
  residualIn: string | null;
  filledOut: string | null;
  feeOut: string;
  transfers: { event: string; token: string; amount: string }[];
  credited: boolean;
  creditNote?: string;
};

export type KeeperSkip = { txHash: string; maker: string; reason: number; blockNumber: number };

export type Balances = { wallet0: bigint; wallet1: bigint; virtual0: bigint | null; virtual1: bigint | null };

export type Guard = {
  spotX18: bigint;
  referenceX18: bigint | null;
  referenceAge: number | null;
  maxReferenceAge: number;
  deskCount: bigint;
  cap: bigint;
};

export function humanAge(seconds: number): string {
  if (seconds < 120) return `${seconds}s`;
  if (seconds < 7200) return `${Math.round(seconds / 60)} min`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

export type StripItem = { label: string; value: string };

const DASH = "—";

export function formatStrip(guard: Guard | null, chainLabel: string, formatPrice: (x18: bigint) => string): StripItem[] {
  let cre = DASH;
  if (guard?.referenceX18) {
    cre = guard.referenceAge !== null ? `${formatPrice(guard.referenceX18)} · ${humanAge(guard.referenceAge)}` : formatPrice(guard.referenceX18);
  }
  return [
    { label: "POOL SPOT", value: guard ? formatPrice(guard.spotX18) : DASH },
    { label: "CRE REF", value: cre },
    { label: "DESKS", value: guard ? guard.deskCount.toString() : DASH },
    { label: "CHAIN", value: chainLabel },
  ];
}
