import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Home story after the hero: problem, fix, proof, where it goes, closer. Static copy from the approved spec.

/** Mono section marker: `[ 0n ]` in ink, caption muted. */
export function Marker({ index, children, as: Tag = "p" }: { index: string; children: React.ReactNode; as?: "p" | "h2" }) {
  return (
    <Tag className="font-mono text-[11px] font-normal tracking-[0.08em] text-muted-ink uppercase">
      <span className="text-ink">[ {index} ]</span> {children}
    </Tag>
  );
}

function Section({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <section aria-label={label} className="border-b border-line">
      <div className="mx-auto w-full max-w-[1120px] px-5 py-16 md:py-24">{children}</div>
    </section>
  );
}

function Heading({ lead, grey }: { lead: string; grey: string }) {
  return (
    <h2 className="mt-4 mb-10 max-w-[44rem] text-[34px] leading-[1.05] font-medium tracking-[-0.04em] md:text-[44px]">
      {lead} <span className="text-muted-ink">{grey}</span>
    </h2>
  );
}

/** Hairline grid: one column on phones, `cols` from md up, cells divided by 1px lines. */
function Cells({ cols, children, className }: { cols: 3 | 4; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid border border-line", cols === 3 ? "md:grid-cols-3" : "md:grid-cols-4", className)}>{children}</div>
  );
}

const cell = "border-b border-line p-6 last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0";
const monoLabel = "font-mono text-[11px] tracking-[0.08em] text-muted-ink uppercase";

function Cell({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div className={cell}>
      <p className={monoLabel}>{label}</p>
      <h3 className="mt-4 mb-2 text-[17px] font-medium tracking-[-0.02em] text-ink">{title}</h3>
      <p className="text-[14px] leading-relaxed text-body">{children}</p>
    </div>
  );
}

export function ProblemSection() {
  return (
    <Section label="The problem">
      <Marker index="02">The problem</Marker>
      <Heading lead="On-chain liquidity is stuck in" grey="the wrong place." />
      <Cells cols={3}>
        <Cell label="01" title="Pools are thin">
          A pool is only as deep as what&apos;s deposited. Big swaps walk the curve and overpay.
        </Cell>
        <Cell label="02" title="Capital sits idle">
          Makers and treasuries hold inventory in wallets. Depositing means lockup and custody risk.
        </Cell>
        <Cell label="03" title="Quotes go stale">
          A price that was fair an hour ago is free money for arbitrage once the market moves.
        </Cell>
      </Cells>
    </Section>
  );
}

export function FixSection() {
  const bar = "flex h-10 overflow-hidden text-[12px] font-semibold text-on-fill tabular-nums";
  const seg = "flex items-center justify-center px-2 text-center leading-tight";
  return (
    <Section label="The fix">
      <Marker index="03">The fix</Marker>
      <Heading lead="The pool fills what it can." grey="A wallet fills the rest." />
      <div className="grid gap-3.5 md:grid-cols-2">
        <figure className="border border-line bg-raised p-5">
          <figcaption className={cn(monoLabel, "mb-4")}>Today · pool only</figcaption>
          <div className={bar} role="img" aria-label="5 DA through a Uniswap pool sized for 1: the whole swap goes through the pool">
            <div className={cn(seg, "w-full bg-pool")}>5 DA through a pool sized for 1</div>
          </div>
          <p className="mt-3.5 text-[14px] text-body">The whole swap walks one thin curve.</p>
        </figure>
        <figure className="border border-line bg-raised p-5">
          <figcaption className={cn(monoLabel, "mb-4")}>With WalletDesk · same transaction</figcaption>
          <div className={bar} role="img" aria-label="5 DA in: 1 filled by the Uniswap pool, 4 filled from a maker wallet">
            <div className={cn(seg, "w-1/5 bg-pool")}>1</div>
            <div className={cn(seg, "flex-1 bg-desk")}>4 from a maker wallet</div>
          </div>
          <p className="mt-3.5 text-[14px] leading-relaxed text-body">
            <span className="font-medium text-ink">Any v4 router.</span> Price checked against the pool and Chainlink. If a
            desk can&apos;t fill, the pool does. <span className="font-medium text-ink">Never reverts.</span>
          </p>
        </figure>
      </div>
      <Cells cols={3} className="mt-3.5">
        <Cell label="1inch Aqua" title="Quote from the wallet">
          Tokens stay put. They move only on a fill.
        </Cell>
        <Cell label="Uniswap v4 hook" title="Fill the overflow">
          Pool takes its cap, best desk takes the rest.
        </Cell>
        <Cell label="Chainlink CRE" title="Guard the price">
          Off-chain consensus price. Stale or off-band desks are skipped.
        </Cell>
      </Cells>
    </Section>
  );
}

const proof = [
  { figure: "31", caption: "transactions on Unichain Sepolia" },
  { figure: "38", caption: "contract tests · hook suite re-run on a mainnet fork" },
  { figure: "0.998950", caption: "CRE consensus · Coinbase + Kraken" },
  { figure: "0", caption: "tokens deposited by the maker" },
];

export function ProofSection() {
  return (
    <Section label="Proof">
      <Marker index="04" as="h2">
        Running, not a mock-up
      </Marker>
      <Cells cols={4} className="mt-6">
        {proof.map((p) => (
          <div key={p.figure} className={cell}>
            <p className="text-[34px] leading-none font-medium tracking-[-0.03em] text-ink tabular-nums">{p.figure}</p>
            <p className={cn(monoLabel, "mt-3 leading-relaxed")}>{p.caption}</p>
          </div>
        ))}
      </Cells>
    </Section>
  );
}

const future = [
  { who: "Market makers", line: "Quote on-chain from the same wallet they already trade from." },
  { who: "Treasuries & DAOs", line: "Earn spread on idle reserves without locking them in a pool." },
  { who: "New pools", line: "Launch deep from day one, before LPs show up." },
  { who: "Every v4 chain", line: "One hook. Any pool, any router, wherever v4 runs." },
];

export function FutureSection() {
  return (
    <Section label="Where this goes">
      <Marker index="05">Where this goes</Marker>
      <Heading lead="Every wallet with inventory" grey="becomes liquidity." />
      <Cells cols={4}>
        {future.map((f) => (
          <div key={f.who} className={cell}>
            <h3 className={monoLabel}>{f.who}</h3>
            <p className="mt-3 text-[15px] leading-normal text-ink">{f.line}</p>
          </div>
        ))}
      </Cells>
    </Section>
  );
}

export function Closer() {
  return (
    <section aria-label="Get started" className="px-5 py-20 text-center md:py-28">
      <h2 className="text-[36px] leading-[1.05] font-medium tracking-[-0.045em] md:text-[48px]">
        Liquidity <span className="text-muted-ink">without</span> deposits.
      </h2>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Link href="/live" className={cn(buttonVariants({ size: "lg" }))}>
          See a live fill
          <ArrowRight aria-hidden />
        </Link>
        <Link href="/desk" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Make a desk
        </Link>
      </div>
    </section>
  );
}
