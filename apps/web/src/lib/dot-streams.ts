export interface Dot {
  x: number;
  y: number;
  r: number;
  faint: boolean;
}

/** Split `total` dots between the two sides in proportion; a side with a positive part keeps at least one. */
export function dotCounts(poolPart: number, deskPart: number, total: number): { pool: number; desk: number } {
  const sum = poolPart + deskPart;
  if (sum <= 0 || total <= 0) return { pool: 0, desk: 0 };
  if (poolPart <= 0) return { pool: 0, desk: total };
  if (deskPart <= 0) return { pool: total, desk: 0 };
  const pool = Math.min(total - 1, Math.max(1, Math.round((poolPart / sum) * total)));
  return { pool, desk: total - pool };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Dots spaced along a straight stream, with a fixed (non-random) wobble so server and client markup match. */
export function streamDots(count: number, from: [number, number], to: [number, number], seed: number): Dot[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;
    const wobble = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 3;
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t + wobble;
    return { x: round(x), y: round(y), r: round(1.6 + t * 0.9), faint: i % 3 === 2 };
  });
}
