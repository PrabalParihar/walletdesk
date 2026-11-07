# WalletDesk Direction C: Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the whole WalletDesk web app (`apps/web`) to Direction C (black, editorial, technical) without changing any data logic or flow.

**Architecture:** One black theme, defined once as CSS tokens in `globals.css` and mirrored in `src/lib/palette.ts` so a Node test can check every text pairing against WCAG AA. The Live page's chain reads move, unchanged, into a `useLiveState` hook so the home page can show a live strip. The home hero gets an SVG dot-streams graphic. Delivered as three PRs, each merged only after Prabal approves (merging to `main` redeploys the live Railway site).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4 (CSS tokens), shadcn primitives, wagmi 3 / viem 2, Node 24 built-in test runner (`node --test`, native TypeScript type-stripping).

**Spec:** `docs/superpowers/specs/2026-11-07-walletdesk-direction-c-redesign-design.md`

Follow-up plans, written after this one ships: (a) accessibility review + design critique fixes, (b) `DESIGN.md` rewrite, (c) Remotion video restyle and re-capture.

## Global Constraints

- Black only: page `#000000`. No light theme, no theme toggle.
- Colour meaning: pool = `#FF3D9A`, maker wallet = `#3D8BFF`. No other accent colours; existing error/success colours stay where they carry meaning.
- Text on pink or blue fills is black (`#000000`); white fails AA on both (about 3.3:1).
- All text must pass WCAG 2.1 AA: 4.5:1 for body/label text, 3:1 for text ≥ 24px or ≥ 18.66px bold.
- Fonts: Inter (sans), Geist Mono (mono). Already loaded in `src/app/layout.tsx`; do not add fonts.
- Labels, numbers and buttons are monospace, upper case, letter-spaced (`tracking-[0.08em]`). Section markers read `[ 01 ]`.
- Buttons have square corners. Primary: `#EDEDED` fill, black text. Secondary: 1px outline `rgba(255,255,255,0.18)`, `#EDEDED` text.
- Headlines: weight 500, tracking `-0.04em`.
- Home headline, exact: `Liquidity ` / `without` (grey) / ` deposits.`
- Home buttons, exact: `SEE A LIVE FILL` → `/live`, `HOW IT WORKS` → `/how`.
- Home section copy is fixed by the spec's "Home tells the story" list (sections 1–6); use that text verbatim.
- `main` gained `chain-switcher.tsx`, `use-switch-network.ts`, `live-swap.tsx` and `.wd-range`/`.wd-pop`/`.wd-celebrate` CSS (commits ab9a493, 067123c). Keep their behaviour; restyle them to Direction C where a task touches them.
- Nav, exact labels and order: `HOW` → `/how`, `DESK` → `/desk`, `LIVE` → `/live`, `REBATES` → `/fees`.
- Footer, exact: `Powered by SwapVM and Aqua — © Degensoft Ltd 2025`.
- Never show an invented number: missing or loading values render `—`.
- `prefers-reduced-motion: reduce` removes all animation.
- No horizontal scroll at 390px width.
- No changes to contracts, `lib/contracts.ts`, `lib/chains.ts`, `lib/desk.ts`, or flow behaviour.

## Review Focus

1. **RPC slow or down:** the home live strip and `/live` show `—` and an error notice, never `0` or a stale made-up value, and the hero layout does not jump when data arrives. Test: Task 4 `formatStrip(null)` and `formatStrip` with `referenceX18: null`.
2. **No CRE reference / no desks / no fill yet:** `referenceX18 === null`, `deskCount === 0n`, `lastFill` maker is zero. Strip shows `—` for CRE with no age, `0` desks (a real zero, not missing). Test: Task 4.
3. **Reduced motion:** dot streams render static and complete; nothing animates. Test: Task 5 checks the CSS rule is scoped under `prefers-reduced-motion: no-preference`.
4. **Narrow screens (390px) with long numbers:** strip wraps to 2×2, dot graphic stacks below the headline, no horizontal scroll. Test: Task 6 and Task 10 `scrollWidth` check.
5. **No wallet extension:** the Connect control shows `NO WALLET`, styled and disabled, not broken. Test: Task 3 visual check in a headless browser (no extension).

