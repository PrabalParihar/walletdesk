import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import { c, mono, sans } from "./theme";

export type Manifest = {
  name: string;
  width: number;
  height: number;
  duration: number;
  frames: { t: number; f: string }[];
  marks: { t: number; name: string }[];
  clicks: { t: number; x: number; y: number }[];
};

/** `shift` moves a caption relative to its marker (scroll markers are recorded when the 1.1 s scroll ends). */
export type Caption = { at: string | number; text: string; tag?: string; shift?: number };
/** Zoom keyframe: from marker `at`, ease to scale `s` centred on (x, y) in recorded page pixels. */
export type Zoom = { at: string | number; s: number; x?: number; y?: number; shift?: number };

const WINDOW_W = 1520;
const BAR_H = 38;

/** Last screencast frame at or before clip time t (frames only arrive when the page changes). */
function frameAt(m: Manifest, t: number): string {
  let lo = 0;
  let hi = m.frames.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (m.frames[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return m.frames[lo].f;
}

function markTime(m: Manifest, at: string | number): number {
  if (typeof at === "number") return at;
  const found = m.marks.find((x) => x.name === at);
  if (!found) throw new Error(`clip ${m.name} has no marker "${at}"`);
  return found.t;
}

/** A real screen recording of the app, played at its own speed in a browser window, with a cursor and captions. */
export function Footage({
  m,
  index,
  title,
  url,
  captions,
  zooms = [],
}: {
  m: Manifest;
  index: string;
  title: string;
  url: string;
  captions: Caption[];
  zooms?: Zoom[];
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const scale = WINDOW_W / m.width;
  const winH = m.height * scale + BAR_H;
  const left = (1920 - WINDOW_W) / 2;
  const top = 92;

  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });

  // Captions: each runs from its marker until the next one starts.
  const timed = captions.map((cap) => ({ ...cap, start: Math.max(0, markTime(m, cap.at) + (cap.shift ?? 0)) })).sort((a, b) => a.start - b.start);
  const currentIndex = timed.findLastIndex((cap) => cap.start <= t);
  const current = currentIndex >= 0 ? timed[currentIndex] : undefined;
  const capAge = current ? t - current.start : 0;
  const capIn = interpolate(capAge, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });

  // Zoom: ease from the previous keyframe to the current one over 0.8 s, never showing past the page edges.
  const keys = [{ start: 0, s: 1, x: m.width / 2, y: m.height / 2 }, ...zooms.map((z) => ({ start: Math.max(0, markTime(m, z.at) + (z.shift ?? 0)), s: z.s, x: z.x ?? m.width / 2, y: z.y ?? m.height / 2 }))].sort(
    (a, b) => a.start - b.start,
  );
  const ki = keys.findLastIndex((k) => k.start <= t);
  const to = keys[Math.max(ki, 0)];
  const from = keys[Math.max(ki - 1, 0)];
  const p = interpolate(t, [to.start, to.start + 0.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const zs = from.s + (to.s - from.s) * e;
  const zx = (from.x + (to.x - from.x) * e) * scale;
  const zy = (from.y + (to.y - from.y) * e) * scale;
  const vw = WINDOW_W;
  const vh = m.height * scale;
  const tx = Math.min(0, Math.max(vw - vw * zs, vw / 2 - zx * zs));
  const ty = Math.min(0, Math.max(vh - vh * zs, vh / 2 - zy * zs));

  return (
    <AbsoluteFill style={{ backgroundColor: c.canvas, opacity: Math.min(fadeIn, fadeOut), fontFamily: sans }}>
      <Rails />
      {/* Scene label, like the site's numbered section labels */}
      <div style={{ position: "absolute", left, top: 34, display: "flex", gap: 14, alignItems: "baseline", fontFamily: mono, fontSize: 22, letterSpacing: 1.5, textTransform: "uppercase", color: c.muted }}>
        <span style={{ color: c.desk }}>{index}</span>
        <span>{title}</span>
      </div>
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: WINDOW_W,
          height: winH,
          borderRadius: 14,
          overflow: "hidden",
          background: c.paper,
          boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ height: BAR_H, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderBottom: `1px solid ${c.line}`, background: c.raised }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((col) => (
            <span key={col} style={{ width: 12, height: 12, borderRadius: 6, background: col }} />
          ))}
          <span style={{ marginLeft: 18, padding: "4px 14px", borderRadius: 8, background: c.sunken, fontFamily: mono, fontSize: 15, color: c.muted }}>{url}</span>
        </div>
        <div style={{ position: "relative", width: WINDOW_W, height: m.height * scale, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: WINDOW_W, height: m.height * scale, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${zs})` }}>
            <Img src={staticFile(`footage/${m.name}/${frameAt(m, t)}`)} style={{ width: WINDOW_W, height: m.height * scale }} />
            <Cursor m={m} t={t} scale={scale} />
          </div>
        </div>
      </div>
      {current ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: top + winH + 26, display: "flex", justifyContent: "center", opacity: capIn, transform: `translateY(${(1 - capIn) * 10}px)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 26px", borderRadius: 14, background: c.ink, color: c.paper, fontSize: 30, fontWeight: 600, maxWidth: 1700 }}>
            {current.tag ? <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 500, letterSpacing: 1.5, color: c.desk, textTransform: "uppercase" }}>{current.tag}</span> : null}
            <span>{current.text}</span>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

/** Headless Chrome draws no pointer, so draw one: it glides to each recorded click and pulses on the click. */
function Cursor({ m, t, scale }: { m: Manifest; t: number; scale: number }) {
  if (m.clicks.length === 0) return null;
  const start = { t: 0, x: m.width * 0.62, y: m.height * 0.55 };
  const points = [start, ...m.clicks];
  const nextIndex = points.findIndex((p, i) => i > 0 && p.t > t);
  let x: number;
  let y: number;
  if (nextIndex === -1) {
    const last = points[points.length - 1];
    x = last.x;
    y = last.y;
  } else {
    const prev = points[nextIndex - 1];
    const next = points[nextIndex];
    const travel = Math.min(0.7, next.t - prev.t);
    const p = interpolate(t, [next.t - travel, next.t], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    x = prev.x + (next.x - prev.x) * ease;
    y = prev.y + (next.y - prev.y) * ease;
  }
  const lastClick = [...m.clicks].reverse().find((cl) => cl.t <= t);
  const since = lastClick ? t - lastClick.t : 99;
  const pulse = since < 0.5 ? since / 0.5 : 1;
  return (
    <>
      {since < 0.5 && lastClick ? (
        <div
          style={{
            position: "absolute",
            left: lastClick.x * scale - 22,
            top: lastClick.y * scale - 22,
            width: 44,
            height: 44,
            borderRadius: 22,
            border: `3px solid ${c.desk}`,
            opacity: 1 - pulse,
            transform: `scale(${0.6 + pulse * 0.8})`,
          }}
        />
      ) : null}
      <svg width={28} height={28} viewBox="0 0 24 24" style={{ position: "absolute", left: x * scale - 3, top: y * scale - 2, filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))" }}>
        <path d="M4 2 L4 19 L8.5 14.8 L11.6 21.5 L14.6 20.2 L11.5 13.6 L17.5 13.6 Z" fill="#111" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </>
  );
}

/** The site's hatched page rails, framing every scene. */
export function Rails() {
  const rail = {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    width: 18,
    borderLeft: `1px solid ${c.hatch}`,
    borderRight: `1px solid ${c.hatch}`,
    backgroundImage: `repeating-linear-gradient(-45deg, ${c.hatch} 0 1px, transparent 1px 7px)`,
  };
  return (
    <>
      <div style={{ ...rail, left: 60 }} />
      <div style={{ ...rail, right: 60 }} />
    </>
  );
}
