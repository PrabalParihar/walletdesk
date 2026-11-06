import { ArrowDown, ArrowRight, Clock, Lock, ShieldCheck, Split, TrendingDown, Wallet } from "lucide-react";
import Link from "next/link";

import { Eyebrow, ExternalLink, InfoCard, SectionHeading, SplitBar, StatLink } from "@/components/site";
import { Button } from "@/components/ui/button";
import { REPO_URL, repoFile, SEPOLIA_DEPLOYMENT, SEPOLIA_EXPLORER, SEPOLIA_PROOF, txUrl } from "@/lib/live";

/** Each problem sits next to the part of WalletDesk that answers it, and the partner stack that part is built on. */
const pairs = [
  {
    problem: {
      icon: TrendingDown,
      tag: "Hurts takers",
      title: "Thin pools, big swaps",
      body: "A Uniswap v4 pool is only as deep as the capital LPs deposited. A large swap walks the curve and pays heavy price impact.",
    },
    fix: {
      icon: Split,
      tag: "Uniswap v4 hook",
      title: "Overflow routing",
      body: "OverflowHook lets the pool fill a swap up to a cap and fills the rest from the best maker desk in the same transaction, through any v4 router.",
    },
  },
  {
    problem: {
      icon: Lock,
      tag: "Hurts makers",
      title: "Inventory sits idle in wallets",
      body: "Market makers and treasuries hold tokens they would happily quote, but providing liquidity means depositing: custody risk, lockup, and capital split across venues.",
    },
    fix: {
      icon: Wallet,
      tag: "1inch Aqua + SwapVM",
      title: "Wallet-native liquidity",
      body: "Makers ship a DeskBand strategy on Aqua: a custom SwapVM instruction that prices a band. Tokens stay in the wallet and move only when a fill pulls them.",
    },
  },
  {
    problem: {
      icon: Clock,
      tag: "Hurts makers",
      title: "Static quotes get picked off",
      body: "A price posted on chain goes stale the moment the market moves. Arbitrageurs fill it at the old price and the maker pays for it.",
    },
    fix: {
      icon: ShieldCheck,
      tag: "Chainlink CRE",
      title: "A price guard that can't be gamed in one block",
      body: "A CRE workflow writes an off-chain reference price. A desk fills only within its maker's limit of both the pool spot and that reference; otherwise the pool takes the whole swap.",
    },
  },
];

const audiences = [
  { who: "Takers", what: "Deeper liquidity on large swaps, in one transaction, from the router they already use." },
  { who: "Makers", what: "Earn a spread on inventory that never leaves their wallet, with a guard against stale fills." },
  { who: "LPs", what: "Keep earning on the pool leg; the desk only takes what exceeds the pool cap." },
];

/** Structural comparison only: each row describes how a system works, not how well. Sources in docs/COMPETITION.md. */
const compare = {
  columns: ["WalletDesk", "UniswapX", "RFQ desks (Hashflow, Bebop)", "1inch Aqua on its own"],
  rows: [
    ["Where the extra liquidity sits", "Maker wallets, through Aqua", "Wherever fillers source it", "Market makers' inventory", "Maker wallets"],
    ["What the swapper does", "A normal v4 pool swap, any router", "Signs an order; fillers compete", "Asks for a quote, then executes it", "Swaps routed to Aqua strategies"],
    ["Reaches a v4 pool's own swaps", "Yes, inside the pool swap", "Separate order flow", "Separate API", "Not by itself"],
    ["Guard against a stale price", "Pool spot and Chainlink CRE reference, per maker", "Dutch auction decay", "Short quote expiry", "Maker's strategy and range"],
  ],
};

