import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ExternalLink, InfoCard, SectionHeading } from "@/components/site";
import { repoFile } from "@/lib/live";

/** "contracts/src/OverflowHook.sol#L270" → "OverflowHook.sol:270", shown under each link like a listing's meta line. */
function codeRef(href: string): string {
  const path = href.split("/blob/main/")[1] ?? href;
  const [file, line] = path.split("#L");
  const name = file.split("/").pop() ?? file;
  return line ? `${name}:${line}` : name;
}

export const metadata: Metadata = {
  title: "How it works",
  description: "One swap, two sources of liquidity, one transaction: the OverflowHook, the DeskBand SwapVM opcode and the Chainlink CRE price guard.",
};

const steps = [
  {
    title: "A maker ships a desk",
    body: "The maker approves 1inch Aqua and ships a DeskBand strategy: a price band (low to high), a fee and an optional decay. Aqua records virtual balances. No tokens move.",
  },
  {
    title: "The maker registers it on the hook",
    body: "OverflowHook checks the strategy was really shipped, rejects maker hooks, and stores the maker's max deviation. Up to 8 desks per pool; a full table only admits a desk with more real inventory.",
  },
  {
    title: "A large swap arrives, through any router",
    body: "If the exact input is above the pool cap, the hook quotes every desk for the residual and drops any desk outside its limit of the pool spot or the Chainlink CRE reference, or whose wallet can't pay.",
  },
  {
    title: "The best desk fills the residual",
    body: "The hook advances the residual from PoolManager reserves, pays it to the maker through the SwapVM router (Aqua pull and push), and returns a BeforeSwapDelta that charges the swap caller.",
  },
  {
    title: "The pool fills the cap; the router settles",
    body: "The pool swaps only the cap. The router settles the full input at the end of the unlock and receives pool output plus desk output. If anything fails, the pool fills everything instead.",
  },
];

const skips = [
  ["No quote", "The desk's SwapVM preview reverts (empty shelf, bad band)."],
  ["Maker wallet unfunded", "The wallet or its Aqua allowance can't cover the quote. Shipped balances are virtual."],
  ["Too far from the pool spot", "The quote is outside the maker's max deviation of residual × pool price."],
  ["CRE reference missing or stale", "A feed is configured but has no fresh price. The hook fails closed."],
  ["Too far from the CRE reference", "The quote is outside the maker's max deviation of residual × reference price."],
  ["SwapVM fill reverted", "The hook catches it, hands the residual back to PoolManager, and lets the pool fill."],
];

const partners = [
  {
    tag: "Uniswap v4",
    title: "OverflowHook",
    points: [
      ["beforeSwap + beforeSwapReturnDelta permissions", repoFile("contracts/src/OverflowHook.sol", 270)],
      ["Cap, residual, reserve check, desk selection", repoFile("contracts/src/OverflowHook.sol", 301)],
      ["Fill: take, SwapVM call, refund path, delta", repoFile("contracts/src/OverflowHook.sol", 381)],
      ["Stock PoolSwapTest router filled from a desk", repoFile("contracts/test/Overflow.t.sol")],
    ],
  },
  {
    tag: "1inch Aqua · SwapVM",
    title: "DeskBand instruction",
    points: [
      ["New SwapVM opcode", repoFile("contracts/src/swapvm/DeskBand.sol", 21)],
      ["Band math: v4 price unit, both directions, by value", repoFile("contracts/src/swapvm/DeskBandMath.sol", 45)],
      ["Modified router: opcode table + preview", repoFile("contracts/src/swapvm/WalletDeskRouter.sol", 33)],
      ["What changed vs stock SwapVM", repoFile("docs/SWAPVM_DIFF.md")],
    ],
  },
  {
    tag: "Chainlink CRE",
    title: "desk-guard workflow",
    points: [
      ["Cron → Coinbase + Kraken → consensus → report", repoFile("services/cre/desk-guard/main.ts", 206)],
      ["DeskPriceFeed consumer (onReport, ERC165)", repoFile("contracts/src/DeskPriceFeed.sol", 66)],
      ["Hook reads the reference, fails closed", repoFile("contracts/src/OverflowHook.sol", 461)],
      ["Simulation run log", repoFile("services/cre/desk-guard/SIMULATION.md")],
    ],
  },
];

