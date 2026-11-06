import Link from "next/link";

import { ExternalLink, InfoCard, SectionHeading, SplitBar, StatLink } from "@/components/site";
import { Button } from "@/components/ui/button";
import { REPO_URL, repoFile, SEPOLIA_DEPLOYMENT, SEPOLIA_EXPLORER, SEPOLIA_PROOF, txUrl } from "@/lib/live";

const problems = [
  {
    title: "Thin pools, big swaps",
    body: "A Uniswap v4 pool is only as deep as the capital LPs deposited. A large swap walks the curve and pays heavy price impact.",
  },
  {
    title: "Inventory sits idle in wallets",
    body: "Market makers and treasuries hold tokens they would happily quote, but providing liquidity means depositing: custody risk, lockup, and capital split across venues.",
  },
  {
    title: "Static quotes get picked off",
    body: "A price posted on chain goes stale the moment the market moves. Arbitrageurs fill it at the old price and the maker pays for it.",
  },
];

const solutions = [
  {
    tag: "Uniswap v4 hook",
    title: "Overflow routing",
    body: "OverflowHook lets the pool fill a swap up to a cap and fills the rest from the best maker desk in the same transaction, through any v4 router.",
  },
  {
    tag: "1inch Aqua + SwapVM",
    title: "Wallet-native liquidity",
    body: "Makers ship a DeskBand strategy on Aqua: a custom SwapVM instruction that prices a band. Tokens stay in the wallet and move only when a fill pulls them.",
  },
  {
    tag: "Chainlink CRE",
    title: "A price guard that can't be gamed in one block",
    body: "A CRE workflow writes an off-chain reference price. A desk fills only within its maker's limit of both the pool spot and that reference; otherwise the pool takes the whole swap.",
  },
];

const audiences = [
  { who: "Takers", what: "Deeper liquidity on large swaps, in one transaction, from the router they already use." },
  { who: "Makers", what: "Earn a spread on inventory that never leaves their wallet, with a guard against stale fills." },
  { who: "LPs", what: "Keep earning on the pool leg; the desk only takes what exceeds the pool cap." },
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
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-[#4A4A52]">
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
            <SplitBar total={5} poolPart={1} symbol="DA" />
          </div>
          <ol className="mt-6 space-y-3 text-[14px] leading-relaxed">
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#18181B] text-[12px] text-white">1</span>
              <span>The pool fills the first <b>1 DA</b>, as any v4 swap would.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#18181B] text-[12px] text-white">2</span>
              <span>The hook checks every maker desk against the pool price and the Chainlink CRE reference, and picks the best quote.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#18181B] text-[12px] text-white">3</span>
              <span>The maker&apos;s wallet fills the other <b>4 DA</b> through Aqua. Same transaction, any router.</span>
            </li>
          </ol>
          <p className="mt-5 text-[13px] text-[#5D5D66]">
            This exact split ran on Unichain Sepolia:{" "}
            <ExternalLink href={txUrl(SEPOLIA_EXPLORER, SEPOLIA_PROOF.overflowRouterFill)}>view the transaction</ExternalLink>
          </p>
        </div>
      </section>

      {/* Problem */}
      <section className="flex flex-col gap-6">
        <SectionHeading eyebrow="The problem" title="On-chain liquidity is either deposited or stale." />
        <div className="grid gap-4 md:grid-cols-3">
          {problems.map((p) => (
            <InfoCard key={p.title} title={p.title} tone="problem">
              {p.body}
            </InfoCard>
          ))}
        </div>
      </section>

      {/* Solution */}
      <section className="flex flex-col gap-6">
        <SectionHeading
          eyebrow="The solution"
          title="Keep the tokens in the wallet. Fill the overflow. Guard the price."
          lead="Each part of WalletDesk answers one of the problems above, and each is built on one partner's stack."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {solutions.map((s) => (
            <InfoCard key={s.title} tag={s.tag} title={s.title} tone="solution">
              {s.body}
            </InfoCard>
          ))}
        </div>
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
        <p className="text-[13px] text-[#5D5D66]">
          Source, architecture and threat model: <ExternalLink href={REPO_URL}>GitHub repository</ExternalLink>. Explore the{" "}
          <Link href="/live" className="text-[#0066FA] underline-offset-2 hover:underline">live desk</Link> or{" "}
          <Link href="/desk" className="text-[#0066FA] underline-offset-2 hover:underline">make your own</Link>.
        </p>
      </section>
    </div>
  );
}