const questions = [
  {
    q: "What if the maker's wallet no longer holds the tokens?",
    a: "The hook checks the wallet balance and Aqua allowance before filling. If either is short, the desk is skipped (MakerUnfunded) and the pool fills the swap. Shipped Aqua balances are virtual, so only real inventory counts.",
  },
  {
    q: "Can someone push the pool price and drain a desk?",
    a: "The pool spot can be moved inside one transaction, so it is not trusted alone. A desk fills only within its maker's limit of both the pool spot and the Chainlink CRE reference, which is written off chain and cannot be moved in the same block.",
  },
  {
    q: "Does a swapper need a special router?",
    a: "No. The hook works inside the pool swap, so any v4 router gets the overflow fill. On Unichain Sepolia it filled a swap sent through Uniswap's own PoolSwapTest router.",
  },
  {
    q: "What if the fill fails halfway?",
    a: "Every desk call runs in a try/catch with a gas cap. On failure the hook returns the residual to PoolManager and the pool fills the whole swap. A desk can be skipped; a swap is never blocked by a desk.",
  },
  {
    q: "Can anyone spam the pool with desks?",
    a: "Each pool holds up to 8 desks. When it is full, a new desk replaces one only if it brings more real, deliverable inventory, and desks that run their own hooks are rejected.",
  },
  {
    q: "Is it audited?",
    a: "No. This is hackathon code. The threat model lists each threat, its mitigation and the test that covers it.",
  },
];