---

## PR 1: tokens, shell, footer (branch `redesign/1-tokens-shell`)

### Task 1: Palette, contrast check, and test script

**Files:**
- Create: `apps/web/src/lib/palette.ts`
- Create: `apps/web/src/lib/contrast.ts`
- Test: `apps/web/src/lib/contrast.test.ts`
- Modify: `apps/web/package.json` (scripts), `apps/web/tsconfig.json` (`compilerOptions`), `.gitignore` (repo root)

**Interfaces:**
- Produces: `palette` (const object, keys below), `contrastRatio(foreground: string, background: string): number` (hex `#RRGGBB` in, ratio out), `npm test` script.

- [ ] **Step 1: Branch from latest `main`**

```bash
git switch main && git pull --ff-only && git switch -c redesign/1-tokens-shell
```

- [ ] **Step 2: Add `.superpowers/` to the root `.gitignore`**, and to `apps/web/package.json` scripts add `"test": "node --test \"src/**/*.test.ts\""`. In `apps/web/tsconfig.json` add `"allowImportingTsExtensions": true` (tests import siblings with `.ts` extensions, which Node requires; Next already sets `noEmit`).

- [ ] **Step 3: Write the failing test** `src/lib/contrast.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio } from "./contrast.ts";
import { palette } from "./palette.ts";

test("contrastRatio matches known values", () => {
  assert.equal(Math.round(contrastRatio("#FFFFFF", "#000000") * 10) / 10, 21);
  assert.equal(Math.round(contrastRatio("#000000", "#000000") * 10) / 10, 1);
});

const AA = 4.5;
const bodyText: Array<[keyof typeof palette, keyof typeof palette]> = [
  ["ink", "page"], ["ink", "raised"], ["ink", "sunken"],
  ["muted", "page"], ["muted", "raised"], ["muted", "sunken"],
  ["onFill", "pool"], ["onFill", "wallet"],
  ["onPrimary", "primary"], ["pool", "page"], ["wallet", "page"], ["danger", "page"], ["ok", "page"],
];
for (const [fg, bg] of bodyText) {
  test(`${fg} on ${bg} passes AA`, () => {
    assert.ok(contrastRatio(palette[fg], palette[bg]) >= AA, `${palette[fg]} on ${palette[bg]}`);
  });
}

test("white on the legs fails, which is why onFill is black", () => {
  assert.ok(contrastRatio("#FFFFFF", palette.pool) < AA);
  assert.ok(contrastRatio("#FFFFFF", palette.wallet) < AA);
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd apps/web && npm test`
Expected: FAIL, cannot find module `./contrast.ts`.

- [ ] **Step 5: Implement** `palette` in `src/lib/palette.ts` with exactly these values, and `contrastRatio` in `src/lib/contrast.ts` (WCAG 2.1 relative luminance: sRGB channel → linear with the 0.03928 threshold, `L = 0.2126R + 0.7152G + 0.0722B`, ratio `(L1 + 0.05) / (L2 + 0.05)` with L1 the lighter).

