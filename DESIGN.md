# WalletDesk Design Language

> The web app for WalletDesk, a Uniswap v4 hook that fills big swaps from market makers' wallets through 1inch Aqua,
> priced against a Chainlink CRE reference. Primary users: hackathon judges (minutes, not hours), then makers and takers.

Extracted with `/map-design` from the live code (`apps/web/src`) and reconciled against the reference interface,
[Designeer](https://designeer.xyz) V2 (maker's launch screenshots; the live site is behind a bot check, so values from it
are sampled, not authored). Coverage note: WalletDesk values are exact (read from source); Designeer values are
approximate.

## 1. Visual Theme

**Theme statement:** calm, exact, verifiable sheet.

**Character:** A white page on a drafting table: the content column sits between hatched rails, divided by dashed
rules, with numbered monospace labels like a technical document. The chrome stays neutral so the only strong colour is
the product's own story: pink for the Uniswap pool leg, blue for the maker-wallet leg.

**References:** Designeer V2 (frame, rails, mono meta, Ctrl K, list rows), Vercel's interface craft (focus, tabular
numbers), Uniswap and 1inch brand hues for the two liquidity legs.

## 2. Color Palette

### Neutral Scale (authored in components; sampled Designeer equivalents in brackets)
| Token | Value | Usage |
|-------|-------|-------|
| `neutral-0` | #FFFFFF | Page and card surface [#FFFFFF] |
| `neutral-5` | #FAFAFB | Raised panel (hero card, step list) [#FAFAFA] |
| `neutral-10` | #F2F2F3 | Table header, chips, audience notes [#EFEFEF] |
| `neutral-border` | rgba(0,0,0,0.08) | Card borders; dashed rules use rgba(0,0,0,0.15) [#D3D9DD] |
| `neutral-40` | #A1A1AA | Decorative only (arrows, dark-band body text) |
| `neutral-60` | #5D5D66 | Secondary text, mono labels (6.5:1 on white) |
| `neutral-70` | #4A4A52 | Body copy |
| `neutral-90` | #18181B | Primary text, dark band |

### Brand / Story colours
| Token | Value | Usage |
|-------|-------|-------|
| `pool` | #D6006F | Uniswap pool leg (white text 5.1:1). Brand #FF007A only on 10% tints |
| `desk` | #0066FA | Maker-wallet leg, primary CTA, links (4.9:1 on white) |
| `desk-ink` | #0050C8 | Blue text on blue tints |
| `cre` | #375BD2 / ink #2A44A0 | Chainlink tag only |
| `dark-link` | #7CB4FF | Links and indices on #18181B (8.3:1) |

### Semantic Colors
| Role | Text | Surface |
|------|------|---------|
| Success | #047857 | #0F9F6E at 8% |
| Error | #9F1239 / #BE123C | #E11D48 at 5% / #FFF7F8 |
| Info / status | #0B6E99 | #00BBFF at 15% |
| Problem cards | #BE123C | #FFF7F8, border #E11D48 at 15% |
| Solution cards | #0050C8 | #F5F9FF, border #0066FA at 15% |

No dark theme yet (colours are set per component; see Don'ts).

## 3. Typography

**Font families:**
- Display / body: Inter, system-ui, sans-serif
- Mono: Geist Mono, ui-monospace (labels, addresses, hashes, numbers in tables, shortcut keys, footer)

**Type scale (ad-hoc, 13 px base for app UI, 15–16 px for prose):**
| Token | Size | Weight | Line height | Usage |
|-------|------|--------|-------------|-------|
| `text-2xs` | 10–11px | 400 mono | 1.4 | Group labels, tags, kbd |
| `text-xs` | 12px | 400–500 | 1.4 | Eyebrow labels (mono, uppercase, 0.06em) |
| `text-sm` | 13px | 400 | 1.5 | App UI, tables, card meta (most used) |
| `text-base` | 14–15px | 400 | 1.6 | Card body, section leads |
| `text-lg` | 16px | 400–600 | 1.6 | Hero lead, card titles |
| `text-2xl` | 24–28px | 600 | 1.2 | Section h2, page h1 on app pages |
| `text-display` | 36–52px | 600 | 1.05 | Landing h1 only |

## 4. Components

| Component | Hierarchy | Purpose | Key variants |
|-----------|-----------|---------|--------------|
| Button (shadcn) | Primitive | Actions | default (blue), outline, size sm/lg |
| Eyebrow | Primitive | Numbered mono section label | with/without index, dark band |
| Badge | Primitive | Status (live, CRE fresh) | solid #0B6E99, secondary, outline |
| CopyButton | Primitive | Copy address/hash, announces "copied" | — |
| Amount (NumberFlow) | Primitive | Numbers that roll to new values | digits |
| SectionHeading | Component | Eyebrow + h1/h2 + lead | level 1/2, index, id |
| InfoCard | Component | Problem / fix / plain card with icon and mono tag | tone problem/solution/plain |
| StatLink | Component | Proof number linking to its source | external/internal |
| SplitBar | Component | Pool leg vs wallet leg of one swap | reveal animation, live width |
| Notice | Component | Inline status (role=status/alert) | info, ok, error |
| TxSteps | Pattern | Multi-transaction progress with explorer links | active/done/error per step |
| JumpMenu | Pattern | Ctrl/⌘K command palette (combobox + listbox) | grouped results |
| Contract rows | Pattern | name · role, short address, copy, explorer | — |
| Code rows | Pattern | label + `File.sol:line` meta, opens GitHub | — |
| Shell | Template | Framed sheet: header, main, footer between rails | fork mode adds demo wallets |

Missing states to watch: skeletons for first chain read (today "Reading the chain…" text), empty state for "no desks".

## 5. Layout

**Grid:** single centred column, `max-w-6xl` (1152px) inside hatched rails (13px, 45° 1px hatch, 1px borders); content
grids of 2–4 columns with 12–16px gaps; landing problem→fix rows use `1fr 2.5rem 1fr`.
**Spacing base unit:** 4px (Tailwind); section rhythm 64–80px on the landing page, 24px between app cards.
**Breakpoints:** Tailwind defaults. `sm` 640 (desktop nav), `md` 768 (rails appear, multi-column), `lg` 1024 (two-column app pages).
**Density mode:** comfortable prose on `/`, compact 13px UI on `/live`, `/desk`.

## 6. Depth

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-none` | none | Most cards (borders carry the structure) |
| `shadow-soft` | 0 8px 30px rgba(0,0,0,0.04) | Hero split card, primary app card |
| `shadow-dialog` | 0 24px 60px rgba(0,0,0,0.14) | Jump menu |

Layering: content 0; sticky header 20; dialog overlay 40 (white 60% + blur); dialog 50; skip link 30.

## 7. Do's and Don'ts

### Do
- Keep pink for the pool leg and blue for the wallet leg everywhere: bars, step dots, OG image, video.
- Put proof one click away: every number links to a transaction, run log, test or line of code.
- Use mono for anything a judge might compare or paste: addresses, hashes, file:line, amounts in tables.
- Number sections (`01`, `02`) and keep one h1 per page.
- Say when nothing moves: "allowance only", "virtual balances, no transfer".
- Underline inline links; colour alone is not enough.

### Don't
- Don't put white text on #FF007A (3.8:1); use `pool` #D6006F.
- Don't disable a button whose label is an action; make it do the action or explain why it can't.
- Don't add colour to chrome (header, footer, rails); colour belongs to content.
- Don't animate without a reduced-motion path (`motion-safe:`, `.wd-reveal`, NumberFlow defaults).
- Don't add a dark theme by sprinkling `dark:` classes; it needs tokens first.

## 8. Responsive

**Strategy:** mobile-first; rails and multi-column grids from `md`.
| Element | Mobile | Desktop |
|---------|--------|---------|
| Navigation | Second scrollable row under the header | Inline links, centre |
| Jump menu trigger | Icon only | "Jump to" + kbd |
| Problem → fix | Stacked, down arrow | Side by side, right arrow |
| App pages | One column | Two columns (`minmax(0,1fr)`) |
Verified: no horizontal scroll at 390, 683 (200% zoom), 800, 1366px.

## 9. Agent Prompt Guide

- Reuse `SectionHeading`, `InfoCard`, `SplitBar`, `TxSteps`, `CopyButton`, `ExternalLink` before writing new markup.
- Colours: use the tokens above; check any new text/background pair for 4.5:1 (scratch script in the PR history).
- Every claim in UI copy needs a link to its evidence (tx, file:line, run log) or must be removed.
- New interactive elements need a visible focus ring, a label, and keyboard support; run axe-core before merging.
- Keep the Designeer frame invariants: rails, dashed rules, mono numbered labels, neutral chrome.

## 10. Motion

| Token | Value | Usage |
|-------|-------|-------|
| `reveal` | 900ms cubic-bezier(0.22,1,0.36,1), 150ms delay | Hero split bar draws pool then wallet, once |
| `width` | 300ms ease-out | Split preview follows the typed swap size |
| NumberFlow | library default | Quote and split amounts roll |
| Spinner | `motion-safe:animate-spin` | Active transaction step |
All motion is off under `prefers-reduced-motion`.

## 11. Voice & Tone

Plain, specific, verifiable. Short sentences; numbers over adjectives ("pool fills 1 DA, wallet fills 4 DA" not
"deep liquidity"). Preferred: "maker wallet", "desk", "overflow", "price guard", "CRE reference". Avoid: "revolutionary",
"seamless", "best-in-class", any claim without a link.
