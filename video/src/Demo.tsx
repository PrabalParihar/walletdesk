import { AbsoluteFill, Series } from "remotion";

import { type Caption, Footage, type Manifest, type Zoom } from "./Footage";
import { Explainer, Outro, Proof, Title } from "./Scenes";
import { FPS } from "./theme";

// Footage manifests are written by capture/capture.cjs (run it against ./script/demo.sh first).
import desk from "../public/footage/desk/manifest.json";
import guard from "../public/footage/guard/manifest.json";
import how from "../public/footage/how/manifest.json";
import landing from "../public/footage/landing/manifest.json";
import live from "../public/footage/live/manifest.json";

type Clip = { m: Manifest; index: string; title: string; path: string; hold: number; captions: Caption[]; zooms?: Zoom[] };

// Every clip plays at its recorded speed; `hold` keeps the last frame on screen a little longer.
const clips: Clip[] = [
  {
    m: landing as Manifest,
    index: "01",
    title: "The overview",
    path: "/",
    hold: 0.5,
    captions: [
      { at: 0, tag: "WalletDesk", text: "A Uniswap v4 hook that fills big swaps from market makers' wallets" },
      { at: "problem", shift: -1.1, text: "Each problem is paired with its fix, and each fix with a partner's stack" },
      { at: "proof", shift: -1.1, text: "Every claim links to a transaction, a run log or a test" },
      { at: "judges", shift: -1.1, text: "A five-minute path for judges" },
    ],
  },
  {
    m: desk as Manifest,
    index: "02",
    title: "A maker ships a desk",
    path: "/desk",
    hold: 3,
    captions: [
      { at: 0, tag: "Maker", text: "Make a desk: a quote that lives in the maker's wallet" },
      { at: "connect", text: "Demo maker: an Anvil dev account on a local Unichain fork" },
      { at: "form", tag: "SwapVM", text: "DeskBand: price band 0.99–1.01, 30 bps fee, max 100 bps off the reference" },
      { at: "ship", tag: "Aqua + v4", text: "Ship to 1inch Aqua, register on the hook. No tokens leave the wallet." },
    ],
    zooms: [{ at: "form", s: 1.4, x: 760, y: 620 }],
  },
  {
    m: live as Manifest,
    index: "03",
    title: "An overflow swap",
    path: "/live",
    hold: 0.5,
    captions: [
      { at: 0, text: "The live page reads the contracts directly" },
      { at: "connect", tag: "Taker", text: "Demo taker connects" },
      { at: "router", tag: "Uniswap v4", text: "Uniswap's own PoolSwapTest router, not ours" },
      { at: "size", text: "3 DB in: the pool takes its 1 DB cap, a maker's wallet takes 2" },
      { at: "mined", tag: "One tx", text: "Mined: the hook advanced the residual from PoolManager, the router settled it" },
      { at: "fill", shift: -1.1, tag: "Aqua", text: "2 DB in, 1.994 DA out of the maker's wallet; the spread stays with the maker" },
      { at: "balances", shift: -1.1, text: "The maker's wallet changed; Aqua's virtual shelf tracks it" },
    ],
    zooms: [
      { at: "router", s: 1.4, x: 1150, y: 600 },
      { at: "fill", shift: -1.1, s: 1.35, x: 1150, y: 380 },
      { at: "balances", shift: -1.1, s: 1.35, x: 690, y: 300 },
    ],
  },
  {
    m: guard as Manifest,
    index: "04",
    title: "The price guard",
    path: "/live",
    hold: 1,
    captions: [
      { at: 0, tag: "Chainlink CRE", text: "A market move: the CRE reference drops to 0.95 (pushed by hand on the fork)" },
      { at: "connect", text: "The same 3 DB swap through PoolSwapTest" },
      { at: "mined", text: "The desk is now more than 1% from the reference, outside the maker's limit" },
      { at: "skip", tag: "Skipped", text: "Desk skipped, pool filled it alone. The swap never reverts because of a desk." },
    ],
    zooms: [
      { at: 0, s: 1.45, x: 690, y: 740 },
      { at: "connect", s: 1 },
      { at: "router", s: 1.35, x: 1150, y: 600 },
      { at: 9.7, s: 1.45, x: 690, y: 260 },
    ],
  },
  {
    m: how as Manifest,
    index: "05",
    title: "In the code",
    path: "/how",
    hold: 0.5,
    captions: [
      { at: 0, text: "Maker wallet, Aqua, the SwapVM router, the hook, PoolManager and the CRE feed" },
      { at: "steps", shift: -1.1, text: "What happens on chain, step by step" },
      { at: "code", shift: -1.1, tag: "GitHub", text: "Each integration links to the exact line of code" },
      { at: "jump", tag: "Ctrl K", text: "Jump to any contract, transaction or doc" },
    ],
    zooms: [
      { at: "code", shift: -1.1, s: 1.25, x: 930, y: 470 },
      { at: "jump", s: 1.35, x: 800, y: 330 },
    ],
  },
];

const TITLE = 5 * FPS;
const EXPLAINER = 11 * FPS;
const PROOF = 9 * FPS;
const OUTRO = 5 * FPS;
const clipFrames = (clip: Clip) => Math.ceil((clip.m.duration + clip.hold) * FPS);

export const TOTAL_FRAMES = TITLE + EXPLAINER + clips.reduce((sum, clip) => sum + clipFrames(clip), 0) + PROOF + OUTRO;

export function Demo() {
  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      <Series>
        <Series.Sequence durationInFrames={TITLE}>
          <Title />
        </Series.Sequence>
        <Series.Sequence durationInFrames={EXPLAINER}>
          <Explainer />
        </Series.Sequence>
        {clips.map((clip) => (
          <Series.Sequence key={clip.m.name} durationInFrames={clipFrames(clip)}>
            <Footage
              m={clip.m}
              index={clip.index}
              title={clip.title}
              url={`walletdesk · local Unichain fork · ${clip.path}`}
              captions={clip.captions}
              zooms={clip.zooms}
            />
          </Series.Sequence>
        ))}
        <Series.Sequence durationInFrames={PROOF}>
          <Proof />
        </Series.Sequence>
        <Series.Sequence durationInFrames={OUTRO}>
          <Outro />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
}