| key | value | use |
|---|---|---|
| `page` | `#000000` | page |
| `raised` | `#0A0A0A` | panels, cards |
| `sunken` | `#141414` | inputs, table heads |
| `ink` | `#EDEDED` | primary text |
| `body` | `#C4C4C4` | paragraphs |
| `muted` | `#8A8A8A` | labels, secondary text, grey headline words |
| `faint` | `#5A5A5A` | decorative only, never text |
| `pool` | `#FF3D9A` | pool leg |
| `wallet` | `#3D8BFF` | maker-wallet leg |
| `onFill` | `#000000` | text on pool/wallet fills |
| `primary` | `#EDEDED` | primary button fill |
| `onPrimary` | `#000000` | primary button text |
| `danger` | `#FB7185` | errors |
| `ok` | `#34D399` | success |

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/web && npm test`
Expected: all tests PASS. If a pairing fails, adjust only that grey upward until it passes, and note the value in the commit message.

- [ ] **Step 7: Commit**

```bash
git add .gitignore apps/web/package.json apps/web/tsconfig.json apps/web/src/lib/palette.ts apps/web/src/lib/contrast.ts apps/web/src/lib/contrast.test.ts
git commit -m "feat(web): Direction C palette with an AA contrast test"
```

### Task 2: Black theme tokens

**Files:**
- Modify: `apps/web/src/app/globals.css` (`:root` block, delete the `.dark` block, radius tokens, add `.wd-grid`)
- Modify: `apps/web/src/app/layout.tsx:6,40-44` (remove `themeInitScript`, set `className` on `<html>` to include `dark`)
- Delete: `apps/web/src/components/theme-toggle.tsx`
- Test: `apps/web/src/lib/contrast.test.ts` (add one test)

**Interfaces:**
- Consumes: `palette` from Task 1.
- Produces: existing Tailwind token names keep working (`bg-surface`, `bg-raised`, `bg-sunken`, `text-ink`, `text-body`, `text-muted-ink`, `text-faint`, `border-line`, `bg-desk`, `bg-pool`); `bg-desk` now means the wallet leg `#3D8BFF`; `bg-primary text-primary-foreground` is the off-white primary button. New utility class `.wd-grid` (dot grid). New Tailwind colour `on-fill` (`#000000`).

- [ ] **Step 1: Write the failing test** (append to `contrast.test.ts`)

```ts
import { readFileSync } from "node:fs";
test("globals.css :root uses the palette values", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").toLowerCase();
  for (const [token, value] of [["--wd-surface", palette.page], ["--wd-ink", palette.ink], ["--wd-muted", palette.muted], ["--pool", palette.pool], ["--wd-desk", palette.wallet]] as const) {
    assert.match(css, new RegExp(`${token}:\\s*${value.toLowerCase()};`), token);
  }
  assert.doesNotMatch(css, /^\.dark\s*\{/m, "the .dark block is gone");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && npm test`
Expected: FAIL on `--wd-surface`.

- [ ] **Step 3: Rewrite `:root`** so every `--wd-*` and shadcn variable takes its Direction C value from the palette table (`--background`/`--wd-surface` = page, `--card`/`--wd-raised` = raised, `--muted`/`--wd-sunken` = sunken, `--foreground`/`--wd-ink` = ink, `--wd-body` = body, `--wd-muted`/`--muted-foreground` = muted, `--wd-faint` = faint, `--pool` = pool, `--wd-desk` = wallet, `--primary` = primary, `--primary-foreground` = onPrimary, `--wd-link` = ink, `--ring` = ink, `--destructive`/`--wd-problem` = danger, lines `rgba(255,255,255,0.08/0.12/0.18)`). Delete the `.dark { … }` block. Set `--radius-sm/md/lg/xl/2xl/3xl/4xl` and `--radius` to `0px` except `--radius-sm: 2px`. Add `--color-on-fill: #000000`. Add `.wd-grid` (1px dots at `rgba(255,255,255,0.09)`, 18px pitch, `mask-image: linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent)`). Remove `.wd-desk` hatched rails. Change the focus-visible outline `border-radius` to `0`.

- [ ] **Step 4: In `layout.tsx`** delete the `themeInitScript` import and `<script>`, and add `dark` to the `<html>` className (keeps any `dark:` utilities on). Delete `theme-toggle.tsx`.

- [ ] **Step 5: Run tests and build**

