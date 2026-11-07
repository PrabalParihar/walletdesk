import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Closer, FixSection, FutureSection, Marker, ProblemSection, ProofSection } from "@/components/home-story";
import { HeroStreams, LiveStrip } from "@/components/live-strip";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Approved home story: hero with the live strip, then problem, fix, proof, where it goes, closer. */
export default function HomePage() {
  return (
    <>
      <section className="relative border-b border-line">
        <div className="wd-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto w-full max-w-[1120px] px-5 pt-14 pb-6 md:pt-24">
          <div className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr] md:gap-6">
            <div>
              <Marker index="01">Liquidity layer for Uniswap v4</Marker>
              <h1 className="mt-5 mb-6 text-[44px] leading-none font-medium tracking-[-0.045em] md:text-[72px]">
                Liquidity <span className="text-muted-ink">without</span> deposits.
              </h1>
              <p className="mb-8 max-w-[30rem] text-[16px] leading-normal text-body">
                WalletDesk lets market makers back any Uniswap v4 pool from their own wallets. No deposits. When a swap outgrows
                the pool, a wallet fills the rest in the same transaction.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/live" className={cn(buttonVariants({ size: "lg" }))}>
                  See a live fill
                  <ArrowRight aria-hidden />
                </Link>
                <Link href="/how" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                  How it works
                </Link>
              </div>
            </div>
            <HeroStreams />
          </div>
          <LiveStrip />
        </div>
      </section>
      <ProblemSection />
      <FixSection />
      <ProofSection />
      <FutureSection />
      <Closer />
    </>
  );
}
