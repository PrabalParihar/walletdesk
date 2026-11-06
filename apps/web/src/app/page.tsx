import { ArrowDown, ArrowRight, Clock, Lock, ShieldCheck, Split, TrendingDown, Wallet } from "lucide-react";
import Link from "next/link";

import { ExternalLink, InfoCard, SectionHeading, SplitBar, StatLink } from "@/components/site";
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
            <span className="rounded-full bg-[#FF007A]/10 px-2.5 py-1 text-[#C2185B]">Uniswap v4</span>
            <span className="rounded-full bg-[#0066FA]/10 px-2.5 py-1 text-[#0050C8]">1inch Aqua · SwapVM</span>
            <span className="rounded-full bg-[#375BD2]/10 px-2.5 py-1 text-[#2A44A0]">Chainlink CRE</span>
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-[52px] md:leading-[1.05]">
            Wallets back Uniswap pools without depositing.
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-pretty text-[#4A4A52]">
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
        <div className="rounded-[16px] border border-black/8 bg-[#FAFAFB] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:p-6">
          <p className="text-[13px] font-medium text-[#5D5D66]">One swap of 5 DA, pool cap 1 DA</p>
          <div className="mt-4">
            <SplitBar total={5} poolPart={1} symbol="DA" reveal />
          </div>
          <ol className="mt-6 space-y-3 text-[14px] leading-relaxed">
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--pool)] text-[12px] text-white">1</span>
              <span>The pool fills the first <b>1 DA</b>, as any v4 swap would.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#18181B] text-[12px] text-white">2</span>
              <span>The hook checks every maker desk against the pool price and the Chainlink CRE reference, and picks the best quote.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#0066FA] text-[12px] text-white">3</span>
              <span>The maker&apos;s wallet fills the other <b>4 DA</b> through Aqua. Same transaction, any router.</span>
            </li>
          </ol>
          <p className="mt-5 text-[13px] text-[#5D5D66]">
            This exact split ran on Unichain Sepolia:{" "}
            <ExternalLink href={txUrl(SEPOLIA_EXPLORER, SEPOLIA_PROOF.overflowRouterFill)}>view the transaction</ExternalLink>
          </p>
        </div>
      </section>

      {/* Problem → fix, row by row */}
      <section className="flex flex-col gap-6" aria-labelledby="problem-heading">
        <div className="max-w-2xl">
          <p className="text-[12px] font-semibold tracking-wide text-[#0066FA] uppercase">The problem, and the fix</p>
          <h2 id="problem-heading" className="mt-2 text-2xl font-semibold tracking-tight text-balance md:text-[28px]">
            On-chain liquidity is either deposited or stale.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-pretty text-[#5D5D66]">
            Each problem is paired with the part of WalletDesk that answers it, and each part is built on one partner&apos;s stack.
          </p>
        </div>
        <div className="hidden grid-cols-[1fr_2.5rem_1fr] text-[12px] font-semibold tracking-wide uppercase md:grid">
          <span className="text-[#BE123C]">The problem</span>
          <span />
          <span className="text-[#0050C8]">What WalletDesk does</span>
        </div>
        <ul className="flex flex-col gap-4 md:gap-3">
          {pairs.map(({ problem, fix }) => (
            <li key={fix.title} className="grid items-stretch gap-2 md:grid-cols-[1fr_2.5rem_1fr] md:gap-0">
              <InfoCard tag={problem.tag} title={problem.title} tone="problem" icon={problem.icon} className="h-full">
                {problem.body}
              </InfoCard>
              <span className="flex items-center justify-center text-[#A1A1AA]" aria-hidden>
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
            <p key={a.who} className="rounded-[10px] bg-[#F2F2F3] px-4 py-3 text-[13px] leading-relaxed text-[#4A4A52]">
              <b className="text-[#18181B]">{a.who}.</b> {a.what}
            </p>
          ))}
        </div>
      </section>

      {/* Proof */}
      <section className="flex flex-col gap-6">
        <SectionHeading
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

      {/* Judge path */}
      <section className="rounded-[16px] bg-[#18181B] p-6 text-white md:p-8" aria-labelledby="judge-heading">
        <p className="text-[12px] font-semibold tracking-wide text-[#7CB4FF] uppercase">For judges</p>
        <h2 id="judge-heading" className="mt-2 text-2xl font-semibold tracking-tight text-balance md:text-[28px]">
          Judge it in five minutes.
        </h2>
        <ol className="mt-6 grid gap-3 md:grid-cols-3">
          {judgePath.map((step, index) => (
            <li key={step.title} className="flex flex-col rounded-[12px] border border-white/10 bg-white/[0.04] p-4">
              <span className="flex size-7 items-center justify-center rounded-full bg-white text-[13px] font-semibold text-[#18181B]">
                {index + 1}
              </span>
              <h3 className="mt-3 text-[15px] font-semibold">{step.title}</h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[#A1A1AA]">{step.body}</p>
              {step.external ? (
                <ExternalLink href={step.href} className="mt-3 text-[13px] text-[#7CB4FF]">
                  {step.cta}
                </ExternalLink>
              ) : (
                <Link href={step.href ?? "/"} className="mt-3 inline-flex items-center gap-1 text-[13px] text-[#7CB4FF] underline-offset-2 hover:underline">
                  {step.cta}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[13px] leading-relaxed text-[#A1A1AA]">
          Prefer a checklist? <ExternalLink href={repoFile("docs/JUDGING.md")} className="text-[#7CB4FF]">docs/JUDGING.md</ExternalLink>{" "}
          goes prize track by prize track, with links to the code and the transactions. Source, architecture and threat model are in the{" "}
          <ExternalLink href={REPO_URL} className="text-[#7CB4FF]">GitHub repository</ExternalLink>.
        </p>
      </section>
    </div>
  );
}
