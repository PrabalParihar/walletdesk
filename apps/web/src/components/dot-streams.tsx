import { dotCounts, streamDots, type Dot } from "@/lib/dot-streams";

const TOTAL_DOTS = 30;
const POOL_FROM: [number, number] = [20, 60];
const POOL_TO: [number, number] = [120, 110];
const DESK_FROM: [number, number] = [20, 200];
const DESK_TO: [number, number] = [118, 142];

function Stream({ dots, color, offset }: { dots: Dot[]; color: string; offset: number }) {
  return (
    <g fill={color} aria-hidden="true">
      {dots.map((d, i) => (
        <circle
          key={i}
          className="wd-flow"
          cx={d.x}
          cy={d.y}
          r={d.r}
          opacity={d.faint ? 0.55 : 1}
          style={{ "--i": offset + i } as React.CSSProperties}
        />
      ))}
    </g>
  );
}

export function DotStreams({ poolPart, deskPart, symbol }: { poolPart: number; deskPart: number; symbol: string }) {
  const total = poolPart + deskPart;
  const counts = dotCounts(poolPart, deskPart, TOTAL_DOTS);
  const pool = streamDots(counts.pool, POOL_FROM, POOL_TO, 1);
  const desk = streamDots(counts.desk, DESK_FROM, DESK_TO, 2);
  const label = { fill: "#8a8a8a", fontSize: 9, fontFamily: "var(--font-mono), ui-monospace, monospace", letterSpacing: "0.08em" } as const;

  return (
    <svg
      viewBox="0 0 300 250"
      role="img"
      aria-label={`Example swap of ${total} ${symbol}: ${poolPart} filled by the Uniswap pool, ${deskPart} from a maker wallet`}
      className="h-[260px] w-full"
    >
      <text x="20" y="14" aria-hidden="true" {...label}>EXAMPLE SWAP</text>
      <Stream dots={pool} color="var(--pool)" offset={0} />
      <Stream dots={desk} color="var(--wd-desk)" offset={counts.pool} />
      <g fill="none" opacity="0.6" aria-hidden="true">
        <path d="M120 110 Q150 124 170 126" stroke="var(--pool)" />
        <path d="M118 142 Q150 130 170 126" stroke="var(--wd-desk)" />
      </g>
      <circle className="wd-flow-node" cx="172" cy="126" r="6" fill="#ededed" aria-hidden="true" />
      <path d="M178 126 H285" stroke="#ededed" strokeWidth="1.5" strokeDasharray="2 4" aria-hidden="true" />
      <text x="20" y="40" aria-hidden="true" {...label}>{`POOL · ${poolPart} ${symbol}`}</text>
      <text x="20" y="244" aria-hidden="true" {...label}>{`MAKER WALLET · ${deskPart} ${symbol}`}</text>
      <text x="190" y="112" aria-hidden="true" {...label} fill="#ededed">{`YOU · ${total} ${symbol}`}</text>
    </svg>
  );
}