export default function HowPage() {
  return (
    <div className="flex flex-col gap-14">
      <section className="flex flex-col gap-6">
        <SectionHeading
          level={1}
          eyebrow="How it works"
          title="One swap, two sources of liquidity, one transaction."
          lead="The pool fills its cap. A wallet fills the rest."
        />
        <figure className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[var(--wd-shadow-float)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/architecture.svg" alt="WalletDesk architecture: maker wallet, Aqua registry, WalletDeskRouter, OverflowHook, v4 PoolManager, any v4 router, DeskPriceFeed, and the Chainlink CRE desk-guard workflow" className="w-full" />
        </figure>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading index="01" eyebrow="Step by step" title="What happens on chain" />
        <ol className="max-w-3xl">
          {steps.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-4">
              <div className="flex flex-col items-center">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-medium text-surface">{i + 1}</span>
                {i < steps.length - 1 ? <span className="my-1 w-px flex-1 bg-line-2" aria-hidden /> : null}
              </div>
              <div className={i < steps.length - 1 ? "pb-6" : ""}>
                <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{s.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-body">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading
          index="02"
          eyebrow="The price guard"
          title="A desk can be skipped. A swap is never blocked."
          lead="Every desk problem is a skip, logged as DeskSkipped with a reason. With no desk left, the pool fills the whole swap. The pool spot alone can be pushed inside one transaction; the off-chain CRE reference can't."
        />
        <div className="overflow-hidden rounded-[14px] border border-line shadow-[var(--wd-shadow-float)]">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-sunken text-muted-ink">
              <tr>
                <th className="px-4 py-2.5 font-medium">Skip reason</th>
                <th className="px-4 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {skips.map(([reason, when]) => (
                <tr key={reason} className="border-t border-line align-top">
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">{reason}</td>
                  <td className="px-4 py-2.5 text-body">{when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading index="03" eyebrow="Under the hood" title="Each partner, in the code" lead="Links open the exact lines on GitHub." />
        <div className="grid gap-4 md:grid-cols-3">
          {partners.map((p) => (
            <InfoCard key={p.title} tag={p.tag} title={p.title} tone="solution">
              <ul className="-mx-1 divide-y divide-line">
                {p.points.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start justify-between gap-3 rounded-md px-1 py-2 transition-colors hover:bg-surface"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] text-ink group-hover:text-link">{label}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-muted-ink">{codeRef(href)}</span>
                      </span>
                      <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-ink group-hover:text-link" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </InfoCard>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <InfoCard title="Safety, in short">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Nobody can replace another maker&apos;s desk; eviction needs more real inventory, not shipped virtual balances.</li>
            <li>Maker hook traits are rejected; preview and fill calls are gas-capped.</li>
            <li>Re-entering the pool from inside a fill reverts on the hook&apos;s lock.</li>
            <li>The hook keeps no tokens: every fill nets to zero before the unlock ends.</li>
          </ul>
          <p className="mt-3">
            Full list: <ExternalLink href={repoFile("docs/THREAT_MODEL.md")}>threat model</ExternalLink>. Not audited; hackathon code.
          </p>
        </InfoCard>
        <InfoCard title="Try it">
          <p>
            The <Link href="/live" className="text-link underline decoration-current/35 underline-offset-2 hover:decoration-current">live page</Link> reads the Unichain Sepolia
            deployment: maker balances, the price guard, the last fill. With a little Sepolia ETH you can mint test tokens and run an overflow swap
            yourself, or <Link href="/desk" className="text-link underline decoration-current/35 underline-offset-2 hover:decoration-current">ship your own desk</Link>.
          </p>
          <p className="mt-3">
            Every transaction from the live run: <ExternalLink href={repoFile("docs/DEPLOYMENTS.md")}>docs/DEPLOYMENTS.md</ExternalLink>.
          </p>
        </InfoCard>
      </section>
    </div>
  );
}
