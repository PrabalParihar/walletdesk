"use client";

import { Check, CircleCheck, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatUnits, parseEventLogs, type TransactionReceipt } from "viem";

import { ExternalLink, FilterChip, SplitBar } from "@/components/site";
import { skipReasons } from "@/lib/contracts";
import { txUrl } from "@/lib/live";
import { cn } from "@/lib/utils";

const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""));

/* ---------- 1. Size picker: presets, slider, live split ---------- */

const PRESETS = [1, 3, 10] as const;

export function SizePicker({
  value,
  onChange,
  cap,
  symbol,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  cap: number | null;
  symbol: string;
  disabled?: boolean;
}) {
  const size = Number(value.trim());
  const planned = Number.isFinite(size) && size > 0 ? size : 0;
  const max = cap ? cap * 10 : 50;
  const overflow = cap !== null && planned > cap;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="swap-size" className="text-[13px] font-medium text-ink">
          Size, {symbol || "input"} in
        </label>
        {cap ? (
          <div role="group" aria-label="Size presets" className="inline-flex gap-1 rounded-full bg-sunken p-1">
            {PRESETS.map((multiple) => (
              <FilterChip
                key={multiple}
                pressed={planned === cap * multiple}
                disabled={disabled}
                onClick={() => onChange(fmt(cap * multiple))}
                className="h-7 px-3 text-[12px]"
              >
                {multiple}× cap
              </FilterChip>
            ))}
          </div>
        ) : null}
      </div>
      <div className="relative">
        <input
          id="swap-size"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-14 w-full rounded-[10px] border border-line bg-sunken pr-16 pl-4 font-mono text-[24px] tabular-nums text-ink outline-none focus-visible:border-desk focus-visible:ring-2 focus-visible:ring-desk/30 disabled:opacity-60"
        />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-mono text-[13px] text-muted-ink">{symbol}</span>
      </div>
      <input
        type="range"
        aria-label={`Swap size in ${symbol}`}
        min={0}
        max={max}
        step={max / 200}
        disabled={disabled}
        value={Math.min(planned, max)}
        onChange={(event) => onChange(fmt(Number(event.target.value)))}
        className="wd-range w-full"
        style={{ "--fill": `${(Math.min(planned, max) / max) * 100}%`, "--cap": cap ? `${(cap / max) * 100}%` : "0%" } as React.CSSProperties}
      />
      {planned > 0 && cap ? (
        <div className="grid gap-2">
          <p
            key={overflow ? "over" : "under"}
            className={cn(
              "wd-pop inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium",
              overflow ? "bg-desk/15 text-link" : "bg-white/[0.06] text-body",
            )}
            aria-live="polite"
          >
            <span className={cn("size-1.5 rounded-full", overflow ? "bg-desk motion-safe:animate-pulse" : "bg-[var(--pool)]")} aria-hidden />
            {overflow
              ? `Pool cap hit! Maker wallet steps in for ${fmt(planned - cap)} ${symbol}`
              : `Under the ${fmt(cap)} ${symbol} cap: the pool fills it all`}
          </p>
          <SplitBar total={planned} poolPart={Math.min(planned, cap)} symbol={symbol} />
        </div>
      ) : null}
    </div>
  );
}

/* ---------- 2. Progress stepper ---------- */

export type PhaseKey = "network" | "approve" | "swap" | "mined";
export type PhaseState = "todo" | "active" | "done" | "skipped" | "error";
export type Progress = Record<PhaseKey, { state: PhaseState; hash?: `0x${string}` }>;

export const idleProgress = (): Progress => ({
  network: { state: "todo" },
  approve: { state: "todo" },
  swap: { state: "todo" },
  mined: { state: "todo" },
});

const PHASES: { key: PhaseKey; label: string; activeHint: string }[] = [
  { key: "network", label: "Network", activeHint: "Switching" },
  { key: "approve", label: "Approve", activeHint: "Confirm in wallet" },
  { key: "swap", label: "Swap", activeHint: "Confirm in wallet" },
  { key: "mined", label: "Filled", activeHint: "Waiting for block" },
];

