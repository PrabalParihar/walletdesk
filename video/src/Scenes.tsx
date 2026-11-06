import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { Rails } from "./Footage";
import { c, mono, sans } from "./theme";

function useFade() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return Math.min(
    interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
    interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], { extrapolateLeft: "clamp" }),
  );
}

/** Appears `delay` frames into the scene, with a short rise. */
function useEnter(delay: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return { opacity: s, transform: `translateY(${(1 - s) * 18}px)` };
}

function Label({ index, children, dark = false }: { index?: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 14, fontFamily: mono, fontSize: 24, letterSpacing: 1.8, textTransform: "uppercase", color: c.muted }}>
      {index ? <span style={{ color: c.link }}>{index}</span> : null}
      <span>{children}</span>
    </div>
  );
}

function Mark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#18181B" stroke="rgba(255,255,255,0.12)" />
      <rect x="6" y="10" width="6" height="12" rx="2" fill="#FF3D9A" />
      <rect x="14" y="10" width="12" height="12" rx="2" fill="#3D8BFF" />
    </svg>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "pool" | "desk" | "cre" }) {
  const map = { pool: ["rgba(255,0,122,0.15)", "#FF8CC3"], desk: ["rgba(0,102,250,0.18)", "#9CC3FF"], cre: ["rgba(55,91,210,0.22)", "#B4C3F5"] }[tone];
  return <span style={{ padding: "10px 22px", borderRadius: 999, background: map[0], color: map[1], fontSize: 28, fontWeight: 500 }}>{children}</span>;
}

export function Title() {
  const fade = useFade();
  return (
    <AbsoluteFill style={{ background: c.paper, fontFamily: sans, color: c.ink, opacity: fade, justifyContent: "center", padding: "0 190px" }}>
      <Rails />
      <div style={{ ...useEnter(0), display: "flex", alignItems: "center", gap: 22 }}>
        <Mark />
        <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: -0.5 }}>WalletDesk</span>
      </div>
      <div style={{ ...useEnter(8), marginTop: 46, fontSize: 104, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3, maxWidth: 1400 }}>
        Wallets back Uniswap pools without depositing.
      </div>
      <div style={{ ...useEnter(18), marginTop: 50, display: "flex", gap: 16 }}>
        <Pill tone="pool">Uniswap v4 hook</Pill>
        <Pill tone="desk">1inch Aqua · SwapVM</Pill>
        <Pill tone="cre">Chainlink CRE</Pill>
      </div>
    </AbsoluteFill>
  );
}

