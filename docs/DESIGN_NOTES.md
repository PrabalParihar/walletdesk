# UI design notes

The web app has one job: let a judge understand the problem, the fix, and the proof in a few minutes, then check
each claim on chain. These notes record the UI decisions and the references behind them.

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

**Considered, not used.** Dark mode (colours are set per component, so a theme pass would touch every file just before
submission). Animated beam and shader libraries (they add motion without adding meaning). Charting kits (there is no time
series to show yet).
