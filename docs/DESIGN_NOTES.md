# UI design notes

The web app has one job: let a judge understand the problem, the fix, and the proof in a few minutes, then check
each claim on chain. These notes record the UI decisions and the references behind them.

## Designeer's own interface

[Designeer](https://designeer.xyz) is also a design reference in itself: a calm, technical interface for browsing a lot of
material quickly. We studied its V2 interface from the maker's launch screenshots (Product Hunt, September 2026) and its
published page structure ([llms-full.txt](https://designeer.xyz/llms-full.txt)).

| Designeer pattern | What it does there | What WalletDesk does with it |
| --- | --- | --- |
| A framed page: the content column sits between hatched rails, with dashed dividers | Makes a dense catalogue feel like one ordered sheet | Same frame and dashed header and footer rules on every page (`.wd-frame`) |
| Numbered sections in a monospace label (`01 Design Galleries`) | Gives a long scroll a table of contents | Landing reads `01 The problem, and the fix` → `02 Proof` → `03 For judges`; `/how` is numbered the same way |
| Monospace for metadata: counts, categories, domains, shortcut keys | Separates facts from prose at a glance | File and line under each code link (`OverflowHook.sol:270`), short addresses, tags, footer |
| `Ctrl K` search in the top bar | Reach any of 670 listings without browsing | `Ctrl K` / `⌘K` jump menu: pages, the proof transactions, each contract, the key docs |
| List rows: icon, name, a dot, one-line description | Scans fast, one line per item | `/live` contract rows: name · role, short address, copy, explorer |
| Detail view: preview, then a bar with name, category, domain, save and "Visit site ↗" | One place to look before leaving the site | Each external link carries ↗ and opens the exact page: the transaction, the address, the line of code |
| Colour comes from the content; the chrome stays neutral | The work being shown stands out | Neutral chrome; colour is kept for the pool (pink) and wallet (blue) legs and the partner tags |

Not adopted: the left sidebar (WalletDesk has four pages and a story told top to bottom, not a catalogue to browse) and
the theme toggle (see "Considered, not used" below).

## References

The references were chosen from [Designeer](https://designeer.xyz), a hand-curated catalogue of design inspiration,
resources, tools and portfolios by Dhruv Jaradi. We read its catalogue through the files it publishes for agents
([llms.txt](https://designeer.xyz/llms.txt)) and picked what fits a protocol demo built on Next.js, Tailwind and shadcn/ui.
Rights in each listed work stay with its creator.

| Reference (via Designeer) | Creator | What we took | Where |
| --- | --- | --- | --- |
| [SEESAW](https://designeer.xyz/inspiration/seesaw), [Saaspo](https://designeer.xyz/inspiration/saaspo), [Supahero](https://designeer.xyz/inspiration/supahero) | see the listing | Page sections in a fixed order: claim and visual, problem paired with fix, proof, one closing call to action | `/` |
| [Rauno Freiberg](https://designeer.xyz/portfolios/rauno-freiberg), author of Interaction Guidelines at Vercel | Rauno Freiberg | Visible keyboard focus, skip link, `aria-current` on navigation, labelled inputs, tabular numbers, motion that respects reduced-motion settings | all pages |
| [Details](https://designeer.xyz/inspiration/details), [60fps](https://designeer.xyz/inspiration/60fps) | see the listing | Small moments that explain state: the split bar draws pool then desk; amounts roll to new values | `/`, `/live`, `/desk` |
| [NumberFlow](https://designeer.xyz/resources/numberflow) | Max Barvian | Animated number transitions (`@number-flow/react`, MIT) for quotes and the swap split | `/desk`, `/live` |
| [APCA](https://designeer.xyz/resources/apca), [Color.review](https://designeer.xyz/resources/color-review) | Andrew Somers; Kevin Gutowski | Contrast checking. Three pairs failed WCAG AA and were fixed (below) | all pages |
| [OGFolio](https://designeer.xyz/inspiration/ogfolio) | see the listing | A real link preview: title, the 1 + 4 split, the three partners | `/opengraph-image` |
| [Lucide](https://designeer.xyz/resources/lucide) | Lucide contributors | One icon per problem and per fix, so rows scan by shape | `/` |
| [Emil Kowalski](https://designeer.xyz/portfolios/emil-kowalski) (Sonner) | Emil Kowalski | The idea of transaction feedback that stays in view; we built it inline as a step list instead of toasts | `/desk`, `/live` |

## Decisions

**Problem next to fix.** The landing page pairs each problem with the part of WalletDesk that answers it, and names the
partner stack on the fix. Judges should not have to match two separate lists.

**One closing path for judges.** The page ends with three steps: the transaction where one swap split, the live page
that reads the contracts, and the code map. [JUDGING.md](JUDGING.md) is the long form.

**Transaction steps, not a status line.** Shipping a desk can take five wallet prompts (two approvals, a read, ship,
register). The step list shows which prompt is open, links each mined transaction, and marks where a failure happened.
Steps that move no tokens say so ("allowance only", "virtual balances, no transfer"), because that is the product's claim.

**Preview before you swap.** `/live` shows how the typed swap size would split between the pool cap and a desk, before
any wallet prompt, and says what happens if no desk passes the price guard.

**Copy, then verify.** Addresses and ids have copy buttons and show both ends of the value, which is what people compare.

**Contrast fixes.** Measured with the WCAG 2 formula:

| Pair | Before | After |
| --- | --- | --- |
| White on the pool segment (Uniswap pink) | 3.8:1 on `#FF007A` | 5.1:1 on `#D6006F` |
| White on the "live" badge | 2.2:1 on `#00BBFF` | 5.7:1 on `#0B6E99` |
| Green "swap mined" notice text | 3.1:1 (`#0F9F6E`) | 5.0:1 (`#047857`) |

**Reviews.** A design critique, a WCAG 2.1 AA audit (axe-core: no violations on any page or in the open jump menu;
keyboard order, focus return and 200% zoom checked) and a code review were run on this pass. They led to: connect
buttons that connect (and explain when no wallet is installed) instead of disabled buttons labelled "Connect", underlined
links, a page heading on every page, and options in the jump menu that are not nested links.

**Considered, not used.** Dark mode (colours are set per component, so a theme pass would touch every file just before
submission). Animated beam and shader libraries (they add motion without adding meaning). Charting kits (there is no time
series to show yet).
