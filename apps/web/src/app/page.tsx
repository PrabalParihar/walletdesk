import { ArrowDown, ArrowRight, Clock, Lock, ShieldCheck, Split, TrendingDown, Wallet } from "lucide-react";
import Link from "next/link";

import { Eyebrow, ExternalLink, InfoCard, SectionHeading, SplitBar, StatLink } from "@/components/site";
import { Button } from "@/components/ui/button";
import { REPO_URL, repoFile, SEPOLIA_EXPLORER, SEPOLIA_PROOF, txUrl } from "@/lib/live";

/** Each problem sits next to the part of WalletDesk that answers it, and the partner stack that part is built on. */
const pairs = [
  {
    problem: {
      icon: TrendingDown,
      tag: "Hurts takers",
      title: "Thin pools, big swaps",
      body: "A large swap walks a shallow curve.",
    },
    fix: {
      icon: Split,
      tag: "Uniswap v4 hook",
      title: "Overflow routing",
      body: "The pool fills to a cap. A desk fills the rest, in the same transaction.",
    },
  },
  {
    problem: {
      icon: Lock,
      tag: "Hurts makers",
      title: "Inventory sits idle in wallets",
      body: "Quoting means depositing.",
    },
    fix: {
      icon: Wallet,
      tag: "1inch Aqua + SwapVM",
      title: "Wallet-native liquidity",
      body: "The band stays in the wallet. Tokens move only on a fill.",
    },
  },
  {
    problem: {
      icon: Clock,
      tag: "Hurts makers",
      title: "Static quotes get picked off",
      body: "A posted price goes stale.",
    },
    fix: {
      icon: ShieldCheck,
      tag: "Chainlink CRE",
      title: "A price guard that can't be gamed in one block",
      body: "A fill has to sit near both the pool and the CRE reference.",
    },
  },
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
    <div className="flex flex-col gap-28 md:gap-36">
      {/* Centered first screen: type, one action, then the split. Same rhythm as Mobbin and Details, on the dark canvas. */}
      <section className="mx-auto flex min-h-[calc(100dvh-8.5rem)] w-full max-w-[720px] flex-col items-center justify-center pt-6 text-center md:pt-10">
        <p className="mb-6 flex flex-wrap justify-center gap-2 text-[11px] font-medium">
          <span className="inline-flex h-6 items-center rounded-full bg-[#FF007A]/10 px-2.5 text-[#C2185B] dark:text-[#FF8CC3]">Uniswap v4</span>
          <span className="inline-flex h-6 items-center rounded-full bg-desk/10 px-2.5 text-desk-ink">1inch Aqua</span>
          <span className="inline-flex h-6 items-center rounded-full bg-[#375BD2]/10 px-2.5 text-[#2A44A0] dark:text-[#B4C3F5]">Chainlink CRE</span>
        </p>
        <h1 className="max-w-[12ch] text-[44px] font-semibold tracking-[-0.045em] text-balance md:text-[68px] md:leading-[0.98]">
          Wallets back Uniswap pools without depositing.
        </h1>
        <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted-ink">Large swaps continue after the pool&apos;s cap.</p>
        <div className="mt-8 flex items-center gap-5">
          <Button asChild size="lg">
            <Link href="/live">See a live fill</Link>
          </Button>
          <Link href="/how" className="text-[14px] text-muted-ink underline decoration-current/30 underline-offset-4 hover:text-ink">
            How it works
          </Link>
        </div>
        <figure className="mt-10 w-full max-w-[520px] md:mt-16">
          <figcaption className="mb-3 text-[13px] text-muted-ink">5 DA in · cap 1</figcaption>
          <SplitBar total={5} poolPart={1} symbol="DA" reveal />
          <ol className="mt-6 grid grid-cols-3 gap-4 text-left text-[13px] leading-snug">
            <li>
              <span className="mb-1 block font-mono text-[11px] text-[var(--pool)]">01</span>
              Pool takes its cap
            </li>
            <li>
              <span className="mb-1 block font-mono text-[11px] text-muted-ink">02</span>
              Best desk is used
            </li>
            <li>
              <span className="mb-1 block font-mono text-[11px] text-desk">03</span>
              Wallet fills the rest
            </li>
          </ol>
          <p className="mt-5 text-[13px]">
            <ExternalLink href={txUrl(SEPOLIA_EXPLORER, SEPOLIA_PROOF.overflowRouterFill)}>Transaction</ExternalLink>
          </p>
        </figure>
      </section>

      {/* Problem → fix, row by row */}
      <section className="flex flex-col gap-6" aria-labelledby="problem-heading">
        <SectionHeading index="01" id="problem-heading" eyebrow="The problem" title="Deposited, or stale." />
        <div className="hidden grid-cols-[1fr_2.5rem_1fr] border-b border-line pb-2 font-mono text-[11px] tracking-wider uppercase md:grid">
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
      </section>

      {/* How it compares */}
      <section className="flex flex-col gap-6" aria-labelledby="compare-heading">
        <SectionHeading
          index="02"
          id="compare-heading"
          eyebrow="How it compares"
          title="Inside the pool, not beside it."
        />
        <div className="relative overflow-hidden rounded-[14px] border border-line shadow-[var(--wd-shadow-float)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <caption className="sr-only">How WalletDesk compares with UniswapX, RFQ desks and 1inch Aqua on its own</caption>
            <thead className="bg-raised">
              <tr className="border-b border-line">
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
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent md:hidden" />
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
          title="On chain, simulated, tested."
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
        <SectionHeading index="04" id="questions-heading" eyebrow="Questions" title="What the hook does when something fails." />
        <div className="divide-y divide-line border-y border-line">
          {questions.map(({ q, a }) => (
            <details key={q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[10px] px-2 py-3 text-[15px] font-medium text-ink transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-hover motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
                {q}
                <span className="font-mono text-[18px] leading-none text-muted-ink transition-transform duration-200 ease-[cubic-bezier(0.3,1.12,0.4,1)] group-open:rotate-45 motion-reduce:transition-none" aria-hidden>
                  +
                </span>
              </summary>
              <p className="max-w-3xl px-2 pb-4 text-[14px] leading-relaxed text-pretty text-body">{a}</p>
            </details>
          ))}
        </div>
        <p className="text-[13px] text-muted-ink">
          Every threat, its mitigation and the test that covers it: <ExternalLink href={repoFile("docs/THREAT_MODEL.md")}>docs/THREAT_MODEL.md</ExternalLink>.
        </p>
      </section>

      {/* Judge path */}
      <section className="rounded-[24px] bg-band p-6 text-white shadow-[var(--wd-shadow-float)] md:p-8 dark:border dark:border-line-2" aria-labelledby="judge-heading">
        <Eyebrow index="05" className="text-faint [&>span:first-child]:text-band-link">
          For judges
        </Eyebrow>
        <h2 id="judge-heading" className="mt-2 text-2xl font-semibold tracking-tight text-balance md:text-[28px]">
          Judge it in five minutes.
        </h2>
        <ol className="mt-6 grid gap-3 md:grid-cols-3">
          {judgePath.map((step, index) => (
            <li key={step.title} className="flex flex-col rounded-[14px] border border-white/10 bg-white/[0.04] p-4">
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
