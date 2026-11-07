"use client";

import { formatUnits } from "viem";

import { DotStreams } from "@/components/dot-streams";
import { networkLabel, networkMode } from "@/lib/chains";
import { formatPriceX18 } from "@/lib/desk";
import { formatStrip } from "@/lib/live-strip";
import { useDeployment } from "@/lib/use-deployment";
import { useLiveState } from "@/lib/use-live-state";

/** Hero graphic: the repo's fixed example swap (1 through the pool, the rest from a wallet). Not live data. */
export function HeroStreams() {
  const { deployment } = useDeployment();
  const total = deployment ? Number(formatUnits(BigInt(deployment.exampleSwap), deployment.decimals0)) : 5;
  return <DotStreams poolPart={1} deskPart={Math.max(total - 1, 0)} symbol={deployment?.symbol0 ?? "DA"} />;
}

/** Four live readings under the hero. Every data cell shows "—" until the first read lands and whenever a read fails. */
export function LiveStrip() {
  const { deployment } = useDeployment();
  const { guard, error } = useLiveState(deployment);
  const d0 = deployment?.decimals0 ?? 18;
  const d1 = deployment?.decimals1 ?? 18;
  const items = formatStrip(error ? null : guard, networkLabel[networkMode], (x) => formatPriceX18(x, d0, d1));

  return (
    <div className="relative mt-12 md:mt-16">
      <dl className="grid grid-cols-2 gap-y-5 border-t border-line pt-4 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 pr-3">
            <dt className="font-mono text-[11px] tracking-[0.08em] text-muted-ink uppercase">{item.label}</dt>
            <dd aria-live="polite" className="mt-1.5 h-6 truncate text-[15px] leading-6 font-medium text-ink tabular-nums">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {/* Fixed-height line so the error note never pushes the page down. */}
      <p className="mt-3 h-4 font-mono text-[11px] leading-4 tracking-[0.08em] text-muted-ink uppercase">
        {error ? "Live data unavailable" : null}
      </p>
    </div>
  );
}