Run: `cd apps/web && npm test && npm run build && npm run lint`
Expected: tests PASS, build succeeds, lint clean.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src/app/globals.css apps/web/src/app/layout.tsx apps/web/src/components/theme-toggle.tsx apps/web/src/lib/contrast.test.ts
git commit -m "feat(web): black-only Direction C tokens, square corners, dot grid"
```

### Task 3: Shell (top bar, nav, footer) and Button

**Files:**
- Modify: `apps/web/src/components/shell.tsx` (whole render)
- Modify: `apps/web/src/components/ui/button.tsx` (variants)

**Interfaces:**
- Consumes: tokens from Task 2.
- Produces: `buttonVariants` with variants `default` (`bg-primary text-primary-foreground`: `#EDEDED` fill, black text), `outline` (1px `border-line-3`, ink text), `ghost`; all `rounded-none`, `font-mono uppercase tracking-[0.08em] text-[12px]`. Later tasks use `<Button>` / `buttonVariants()` instead of hand-written `bg-desk text-white` buttons.

- [ ] **Step 1: Button variants** as in Interfaces; keep the existing sizes and the `asChild` behaviour.

- [ ] **Step 2: Shell.** Replace the floating pill with a flat top bar: full-width, 56px tall, `border-b border-line`, content max-width 1120px. Left: `/mark.svg` + `WalletDesk` (sans, 14px, weight 600) linking to `/`. Right: nav links from the Global Constraints (mono, 12px, upper case, `text-muted-ink`, active `text-ink` with `aria-current="page"`), then the demo-account buttons (unchanged logic), then Connect as `buttonVariants({ size: "sm" })` showing `CONNECT`, the short address when connected, or `NO WALLET` when no injected connector. Mobile: the nav row scrolls horizontally inside its own container (keep the existing `md:hidden` second row, restyled mono). Remove the blue radial glow `div`. Footer: one `<p>` with the exact footer text, mono 11px `text-muted-ink`, `border-t border-line`, centred. Keep the skip link and `<main id="main">` exactly.

- [ ] **Step 3: Build and look**

Run: `cd apps/web && npm run build && npm run lint`, then `npm run dev` and, with the Playwright browser (no wallet extension), open `http://localhost:43127/` at 1366×860 and at 390×844.
Expected: build passes; top bar matches the mock; Connect reads `NO WALLET` and is disabled; `document.documentElement.scrollWidth <= innerWidth` at 390; footer is one line with the exact text; Tab from the address bar shows the skip link, then a visible focus outline on each nav link.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/shell.tsx apps/web/src/components/ui/button.tsx
git commit -m "feat(web): flat top bar, mono nav, square buttons, one-line footer"
```

- [ ] **Step 5: Open PR 1 and stop for approval.** Push, open a PR titled `feat(web): Direction C tokens and shell (1/3)` with before/after screenshots of `/` at 1366 and 390. Ask Prabal to approve the merge. After merge: wait for the Railway deploy (`railway deployment list --service web --json`, newest status `SUCCESS`), check the live URL returns 200 on all five pages, then close PR #15 with the comment "Folded into the Direction C redesign (PR 1/3)."

## PR 2: home (branch `redesign/2-home`, from `main` after PR 1 merges)

### Task 4: `useLiveState` hook and live-strip formatting

**Files:**
- Create: `apps/web/src/lib/live-strip.ts`, `apps/web/src/lib/use-live-state.ts`
- Test: `apps/web/src/lib/live-strip.test.ts`
- Modify: `apps/web/src/app/live/page.tsx` (move the `Fill`/`Balances`/`Guard`/`Keeper*` types, the six state hooks and the 8-second load `useEffect` out; import the hook. Line numbers changed after commit 067123c; find them by name)

**Interfaces:**
- Produces, in `live-strip.ts` (pure, no imports from `@/`): types `Fill`, `KeeperFill`, `KeeperSkip`, `Balances`, `Guard` (moved verbatim from `live/page.tsx`); `humanAge(seconds: number): string` (moved verbatim); `type StripItem = { label: string; value: string }`; `formatStrip(guard: Guard | null, chainLabel: string, formatPrice: (x18: bigint) => string): StripItem[]`.
- Produces, in `use-live-state.ts`: `useLiveState(deployment: Deployment | null): { fill: Fill | null; balances: Balances | null; guard: Guard | null; keeper: KeeperFill[]; skips: KeeperSkip[]; loading: boolean; error: string | null }`. Same reads, same 8-second interval, same cancellation as today's effect.

- [ ] **Step 1: Write the failing test** `src/lib/live-strip.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatStrip, humanAge, type Guard } from "./live-strip.ts";

