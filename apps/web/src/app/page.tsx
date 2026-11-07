import { ArrowRight } from "lucide-react";
import Link from "next/link";

/** Approved sparse hero. One headline, one sentence, one button, one product frame. */
export default function HomePage() {
  return (
    <div className="flex flex-col items-center px-6 pt-16 pb-16 md:pt-28">
      <h1 className="max-w-[760px] text-center text-[52px] leading-[1.04] font-semibold tracking-tight text-balance md:text-[64px]">
        Wallets back Uniswap pools without depositing.
      </h1>
      <p className="mt-6 max-w-[460px] text-center text-[16px] leading-relaxed text-body">
        When a swap is bigger than the pool should take, the rest fills from a maker wallet in the same transaction.
      </p>
      <div className="mt-10 flex items-center gap-6">
        <Link
          href="/live"
          className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-desk px-5 text-[14px] font-medium text-on-fill transition-colors duration-200 hover:bg-desk/85 motion-reduce:transition-none"
        >
          See a live fill
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link href="/how" className="text-[14px] text-link underline-offset-4 hover:underline">
          How it works
        </Link>
      </div>
      <div className="mt-16 w-full max-w-[680px] overflow-hidden rounded-[14px] border border-white/[0.08] bg-raised">
        <div className="flex h-11 items-center gap-3 border-b border-white/[0.08] px-4">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
          </span>
          <span className="font-mono text-[11px] tracking-[0.06em] text-muted-ink uppercase">Live fill</span>
          <span className="ml-auto font-mono text-[11px] text-muted-ink">Unichain Sepolia</span>
        </div>
        <div className="p-8">
          <p className="text-[13px] text-muted-ink">One swap of 5 DA</p>
          <div
            className="mt-5 flex h-14 overflow-hidden rounded-[10px] text-[13px] font-medium text-on-fill tabular-nums"
            role="img"
            aria-label="5 DA in: 1 filled by the Uniswap pool, 4 filled from a maker wallet"
          >
            <div className="flex items-center justify-center bg-pool" style={{ width: "20%", minWidth: "4.5rem" }}>
              1 DA
            </div>
            <div className="flex flex-1 items-center justify-center bg-desk">4 DA</div>
          </div>
          <div className="mt-4 flex justify-between text-[12px] text-muted-ink">
            <span>Uniswap pool</span>
            <span>Maker wallet</span>
          </div>
        </div>
      </div>
      <p className="mt-16 font-mono text-[12px] tracking-[0.08em] text-muted-ink uppercase">Uniswap v4 · 1inch Aqua · Chainlink CRE</p>
    </div>
  );
}
