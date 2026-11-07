import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";

import { ExternalLink } from "@/components/site";
import { repoFile } from "@/lib/live";

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
  ["A maker ships a desk", "A DeskBand on Aqua. No tokens move."],
  ["It is registered", "The hook stores the maker's limit. Up to 8 desks."],
  ["A large swap arrives", "Any v4 router. Desks outside the spot or CRE reference are dropped."],
  ["The best desk fills", "The wallet pays the rest through SwapVM."],
  ["The pool fills its cap", "If the desk fails, the pool fills the whole swap."],
];

const skips = [
  ["No quote", "Empty shelf or a bad band."],
  ["Wallet unfunded", "Real balance or Aqua allowance is short."],
  ["Off the pool spot", "Outside the maker's deviation of the pool price."],
  ["CRE missing", "A feed is set, but the price is missing or stale."],
  ["Off the reference", "Outside the maker's deviation of the CRE price."],
  ["Fill reverted", "The pool takes the swap instead."],
];

const partners = [
  {
    title: "OverflowHook",
    points: [
      ["beforeSwap permissions", repoFile("contracts/src/OverflowHook.sol", 270)],
      ["Cap and desk selection", repoFile("contracts/src/OverflowHook.sol", 301)],
      ["Fill and refund", repoFile("contracts/src/OverflowHook.sol", 381)],
    ],
  },
  {
    title: "DeskBand",
    points: [
      ["SwapVM opcode", repoFile("contracts/src/swapvm/DeskBand.sol", 21)],
      ["Band math", repoFile("contracts/src/swapvm/DeskBandMath.sol", 45)],
      ["Diff vs stock SwapVM", repoFile("docs/SWAPVM_DIFF.md")],
    ],
  },
  {
    title: "desk-guard",
    points: [
      ["CRE workflow", repoFile("services/cre/desk-guard/main.ts", 206)],
      ["Price feed", repoFile("contracts/src/DeskPriceFeed.sol", 66)],
      ["Simulation", repoFile("services/cre/desk-guard/SIMULATION.md")],
    ],
  },
];

export default function HowPage() {
  return (
    <div className="mx-auto flex max-w-[880px] flex-col items-center pt-12 pb-4">
      <h1 className="text-center text-[44px] leading-[1.05] font-semibold tracking-tight text-balance md:text-[56px]">
        One swap, two sources.
      </h1>
      <p className="mt-5 max-w-[420px] text-center text-[16px] leading-relaxed text-body">
        The pool fills its cap. A wallet fills the rest.
      </p>
      <figure className="mt-14 w-full overflow-hidden rounded-[14px] border border-white/[0.08] bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/architecture.svg"
          alt="WalletDesk architecture: maker wallet, Aqua registry, WalletDeskRouter, OverflowHook, v4 PoolManager, any v4 router, DeskPriceFeed, and the Chainlink CRE desk-guard workflow"
          className="w-full"
        />
      </figure>
      <ol className="mt-16 w-full max-w-[520px]">
        {steps.map(([title, body], index) => (
          <li key={title} className="grid grid-cols-[2rem_1fr] gap-4 py-3">
            <span className="font-mono text-[12px] text-muted-ink">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="text-[15px] font-medium">{title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-ink">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="mt-20 w-full">
        <h2 className="font-mono text-[11px] tracking-[0.08em] text-muted-ink uppercase">A skip never blocks the swap</h2>
        <ul className="mt-4 border-t border-white/[0.08]">
          {skips.map(([reason, when]) => (
            <li key={reason} className="grid gap-1 border-b border-white/[0.08] py-3 sm:grid-cols-[14rem_1fr] sm:gap-6">
              <span className="text-[13px] font-medium">{reason}</span>
              <span className="text-[13px] text-muted-ink">{when}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-16 grid w-full gap-10 sm:grid-cols-3">
        {partners.map((group) => (
          <div key={group.title}>
            <h2 className="font-mono text-[11px] tracking-[0.08em] text-muted-ink uppercase">{group.title}</h2>
            <ul className="mt-3 space-y-2">
              {group.points.map(([label, href]) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" className="group inline-flex items-baseline gap-2 text-[13px] text-ink hover:text-link">
                    {label}
                    <span className="font-mono text-[11px] text-muted-ink">{codeRef(href)}</span>
                    <ArrowUpRight className="size-3 shrink-0 text-muted-ink group-hover:text-link" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <p className="mt-14 text-[13px] text-muted-ink">
        Not audited. <ExternalLink href={repoFile("docs/THREAT_MODEL.md")}>Threat model</ExternalLink>
      </p>
    </div>
  );
}
