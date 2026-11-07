# WalletDesk redesign: Direction C ("black, editorial, technical")

Date: 2026-11-07 · Status: draft for approval · Owner: Prabal

## 1. Intent

WalletDesk should look like serious infrastructure from a funded company, not a hackathon project. The ETHGlobal
submission is already in and links to the live site (https://web-production-ced59.up.railway.app), so judges will
click through it; after them, market makers and traders who might use it.

Research behind the direction (done 2026-11-07):

- **Dribbble, tag `y-combinator`:** the startup sites that read as "funded" share three habits: one striking object at
  the centre of the hero (Rove's card), the real product in the first screen (Explo), and everything else very quiet
  (Vova's "Generative AI for Financial Firms": black, small type, a particle field).
- **Designeer, Popular landing pages:** mostly personal portfolios; the shared pattern is one memorable moving element in
  the hero. Borrow that pattern, not the playful illustration style.
- **WalletDesk already owns its memorable element:** one swap, filled by two sources (pink pool, blue wallet). Today it is a
  small flat bar in a card. The redesign makes it the centrepiece.

Three mocked directions were shown (A cinematic split bar, B light product-first, C black editorial). **Prabal chose C.**

## 2. Scope

Prabal's answer: **everything.** In order:

1. **Site redesign, all pages:** `/` (home), `/how`, `/desk`, `/live`, `/fees` (Rebates), the shared shell (nav, footer),
   the Ctrl K jump menu, the Open Graph image, and the favicon/mark if they clash.
2. **Accessibility review and design critique** of the redesigned pages (`design:accessibility-review`,
   `design:design-critique`), with fixes.
3. **`DESIGN.md` rewritten** to describe the new system (it currently lists light-theme values that no longer match).
4. **Remotion demo video restyled** to match, following Remotion's published agent best practices (install the Remotion
   skill first).

### Goals

- A judge landing on `/` understands the product in one screen: what it is, the pool/wallet split, and that it is live.
- Every page looks like the same company: same type, labels, buttons, spacing, and colour rules.
- Real chain data stays real: every number shown comes from the chain or the repo, never invented.

### Non-goals

- No contract, keeper, or CRE workflow changes.
- No new product features, pages, or flows. Copy may be tightened; behaviour stays.
- No new hosting or domain work (Railway auto-deploys `apps/web` from `main`).

### Anti-goals (would be a failure even if it "works")

- A generic dark SaaS template (purple gradients, glassmorphism, stock 3D blobs).
- Decoration that hides the product: the swap panel, numbers and transactions must stay the most readable things.
- Motion that is busy, loops distractingly, or ignores `prefers-reduced-motion`.
- Colour used for decoration. Pink and blue mean pool and wallet, nothing else.
- Losing working behaviour: wallet connect, swaps, desk shipping, rebate claims, deployment detection, the fork demo
  accounts.

## 3. The look (decided)

Taken from the approved mock (`.superpowers/brainstorm/…/content/directions.html`, card C):

- **Background:** pure black (`#000`), with a faint dot grid (1px dots, 18px pitch, ~9% white) that fades out at the top
  and bottom of the hero. Panels sit one step up from black.
- **Headlines:** large, tight, regular-weight sans (weight ~500, tracking about -0.04em). Part of a headline may be set in
  grey for rhythm.
- **Home headline (Prabal's choice, revised 2026-11-07):** "Liquidity *without* deposits." (`without` in grey). It
  replaces "Wallets back Uniswap pools without depositing." on the home page, in the OG image, and in the video title
  scene. Buttons: `SEE A LIVE FILL` → `/live`, `HOW IT WORKS` → `/how`.
- **Home tells the story, not just the mechanism (Prabal, 2026-11-07):** judges must see what problem WalletDesk solves
  and that it can become a big product, without the page getting text-heavy. The home page is five short sections plus a
  closer, approved as the `home-story` mock:
  1. **Hero** `[ 01 ] LIQUIDITY LAYER FOR UNISWAP V4`: headline, one sentence ("WalletDesk lets market makers back any
     Uniswap v4 pool from their own wallets. No deposits. When a swap outgrows the pool, a wallet fills the rest in the
     same transaction."), the two buttons, the dot streams, the live strip.
  2. **The problem** `[ 02 ]`: "On-chain liquidity is stuck in *the wrong place.*" Three cells: Pools are thin / Capital
     sits idle / Quotes go stale, one sentence each.
  3. **The fix** `[ 03 ]`: "The pool fills what it can. *A wallet fills the rest.*" A before/after pair (Today · pool only:
     one pink bar; With WalletDesk: 1 pink + 4 blue, "Any v4 router … Never reverts."), then three cells naming the
     partners: 1inch Aqua (quote from the wallet), Uniswap v4 hook (fill the overflow), Chainlink CRE (guard the price).
  4. **Proof** `[ 04 ] RUNNING, NOT A MOCK-UP`: four real figures: 31 transactions on Unichain Sepolia, 38 contract tests
     (hook suite re-run on a mainnet fork), CRE consensus 0.998950 (Coinbase + Kraken), 0 tokens deposited by the maker.
  5. **Where this goes** `[ 05 ]`: "Every wallet with inventory *becomes liquidity.*" Four cells: Market makers,
     Treasuries & DAOs, New pools, Every v4 chain, one sentence each.
  6. **Closer:** "Liquidity *without* deposits." with `SEE A LIVE FILL` and `MAKE A DESK`.
  No market-size or growth numbers: potential is shown through who can plug in, never through invented figures.
- **Labels, numbers, buttons:** monospace, upper case, letter-spaced, with section markers like `[ 01 ] UNISWAP V4 HOOK`.
- **Buttons:** square corners. Primary: solid off-white with black text. Secondary: 1px outline.
- **Colour:** black, white, greys. Pink = Uniswap pool leg, blue = maker-wallet leg. No other accent colours (status
  colours for errors/success may stay where they carry meaning).
- **Signature element (home hero):** two streams of dots, pink (pool) and blue (wallet), flowing in and merging into one
  swap that exits to the taker, labelled `POOL · 1 DA`, `MAKER WALLET · 4 DA`, `TAKER · 5 DA`.
- **Live strip (home hero, bottom):** a row of live numbers with mono labels: `POOL SPOT`, `CRE REF` (with its age),
  `DESKS`, `CHAIN` (Unichain Sepolia).

## 4. Calls I made (Claude's, open to override)

- **Motion:** the dot streams animate gently (dots flow in, settle, the merged swap pulses once), then rest; no endless
  busy loop. Under `prefers-reduced-motion: reduce` they render static.
- **Theme:** black only. The light theme and its toggle go away; the shell already hard-codes dark colours, so light is
  half-broken today.
- **Fonts:** keep Inter (sans) and Geist Mono (mono). Both are already loaded by the site and bundled in the video, and fit
  the mock.
- **Live strip data:** `/live` loads pool spot, the CRE reference and guard state inside one `useEffect` in
  `app/live/page.tsx`. Move those existing reads, unchanged, into a shared hook (e.g. `lib/use-live-state.ts`) used by
  both `/live` and the home strip. No new chain reads. The mock's "maker quote" is dropped because nothing in the app
  reads one. While loading or unavailable, show `—`, never a made-up number.
- **Dot streams are an example, not live data:** the split comes from the repo's `exampleSwap` (5 DA: 1 pool, 4 wallet),
  and the graphic carries a small `EXAMPLE SWAP` label and a matching `aria-label`, so it never reads as the last real
  fill.
- **Pink and blue on black:** use the mock's brighter values (around `#FF3D9A` pool, `#3D8BFF` wallet) so they read on
  black; every text use is checked against WCAG AA, and text on coloured fills uses whichever of black/white passes.
  The same two values go into the video theme and `DESIGN.md`.
- **Shell:** replace the floating rounded pill nav with a flat top bar (mark + wordmark left, mono links right, Connect as
  the one solid control), matching the mock. Nav keeps all four pages: HOW · DESK · LIVE · REBATES (no DOCS link;
  `/docs` keeps redirecting to `/how`). Footer is one quiet mono line using Prabal's chosen wording, "Powered by SwapVM
  and Aqua — © Degensoft Ltd 2025" (PR #15 is folded into this work).
- **Delivery:** several PRs, each approved by Prabal before merging (merging redeploys the live site): (1) tokens, shell,
  footer; (2) home; (3) inner pages, jump menu, OG image; (4) `DESIGN.md`; (5) video. Accessibility review and critique
  run after (3), with fixes in their own PR.
- **Inner pages:** same treatment as home without the dot-stream hero: a `[ 0n ]` eyebrow, a large tight headline, then
  the page's existing working UI restyled (square corners, hairline borders, mono numbers). `/how` keeps the architecture
  diagram but restyles it to black.
- **Mobile:** must work at 390px wide with no horizontal scroll; the dot-stream graphic stacks under the headline.

## 5. Constraints

- **Stack stays:** Next.js 16 (App Router), Tailwind 4 with the CSS tokens in `apps/web/src/app/globals.css`, shadcn
  primitives in `components/ui`, wagmi/viem. Restyle by changing tokens and components, not by rewriting data logic in
  `lib/`.
- **Accessibility floor:** WCAG 2.1 AA contrast for all text (grey text on black must still pass), visible keyboard focus,
  the existing skip link, `aria-label`s on the split graphics, reduced-motion respected.
- **Deploys:** merging to `main` redeploys the live site. Work happens on a branch and reaches `main` through a PR that
  Prabal approves.
- **Concurrent edits:** a Cursor agent merged "sparse product" PRs #13 and #14 into `apps/web` on 2026-11-07, and PR #15
  (footer) is open. Before starting, confirm no other agent is mid-change on `apps/web`, and rebase on the latest `main`.
- **Video:** most of the video is screen recordings of the site (`video/capture/capture.cjs` against the local fork via
  `./script/demo.sh`, needs `cast`). No voiceover has been recorded yet (Prabal), so scenes and timings may change.
  `capture.cjs` already fails against the current one-screen home (it scrolls to `#problem-heading` and `#judge-heading`,
  which no longer exist), so the capture script is rewritten for the new pages, the overview scene is rebuilt for a
  one-screen home, and `docs/WALKTHROUGH.md` (the voiceover script) is updated to the new scene list. Keep 1920×1080,
  30 fps, silent for the voiceover, and roughly 2 to 2.5 minutes.

## 6. Done means

- All five pages, nav, footer, jump menu and OG image match section 3, checked by screenshot at desktop (1366px) and
  mobile (390px).
- `npm run build` and lint pass; every flow still works on the fork demo (connect, ship a desk, overflow swap, price-guard
  skip, rebate claim).
- Accessibility review findings at AA are fixed; critique findings are fixed or listed with a reason.
- `DESIGN.md` describes the shipped system with exact values.
- The video renders with the new look, re-captured footage, and passes Remotion's best-practice checks.
- Fresh submission screenshots are taken from the live site after deploy.

## 7. Left to the builder

Exact spacing scale, grey values (within AA), dot animation timing and implementation (SVG, canvas, or CSS), component
structure, how the architecture diagram is restyled, and the order of pages within step 1.