/** The idea in one picture: a 5 DA swap, the pool fills its 1 DA cap, a maker's wallet fills the other 4. */
export function Explainer() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useFade();
  const W = 1400;
  const grow = spring({ frame: frame - 10, fps, config: { damping: 200 }, durationInFrames: 40 });
  const split = spring({ frame: frame - 70, fps, config: { damping: 200 }, durationInFrames: 30 });
  const cap = interpolate(frame, [45, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const guard = spring({ frame: frame - 150, fps, config: { damping: 200 } });
  const outro = spring({ frame: frame - 245, fps, config: { damping: 200 } });
  const poolW = W * 0.2;
  const neutral = "#3F3F46";
  const mix = (a: string, b: string, p: number) => {
    const h = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    const [x, y] = [h(a), h(b)];
    return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * p)).join(",")})`;
  };
  return (
    <AbsoluteFill style={{ background: c.paper, fontFamily: sans, color: c.ink, opacity: fade, padding: "120px 260px" }}>
      <Rails />
      <Label index="00">The idea</Label>
      <div style={{ marginTop: 22, fontSize: 60, fontWeight: 700, letterSpacing: -1.5 }}>One swap. Two sources of liquidity. One transaction.</div>
      <div style={{ position: "relative", marginTop: 120, width: W, height: 120 }}>
        <div style={{ position: "absolute", top: -54, left: 0, fontFamily: mono, fontSize: 26, color: c.muted }}>A swap of 5 DA arrives, through any v4 router</div>
        <div style={{ display: "flex", width: W * grow, height: 120, borderRadius: 18, overflow: "hidden", fontSize: 34, fontWeight: 600, color: "#fff" }}>
          <div style={{ width: poolW, flexShrink: 0, background: mix(neutral, c.pool, split), display: "flex", alignItems: "center", justifyContent: "center" }}>
            {split > 0.5 ? "1 DA" : ""}
          </div>
          <div style={{ flex: 1, background: mix(neutral, c.desk, split), display: "flex", alignItems: "center", justifyContent: "center" }}>
            {split > 0.5 ? "4 DA" : ""}
          </div>
        </div>
        <div style={{ position: "absolute", left: poolW - 1, top: -20, height: 160, borderLeft: `3px dashed ${c.ink}`, opacity: cap }} />
        <div style={{ position: "absolute", left: poolW + 14, top: 132, fontFamily: mono, fontSize: 24, color: c.ink, opacity: cap }}>pool cap: 1 DA</div>
      </div>
      <div style={{ marginTop: 90, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 30, width: W }}>
        <Step n="1" color={c.pool} show={split}>
          The Uniswap v4 pool fills the first <b>1 DA</b>, as it always would.
        </Step>
        <Step n="2" color={c.cre} show={guard}>
          The hook checks each maker desk against the pool price and a <b>Chainlink CRE</b> reference.
        </Step>
        <Step n="3" color={c.desk} show={spring({ frame: frame - 200, fps, config: { damping: 200 } })}>
          The best desk fills <b>4 DA</b> from the maker&apos;s wallet through <b>1inch Aqua</b>.
        </Step>
      </div>
      <div style={{ marginTop: 70, fontSize: 36, fontWeight: 600, opacity: outro, transform: `translateY(${(1 - outro) * 14}px)` }}>
        Same transaction. Any v4 router. Nothing deposited.
      </div>
    </AbsoluteFill>
  );
}

function Step({ n, color, show, children }: { n: string; color: string; show: number; children: React.ReactNode }) {
  return (
    <div style={{ opacity: show, transform: `translateY(${(1 - show) * 16}px)`, display: "flex", gap: 18, fontSize: 30, lineHeight: 1.4, color: c.body }}>
      <span style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 23, background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 600 }}>{n}</span>
      <span>{children}</span>
    </div>
  );
}

export function Proof() {
  const fade = useFade();
  const stats: [string, string][] = [
    ["2 fills", "real overflow fills on Unichain Sepolia, through our router and Uniswap's PoolSwapTest"],
    ["31 txs", "deploy, ship, register, reference and swaps, every one verified on chain"],
    ["CRE passed", "the desk-guard workflow simulated against the live Sepolia price feed"],
    ["38 tests", "contract tests; the 21 hook tests also pass on a Unichain mainnet fork"],
  ];
  return (
    <AbsoluteFill style={{ background: c.paper, fontFamily: sans, color: c.ink, opacity: fade, padding: "130px 220px" }}>
      <Rails />
      <Label index="06">Proof</Label>
      <div style={{ ...useEnter(4), marginTop: 22, fontSize: 64, fontWeight: 700, letterSpacing: -1.5 }}>Live on Unichain Sepolia. Every number links to its source.</div>
      <div style={{ marginTop: 80, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 26 }}>
        {stats.map(([value, label], i) => (
          <div key={value} style={{ ...useEnter(14 + i * 8), border: `1px solid ${c.line}`, borderRadius: 18, padding: "34px 30px", minHeight: 250 }}>
            <div style={{ fontSize: 58, fontWeight: 700, letterSpacing: -1.5, fontVariantNumeric: "tabular-nums" }}>{value}</div>
            <div style={{ marginTop: 14, fontSize: 26, lineHeight: 1.4, color: c.muted }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ ...useEnter(52), marginTop: 70, fontFamily: mono, fontSize: 26, color: c.muted }}>
        overflow fill tx · <span style={{ color: c.ink }}>0x0c169e96abd27278b2330755717034dc30bc5d7eed5be48dbc48dbc43bff0340</span>
      </div>
      <div style={{ ...useEnter(60), marginTop: 14, fontFamily: mono, fontSize: 26, color: c.muted }}>all transactions · docs/DEPLOYMENTS.md</div>
    </AbsoluteFill>
  );
}

export function Outro() {
  const fade = useFade();
  return (
    <AbsoluteFill style={{ background: c.raised, color: c.ink, fontFamily: sans, opacity: fade, justifyContent: "center", alignItems: "center" }}>
      <div style={{ ...useEnter(0), display: "flex", alignItems: "center", gap: 24 }}>
        <Mark size={84} />
        <span style={{ fontSize: 76, fontWeight: 700, letterSpacing: -1.5 }}>WalletDesk</span>
      </div>
      <div style={{ ...useEnter(10), marginTop: 34, fontSize: 36, color: "#D4D4D8" }}>Uniswap v4 hook · 1inch Aqua SwapVM · Chainlink CRE price guard</div>
      <div style={{ ...useEnter(20), marginTop: 46, fontFamily: mono, fontSize: 30, color: "#7CB4FF" }}>github.com/PrabalParihar/walletdesk</div>
    </AbsoluteFill>
  );
}
