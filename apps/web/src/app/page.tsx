import Link from "next/link";

import { Button } from "@/components/ui/button";

const steps = [
  { n: "01", title: "Ship", body: "Approve Aqua and register a DeskBand strategy. Tokens stay in the wallet." },
  { n: "02", title: "Catch overflow", body: "A large Uniswap v4 swap fills the pool up to a cap. The rest pulls from the maker." },
  { n: "03", title: "Claim USDC", body: "An attestor credits the fill on Arc. The maker claims 6-decimal USDC." },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-14">
      <section className="max-w-3xl">
        <p className="mb-3 text-[13px] font-medium text-[#0066FA]">Uniswap v4 · Aqua SwapVM · Arc USDC</p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Turn idle tokens in your wallet into a Uniswap market.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#5D5D66]">
          Fees settle as USDC on Arc. WalletDesk keeps inventory in the maker wallet and fills the part of a swap the pool does not take.
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