const price = (x: bigint) => (Number(x) / 1e18).toFixed(6);
const guard: Guard = { spotX18: 993386000000000000n, referenceX18: 998693000000000000n, referenceAge: 39600, maxReferenceAge: 86400, deskCount: 1n, cap: 1000000000000000000n };

test("labels and values in order", () => {
  assert.deepEqual(formatStrip(guard, "Unichain Sepolia", price), [
    { label: "POOL SPOT", value: "0.993386" },
    { label: "CRE REF", value: "0.998693 · 11 h" },
    { label: "DESKS", value: "1" },
    { label: "CHAIN", value: "Unichain Sepolia" },
  ]);
});
test("no data yet shows dashes, not zeros", () => {
  assert.deepEqual(formatStrip(null, "Unichain Sepolia", price).map((i) => i.value), ["—", "—", "—", "Unichain Sepolia"]);
});
test("no CRE reference shows a dash with no age", () => {
  assert.equal(formatStrip({ ...guard, referenceX18: null, referenceAge: null }, "Unichain Sepolia", price)[1].value, "—");
});
test("zero desks is a real zero", () => {
  assert.equal(formatStrip({ ...guard, deskCount: 0n }, "Unichain Sepolia", price)[2].value, "0");
});
test("humanAge unchanged", () => {
  assert.equal(humanAge(30), "30s");
  assert.equal(humanAge(600), "10 min");
  assert.equal(humanAge(39600), "11 h");
  assert.equal(humanAge(259200), "3 d");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && npm test`
Expected: FAIL, cannot find module `./live-strip.ts`.

- [ ] **Step 3: Implement `live-strip.ts`** (move the types and `humanAge` verbatim; `formatStrip` returns the four items above; CRE value is `${formatPrice(ref)} · ${humanAge(age)}` when both exist, `formatPrice(ref)` when only the price exists, `—` otherwise).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npm test`
Expected: PASS.

- [ ] **Step 5: Implement `useLiveState`** by moving the `useEffect` body from `live/page.tsx:93-175` and the six state hooks it sets, unchanged. In `live/page.tsx`, replace them with `const { fill, balances, guard, keeper, skips, loading, error } = useLiveState(deployment);` and import the moved types/`humanAge` from `@/lib/live-strip`. Keep `swapError`, `busy`, `swapHash` and the swap code in the page. If the page's swap code calls a setter that moved (for example to refresh after a swap), expose `refresh(): void` from the hook and call it there.

- [ ] **Step 6: Verify `/live` behaves the same**

Run: `cd apps/web && npm run build && npm run lint`, then `npm run dev`; open `http://localhost:43127/live`.
Expected: build passes; within 10 seconds the Price guard panel shows pool spot, CRE value with age, desks, and the maker wallet balances, the same as https://web-production-ced59.up.railway.app/live.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/live-strip.ts apps/web/src/lib/live-strip.test.ts apps/web/src/lib/use-live-state.ts apps/web/src/app/live/page.tsx
git commit -m "refactor(web): move Live's chain reads into useLiveState"
```

### Task 5: Dot-streams graphic

**Files:**
- Create: `apps/web/src/components/dot-streams.tsx`, `apps/web/src/lib/dot-streams.ts`
- Test: `apps/web/src/lib/dot-streams.test.ts`
- Modify: `apps/web/src/app/globals.css` (add `wd-flow` keyframes under `prefers-reduced-motion: no-preference`)

**Interfaces:**
- Produces: `dotCounts(poolPart: number, deskPart: number, total: number): { pool: number; desk: number }` (proportional, each side at least 1 when its part > 0, sum = `total`); `<DotStreams poolPart={number} deskPart={number} symbol={string} />` rendering an SVG (`viewBox="0 0 300 250"`, like the approved mock) with `role="img"` and `aria-label="Example swap of {total} {symbol}: {poolPart} filled by the Uniswap pool, {deskPart} from a maker wallet"`, a mono `EXAMPLE SWAP` label, and the three labels `POOL · {poolPart} {symbol}`, `MAKER WALLET · {deskPart} {symbol}`, `TAKER · {total} {symbol}`.

- [ ] **Step 1: Write the failing test** `src/lib/dot-streams.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dotCounts } from "./dot-streams.ts";

test("proportional split of 1 : 4 over 30 dots", () => assert.deepEqual(dotCounts(1, 4, 30), { pool: 6, desk: 24 }));
test("a tiny side still gets one dot", () => assert.deepEqual(dotCounts(0.01, 4.99, 30), { pool: 1, desk: 29 }));
test("an empty side gets none", () => assert.deepEqual(dotCounts(5, 0, 30), { pool: 30, desk: 0 }));
test("animation only runs when motion is allowed", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const blocks = css.split("@media (prefers-reduced-motion: no-preference)").slice(1);
  assert.ok(blocks.some((b) => /\.wd-flow\b/.test(b.slice(0, b.indexOf("\n}")))), ".wd-flow is defined inside a no-preference block");
  assert.doesNotMatch(css.split("@media")[0], /\.wd-flow\b/, ".wd-flow is not defined outside a media block");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && npm test`
Expected: FAIL, cannot find module `./dot-streams.ts`.

- [ ] **Step 3: Implement `dotCounts`, the `wd-flow` animation, and `<DotStreams>`.** Dots: pink stream from top-left, blue from bottom-left, converging at a white node (`#EDEDED`, r=6) at about (172,126), then a dashed line to the right edge toward the taker label. Dot positions are deterministic (no `Math.random` during render, so server and client markup match). Animation: each dot fades and slides in along its stream once, staggered, about 1.6s total, then rests; the node pulses once. Colours from tokens (`var(--pool)`, `var(--wd-desk)`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dot-streams.tsx apps/web/src/lib/dot-streams.ts apps/web/src/lib/dot-streams.test.ts apps/web/src/app/globals.css
git commit -m "feat(web): dot-streams graphic for the home hero"
```

### Task 6: Home page

**Files:**
- Modify: `apps/web/src/app/page.tsx` (whole file)
- Create: `apps/web/src/components/live-strip.tsx`

**Interfaces:**
- Consumes: `useLiveState`, `formatStrip` (Task 4), `<DotStreams>` (Task 5), `useDeployment` (`@/lib/use-deployment`), `networkLabel`/`networkMode` (`@/lib/chains`), `formatPriceX18` (`@/lib/desk`), `buttonVariants` (Task 3).
- Produces: `<LiveStrip />` (client component: 4 cells, mono labels, `aria-live="polite"` on the values).

- [ ] **Step 1: Build the hero** inside a `relative` section with `.wd-grid` behind it. Two columns from `md` up (text 1.1fr, graphic 1fr), stacked below `md` with the graphic under the text. Left: eyebrow `[ 01 ] LIQUIDITY LAYER FOR UNISWAP V4` (mono 11px, muted), the exact headline as an `<h1>` with `without` in `text-muted-ink` (size 44px mobile / 72px desktop, weight 500, tracking -0.045em, leading 1.0), the spec's hero sentence (`text-body`, 16px, max 30rem), then the two exact buttons (`default` and `outline` variants). Right: `<DotStreams>` showing the repo's example swap: total = `exampleSwap` formatted with `decimals0` (5 DA), `poolPart = 1`, `deskPart = total - 1`. It is a fixed, labelled example and does not change when chain data loads. The strip's CRE cell uses `formatStrip(guard, networkLabel[networkMode], (x) => formatPriceX18(x, decimals0, decimals1))`. Bottom of the hero: `<LiveStrip />`, 4 columns desktop, 2×2 at 390px, `border-t border-line`.

- [ ] **Step 2: Story sections.** Create `apps/web/src/components/home-story.tsx` exporting `ProblemSection`, `FixSection`, `ProofSection`, `FutureSection`, `Closer` (server components, no data fetching), and render them after the hero in this order. Copy is the spec's sections 2–6, verbatim. Layout per the approved mock `.superpowers/brainstorm/25059-1794022488/content/home-story.html`: each section `border-b border-line`, `py-16 md:py-24`, an `Eyebrow` with `[ 0n ]`, a 34–44px weight-500 heading with the grey half in `text-muted-ink`, then a hairline grid of cells (`grid md:grid-cols-3` / `md:grid-cols-4`, cells divided by `border-line`, single column at 390px). Fix section bars use the same fills as `SplitBar` (`bg-pool`/`bg-desk`, `text-on-fill`). Proof figures are static strings from the spec (no fetching).

- [ ] **Step 3: Verify**

Run: `cd apps/web && npm test && npm run build && npm run lint`, then `npm run dev` and check `http://localhost:43127/` at 1366×860 and 390×844 in the Playwright browser (full-page screenshots).
Expected: matches the approved `home-story` mock top to bottom; every heading and figure matches the spec text exactly; strip fills with real Sepolia values within 10 seconds and shows `—` before that; no horizontal scroll at 390; with Chrome DevTools "Emulate CSS prefers-reduced-motion: reduce" the dots render static and complete.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/components/live-strip.tsx apps/web/src/components/home-story.tsx
git commit -m "feat(web): Direction C home: problem, fix, proof, potential"
```

- [ ] **Step 5: Open PR 2 and stop for approval** (title `feat(web): Direction C home (2/3)`, screenshots at 1366 and 390). After merge, confirm the Railway deploy and that the live home strip shows Sepolia numbers.

## PR 3: inner pages and link preview (branch `redesign/3-pages`, from `main` after PR 2 merges)

### Task 7: Shared page components

**Files:**
- Modify: `apps/web/src/components/site.tsx` (`Eyebrow`, `SectionHeading`, `PageHeader`, `InfoCard`, `StatLink`, `SplitBar`, `StatusChip`, `FilterChip`, `EmptyState`)
- Modify: `apps/web/src/components/ui/card.tsx`, `ui/input.tsx`, `ui/badge.tsx`, `notice.tsx`, `tx-steps.tsx`, `copy-button.tsx`, `mint-test-tokens.tsx`

**Interfaces:**
- Produces: same component names and props as today (pages keep compiling). Visual rules: `Eyebrow` renders `[ {index} ] {CAPTION}` (index in `text-ink`, caption `text-muted-ink`); headings weight 500, tracking -0.04em; `SplitBar` fills use `text-on-fill`, square corners, legend dots square; cards `bg-raised border border-line`, no radius, no hover lift; chips mono upper case, square, 1px border; inputs `bg-sunken border-line-2`, mono values.

- [ ] **Step 1: Restyle the components** per Interfaces. Remove every remaining `text-white` on `bg-desk` / `bg-[var(--pool)]` and every `rounded-[10px]`/`rounded-[14px]`/`rounded-full` in these files (status dots may stay round).

- [ ] **Step 2: Verify no leftovers in components**

Run: `cd apps/web && grep -rnE "rounded-\[(10|14)px\]|bg-desk[^/]*text-white|text-white[^\"]*bg-desk|#0050C8|#0066FA|#D6006F" src/components`
Expected: no output. Then `npm run build && npm run lint` pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components
git commit -m "feat(web): Direction C shared components"
```

### Task 8: Inner pages and the architecture diagram

**Files:**
- Modify: `apps/web/src/app/how/page.tsx`, `desk/page.tsx`, `live/page.tsx`, `fees/page.tsx`, `apps/web/src/components/live-swap.tsx` (classes and page headers only; no logic), and the `.wd-range`/`.wd-pop`/`.wd-celebrate` rules in `globals.css` (old blue `rgba(0,102,250,…)` → wallet `rgba(61,139,255,…)`)
- Modify: `apps/web/public/architecture.svg` (colours only)

**Interfaces:**
- Consumes: Task 7 components, `buttonVariants` (Task 3).

- [ ] **Step 1: Each page** opens with `PageHeader`/`SectionHeading` using index markers: `/how` `[ 01 ] HOW IT WORKS`, `/desk` `[ 02 ] MAKE A DESK`, `/live` `[ 03 ] LIVE`, `/fees` `[ 04 ] REBATES`. Replace hand-written buttons and links styled as buttons with `buttonVariants`. Remove leftover radii and white-on-colour text. Keep every handler, state hook, and `aria-*` attribute unchanged.

- [ ] **Step 2: Architecture diagram.** In `public/architecture.svg` change only fills and strokes: background and boxes to `#000`/`#0A0A0A`, box borders `rgba(255,255,255,0.18)` (highlighted boxes `#3D8BFF`), text `#EDEDED`/`#8A8A8A`, arrows `#8A8A8A`, the "Any v4 router" box `#3D8BFF` with black text. Move the "fill residual" label so it no longer sits on its arrow.

- [ ] **Step 3: Verify**

Run: `cd apps/web && grep -rnE "rounded-\[(10|14)px\]|text-white|#0050C8|#0066FA|#D6006F" src/app --include=page.tsx; npm test && npm run build && npm run lint`
Expected: grep prints nothing; tests, build and lint pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app apps/web/public/architecture.svg
git commit -m "feat(web): Direction C how, desk, live, rebates"
```

### Task 9: Link preview image and mark

**Files:**
- Modify: `apps/web/src/app/opengraph-image.tsx` (whole render, `alt`)
- Modify: `apps/web/src/app/icon.svg`, `apps/web/public/mark.svg`

- [ ] **Step 1: OG image** (1200×630): black background with the dot grid drawn as a repeating radial gradient, mark + `WalletDesk` top-left, mono `LIVE ON UNICHAIN SEPOLIA` top-right in `#8A8A8A`, the exact home headline (grey middle words), and a mono bottom row `UNISWAP V4 HOOK · 1INCH AQUA · CHAINLINK CRE`. Update `alt` to "WalletDesk: one swap, two sources of liquidity. A Uniswap pool and a maker's wallet fill one swap together."

- [ ] **Step 2: Mark and icon:** square corners on the background (`rx="0"`), background `#000`, bars `#FF3D9A` and `#3D8BFF` with `rx="1"`.

- [ ] **Step 3: Verify**

Run: `cd apps/web && npm run build`, `npm run start`, then `curl -s -o /tmp/og.png http://localhost:3000/opengraph-image` and open it.
Expected: 1200×630 image showing the new headline; no text clipped.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/opengraph-image.tsx apps/web/src/app/icon.svg apps/web/public/mark.svg
git commit -m "feat(web): Direction C link preview and mark"
```

### Task 10: Whole-site check, then PR 3

- [ ] **Step 1: Screens.** With `npm run dev`, capture `/`, `/how`, `/desk`, `/live`, `/fees` at 1366×860 and 390×844 in the Playwright browser; on each, evaluate `document.documentElement.scrollWidth <= window.innerWidth`.
Expected: all `true`; every page matches the Global Constraints.

- [ ] **Step 2: Flows on the fork.** Run `./script/demo.sh` from the repo root (fork, contracts, keeper, UI with `NEXT_PUBLIC_NETWORK=fork`), then in the browser: connect as Demo maker, ship a desk on `/desk`; connect as Demo taker, run an overflow swap on `/live` through OverflowRouter and through PoolSwapTest; trigger a price-guard skip as `docs/WALKTHROUGH.md` describes; claim a rebate on `/fees` if a treasury is configured.
Expected: each flow completes as it did before the redesign; the split bar and tx steps render in the new style.

- [ ] **Step 3: Open PR 3 and stop for approval** (title `feat(web): Direction C pages and link preview (3/3)`, screenshots of all five pages). After merge, confirm the Railway deploy, re-check all five live URLs return 200, retake the four submission screenshots into `~/Desktop/walletdesk-screenshots/`, and regenerate `~/Desktop/walletdesk-cover.png` from the new OG image (pad to 1200×675).
