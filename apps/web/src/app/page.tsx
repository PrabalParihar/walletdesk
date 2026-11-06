import Link from "next/link";

import { Button } from "@/components/ui/button";

const steps = [
  { n: "01", title: "Ship", body: "Approve Aqua and register a DeskBand strategy. Tokens stay in the wallet until a fill pulls them." },
  { n: "02", title: "Catch overflow", body: "A large Uniswap v4 swap, through any router, fills the pool up to a cap. The best maker desk fills the rest." },
  { n: "03", title: "Stay safe", body: "A Chainlink CRE workflow posts an off-chain reference price. Desks that drift from it, or from the pool, are skipped." },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-14">
      <section className="max-w-3xl">
        <p className="mb-3 text-[13px] font-medium text-[#0066FA]">Uniswap v4 · 1inch Aqua SwapVM · Chainlink CRE</p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Turn idle tokens in your wallet into a Uniswap market.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#5D5D66]">
          WalletDesk keeps inventory in the maker wallet and fills the part of a swap the pool does not take, at a price checked against the pool and an off-chain reference.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/desk">Ship a desk</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/live">Preview an overflow</Link>
          </Button>
        </div>
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <article key={step.n} className="rounded-[10px] border border-black/8 bg-[#F2F2F3] p-4">
            <p className="font-mono text-xs text-[#5D5D66]">{step.n}</p>
            <h2 className="mt-2 text-[15px] font-semibold">{step.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[#5D5D66]">{step.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