export function SwapProgress({ progress, explorer }: { progress: Progress; explorer?: string }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Swap progress" aria-live="polite">
      {PHASES.map(({ key, label, activeHint }, index) => {
        const { state, hash } = progress[key];
        const href = hash ? txUrl(explorer, hash) : undefined;
        const lit = state === "done" || state === "skipped";
        const hint =
          state === "active" ? (key === "approve" && hash ? "Waiting for block" : activeHint)
          : state === "skipped" ? "Already set"
          : state === "error" ? "Failed"
          : state === "done" ? "Done"
          : "";
        return (
          <li key={key} className="grid gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "relative flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors duration-300",
                  state === "todo" && "border-line-2 text-muted-ink",
                  state === "active" && "border-desk bg-desk/15 text-link",
                  lit && "border-transparent bg-[#047857] text-white",
                  state === "error" && "border-transparent bg-[#BE123C] text-white",
                )}
                aria-hidden
              >
                {state === "active" ? (
                  <>
                    <span className="absolute inset-0 rounded-full bg-desk/40 motion-safe:animate-ping" />
                    <LoaderCircle className="relative size-3.5 motion-safe:animate-spin" />
                  </>
                ) : lit ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : state === "error" ? (
                  <X className="size-3.5" strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </span>
              {index < PHASES.length - 1 ? (
                <span className="h-0.5 flex-1 overflow-hidden rounded-full bg-line-2" aria-hidden>
                  <span className={cn("block h-full bg-[#047857] transition-[width] duration-500 ease-out", lit ? "w-full" : "w-0")} />
                </span>
              ) : null}
            </div>
            <div className="text-[12px] leading-tight">
              <p className={cn(state === "todo" ? "text-muted-ink" : "text-ink", "font-medium")}>{label}</p>
              <p className={cn("mt-0.5", state === "error" ? "text-problem" : "text-muted-ink")}>
                {hint}
                {href ? (
                  <>
                    {hint ? " · " : ""}
                    <ExternalLink href={href} className="text-[12px]">tx</ExternalLink>
                  </>
                ) : null}
              </p>
              <span className="sr-only">{`${label}: ${state}`}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Button text that follows the flow. */
export function progressLabel(progress: Progress, busy: boolean, size: string, symbol: string): string {
  if (progress.network.state === "active") return "Switching network…";
  if (progress.approve.state === "active") return progress.approve.hash ? "Approving…" : `Approve ${symbol} in your wallet…`;
  if (progress.swap.state === "active") return "Confirm the swap in your wallet…";
  if (progress.mined.state === "active") return "Swapping…";
  if (busy) return "Preparing…";
  const amount = size.trim() || "0";
  return progress.mined.state === "done" ? `Filled ✓ Swap ${amount} ${symbol} again` : `Swap ${amount} ${symbol}`;
}

/* ---------- 3. Result card ---------- */

const resultEvents = [
  {
    type: "event",
    name: "OverflowRouted",
    inputs: [
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "residualIn", type: "uint256", indexed: false },
      { name: "filledOut", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DeskSkipped",
    inputs: [
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "reason", type: "uint8", indexed: false },
    ],
  },
] as const;

export type SwapResult = {
  hash: `0x${string}`;
  totalIn: number;
  makerIn: number;
  makerOut: number;
  skipReason: string | null;
};

/** Reads the hook's events from the receipt, so the card shows the split that actually happened. */
export function readSwapResult(
  receipt: TransactionReceipt,
  hook: `0x${string}`,
  totalIn: bigint,
  decimals0: number,
  decimals1: number,
): SwapResult {
  const logs = parseEventLogs({
    abi: resultEvents,
    logs: receipt.logs.filter((log) => log.address.toLowerCase() === hook.toLowerCase()),
  });
  const routed = logs.find((log) => log.eventName === "OverflowRouted");
  const skipped = logs.find((log) => log.eventName === "DeskSkipped");
  return {
    hash: receipt.transactionHash,
    totalIn: Number(formatUnits(totalIn, decimals0)),
    makerIn: routed ? Number(formatUnits(routed.args.residualIn, decimals0)) : 0,
    makerOut: routed ? Number(formatUnits(routed.args.filledOut, decimals1)) : 0,
    skipReason: !routed && skipped ? (skipReasons[skipped.args.reason] ?? `reason ${skipped.args.reason}`) : null,
  };
}

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - startedAt) / duration);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

export function FillResult({
  result,
  symbol0,
  symbol1,
  explorer,
}: {
  result: SwapResult;
  symbol0: string;
  symbol1: string;
  explorer?: string;
}) {
  const poolIn = Math.max(result.totalIn - result.makerIn, 0);
  const overflowed = result.makerIn > 0;
  const shownTotal = useCountUp(result.totalIn);
  const shownMaker = useCountUp(result.makerIn);
  const shownOut = useCountUp(result.makerOut);
  const href = txUrl(explorer, result.hash);

  return (
    <section
      className={cn(
        "wd-celebrate relative overflow-hidden rounded-[14px] border p-5 md:p-6",
        overflowed ? "border-desk/40 bg-desk/[0.08]" : "border-line-2 bg-sunken",
      )}
      aria-live="polite"
      aria-label="Swap result"
    >
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[120%] -translate-x-1/2 rounded-full opacity-60"
        style={{ background: overflowed ? "radial-gradient(ellipse at center, rgba(0,102,250,0.35), transparent 70%)" : "radial-gradient(ellipse at center, rgba(214,0,111,0.25), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative grid gap-4">
        <p className="inline-flex items-center gap-2 text-[13px] font-medium text-[#34D399]">
          <CircleCheck className="size-4" aria-hidden /> Swap mined
        </p>
        <h2 className="text-[26px] leading-tight font-semibold tracking-tight md:text-[32px]">
          {overflowed ? "Filled! " : "Done! "}
          <span className="font-mono tabular-nums">{fmt(Number(shownTotal.toFixed(4)))}</span> {symbol0} in
          {overflowed ? (
            <span className="block text-[18px] font-medium text-body md:text-[20px]">
              The pool took {fmt(poolIn)}, a maker wallet took{" "}
              <span className="font-mono text-link tabular-nums">{fmt(Number(shownMaker.toFixed(4)))}</span>
            </span>
          ) : (
            <span className="block text-[18px] font-medium text-body md:text-[20px]">
              The Uniswap pool filled all of it{result.skipReason ? ` (desk skipped: ${result.skipReason})` : ""}
            </span>
          )}
        </h2>
        <SplitBar key={result.hash} reveal total={result.totalIn} poolPart={poolIn} symbol={symbol0} />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
          {overflowed ? (
            <p className="text-body">
              Maker sent you{" "}
              <span className="font-mono text-ink tabular-nums">
                {fmt(Number(shownOut.toFixed(4)))} {symbol1}
              </span>
            </p>
          ) : null}
          {href ? <ExternalLink href={href}>View on the explorer</ExternalLink> : <span className="font-mono text-xs break-all">{result.hash}</span>}
        </div>
      </div>
    </section>
  );
}