const judgePath = [
  {
    title: "See one swap split on chain",
    body: "5 DA in: the pool fills 1, a maker's wallet fills 4, in a single transaction.",
    href: txUrl(SEPOLIA_EXPLORER, SEPOLIA_PROOF.overflowRouterFill),
    cta: "Open the transaction",
    external: true,
  },
  {
    title: "Watch it read the contracts",
    body: "Maker balances, the CRE price guard and the last fill, live from Unichain Sepolia.",
    href: "/live",
    cta: "Open the live page",
    external: false,
  },
  {
    title: "Check each integration",
    body: "Hook, SwapVM opcode and CRE workflow, each linked to the exact lines on GitHub.",
    href: "/how",
    cta: "Open how it works",
    external: false,
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16 md:gap-20">
      {/* Hero */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="mb-4 flex flex-wrap gap-2 text-[12px] font-medium">
            <span className="rounded-full bg-[#FF007A]/10 dark:bg-[#FF007A]/15 px-2.5 py-1 text-[#C2185B] dark:text-[#FF8CC3]">Uniswap v4</span>
            <span className="rounded-full bg-desk/10 px-2.5 py-1 text-desk-ink">1inch Aqua · SwapVM</span>
            <span className="rounded-full bg-[#375BD2]/10 dark:bg-[#375BD2]/20 px-2.5 py-1 text-[#2A44A0] dark:text-[#B4C3F5]">Chainlink CRE</span>
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-[52px] md:leading-[1.05]">
            Wallets back Uniswap pools without depositing.
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-pretty text-body">
            WalletDesk is a Uniswap v4 hook. When a swap is bigger than the pool should take, the rest fills in the same
            transaction from a market maker&apos;s wallet through 1inch Aqua, at a price checked by Chainlink CRE.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/live">See a live fill</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/how">How it works</Link>
            </Button>
            <ExternalLink href={`${SEPOLIA_EXPLORER}/address/${SEPOLIA_DEPLOYMENT.hook}`} className="text-[13px]">
              Live on Unichain Sepolia
            </ExternalLink>
          </div>
        </div>
        <div className="rounded-[16px] border border-line bg-raised p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:p-6">
          <p className="text-[13px] font-medium text-muted-ink">One swap of 5 DA, pool cap 1 DA</p>
          <div className="mt-4">
            <SplitBar total={5} poolPart={1} symbol="DA" reveal />
          </div>
          <ol className="mt-6 space-y-3 text-[14px] leading-relaxed">
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--pool)] text-[12px] text-white">1</span>
              <span>The pool fills the first <b>1 DA</b>, as any v4 swap would.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] text-surface">2</span>
              <span>The hook checks every maker desk against the pool price and the Chainlink CRE reference, and picks the best quote.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-desk text-[12px] text-white">3</span>
              <span>The maker&apos;s wallet fills the other <b>4 DA</b> through Aqua. Same transaction, any router.</span>
            </li>
          </ol>
          <p className="mt-5 text-[13px] text-muted-ink">
            This exact split ran on Unichain Sepolia:{" "}
            <ExternalLink href={txUrl(SEPOLIA_EXPLORER, SEPOLIA_PROOF.overflowRouterFill)}>view the transaction</ExternalLink>
          </p>
        </div>
      </section>

      {/* Problem → fix, row by row */}
      <section className="flex flex-col gap-6" aria-labelledby="problem-heading">
        <SectionHeading
          index="01"
          id="problem-heading"
          eyebrow="The problem, and the fix"
          title="On-chain liquidity is either deposited or stale."
          lead="Each problem is paired with the part of WalletDesk that answers it, and each part is built on one partner's stack."
        />
        <div className="hidden grid-cols-[1fr_2.5rem_1fr] border-b border-dashed border-line-3 pb-2 font-mono text-[11px] tracking-wider uppercase md:grid">
          <span className="text-problem">The problem</span>
          <span />
          <span className="text-desk-ink">What WalletDesk does</span>
        </div>
        <ul className="flex flex-col gap-4 md:gap-3">
          {pairs.map(({ problem, fix }) => (
            <li key={fix.title} className="grid items-stretch gap-2 md:grid-cols-[1fr_2.5rem_1fr] md:gap-0">
              <InfoCard tag={problem.tag} title={problem.title} tone="problem" icon={problem.icon} className="h-full">
                {problem.body}
              </InfoCard>
              <span className="flex items-center justify-center text-faint" aria-hidden>
                <ArrowRight className="hidden size-5 md:block" />
                <ArrowDown className="size-4 md:hidden" />
              </span>
              <InfoCard tag={fix.tag} title={fix.title} tone="solution" icon={fix.icon} className="h-full">
                {fix.body}
              </InfoCard>
            </li>
          ))}
        </ul>
        <div className="grid gap-3 md:grid-cols-3">
          {audiences.map((a) => (
            <p key={a.who} className="rounded-[10px] bg-sunken px-4 py-3 text-[13px] leading-relaxed text-body">
              <b className="text-ink">{a.who}.</b> {a.what}
            </p>
          ))}
        </div>
      </section>

      {/* How it compares */}
      <section className="flex flex-col gap-6" aria-labelledby="compare-heading">
        <SectionHeading
          index="02"
          id="compare-heading"
          eyebrow="How it compares"
          title="Not another order flow. More liquidity inside the pool you already use."
          lead="UniswapX and RFQ desks route a swap somewhere else. WalletDesk brings maker liquidity into the Uniswap v4 pool swap itself, so it works alongside them: a filler or a router can still send flow through a WalletDesk pool."
        />
        <div className="overflow-x-auto rounded-[12px] border border-line">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <caption className="sr-only">How WalletDesk compares with UniswapX, RFQ desks and 1inch Aqua on its own</caption>
            <thead className="bg-raised">
              <tr className="border-b border-dashed border-line-3">
                <th scope="col" className="w-[22%] px-4 py-3 font-mono text-[11px] font-normal tracking-wider text-muted-ink uppercase">
                  <span className="sr-only">Question</span>
                </th>
                {compare.columns.map((col, i) => (
                  <th key={col} scope="col" className={`px-4 py-3 text-[13px] font-semibold ${i === 0 ? "text-desk-ink" : "text-ink"}`}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compare.rows.map(([label, ...cells]) => (
                <tr key={label} className="border-t border-line align-top">
                  <th scope="row" className="px-4 py-3 font-medium text-ink">
                    {label}
                  </th>
                  {cells.map((cell, i) => (
                    <td key={i} className={`px-4 py-3 ${i === 0 ? "bg-solution font-medium text-ink" : "text-body"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-muted-ink">
          How each system works, from its own documentation; not a ranking. Sources:{" "}
          <ExternalLink href={repoFile("docs/COMPETITION.md")}>docs/COMPETITION.md</ExternalLink>.
        </p>
      </section>

      {/* Proof */}
      <section className="flex flex-col gap-6">
        <SectionHeading
          index="03"
          eyebrow="Proof"
          title="Running on chain, simulated on Chainlink CRE, covered by tests."
          lead="Every number below links to the transaction, the run log, or the test that backs it."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatLink value="2 fills" label="real overflow fills on Unichain Sepolia, through our router and Uniswap's PoolSwapTest" href={txUrl(SEPOLIA_EXPLORER, SEPOLIA_PROOF.stockRouterFill)} />
          <StatLink value="31 txs" label="deploy, ship, register, reference and swaps, all verified on chain" href={repoFile("docs/DEPLOYMENTS.md")} />
          <StatLink value="CRE passed" label="desk-guard simulation passed against the live Sepolia price feed" href={repoFile("services/cre/desk-guard/SIMULATION.md")} />
          <StatLink value="38 tests" label="contract tests; the 21 hook tests also pass on a Unichain mainnet fork against the live PoolManager and Aqua" href={repoFile("contracts/test/Overflow.t.sol")} />
        </div>
      </section>

      {/* Questions */}
      <section className="flex flex-col gap-6" aria-labelledby="questions-heading">
        <SectionHeading index="04" id="questions-heading" eyebrow="Questions judges ask" title="What can go wrong, and what the hook does about it." />
        <div className="divide-y divide-dashed divide-line-3 border-y border-dashed border-line-3">
          {questions.map(({ q, a }) => (
            <details key={q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                {q}
                <span className="font-mono text-[18px] leading-none text-muted-ink transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden>
                  +
                </span>
              </summary>
              <p className="max-w-3xl pb-4 text-[14px] leading-relaxed text-pretty text-body">{a}</p>
            </details>
          ))}
        </div>
        <p className="text-[13px] text-muted-ink">
          Every threat, its mitigation and the test that covers it: <ExternalLink href={repoFile("docs/THREAT_MODEL.md")}>docs/THREAT_MODEL.md</ExternalLink>.
        </p>
      </section>

      {/* Judge path */}
      <section className="rounded-[16px] bg-band p-6 text-white md:p-8 dark:border dark:border-line-2" aria-labelledby="judge-heading">
        <Eyebrow index="05" className="text-faint [&>span:first-child]:text-band-link">
          For judges
        </Eyebrow>
        <h2 id="judge-heading" className="mt-2 text-2xl font-semibold tracking-tight text-balance md:text-[28px]">
          Judge it in five minutes.
        </h2>
        <ol className="mt-6 grid gap-3 md:grid-cols-3">
          {judgePath.map((step, index) => (
            <li key={step.title} className="flex flex-col rounded-[12px] border border-white/10 bg-white/[0.04] p-4">
              <span className="flex size-7 items-center justify-center rounded-full bg-surface text-[13px] font-semibold text-ink">
                {index + 1}
              </span>
              <h3 className="mt-3 text-[15px] font-semibold">{step.title}</h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-faint">{step.body}</p>
              {step.external ? (
                <ExternalLink href={step.href} className="mt-3 text-[13px] text-band-link">
                  {step.cta}
                </ExternalLink>
              ) : (
                <Link href={step.href ?? "/"} className="mt-3 inline-flex items-center gap-1 text-[13px] text-band-link underline decoration-current/35 underline-offset-2 hover:decoration-current">
                  {step.cta}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[13px] leading-relaxed text-faint">
          Prefer a checklist? <ExternalLink href={repoFile("docs/JUDGING.md")} className="text-band-link">docs/JUDGING.md</ExternalLink>{" "}
          goes prize track by prize track, with links to the code and the transactions. Source, architecture and threat model are in the{" "}
          <ExternalLink href={REPO_URL} className="text-band-link">GitHub repository</ExternalLink>.
        </p>
      </section>
    </div>
  );
}
