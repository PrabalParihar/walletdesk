"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ExternalLink } from "@/components/site";
import { txUrl } from "@/lib/live";
import { cn } from "@/lib/utils";

type StepState = "active" | "done" | "error";
type Step = { label: string; state: StepState; hash?: `0x${string}` };

/**
 * Tracks a multi-transaction flow (approve, ship, register...) one step at a time, so the user sees which
 * wallet prompt they are on, which transactions are already mined, and where a failure happened.
 */
export function useTxSteps() {
  const [steps, setSteps] = useState<Step[]>([]);
  const settle = (list: Step[], to: StepState) => list.map((s) => (s.state === "active" ? { ...s, state: to } : s));

  const reset = useCallback(() => setSteps([]), []);
  const start = useCallback((label: string) => setSteps((list) => [...settle(list, "done"), { label, state: "active" }]), []);
  const sent = useCallback(
    (hash: `0x${string}`) => setSteps((list) => list.map((s, i) => (i === list.length - 1 ? { ...s, hash } : s))),
    [],
  );
  const finish = useCallback(() => setSteps((list) => settle(list, "done")), []);
  const fail = useCallback(() => setSteps((list) => settle(list, "error")), []);

  return useMemo(() => ({ steps, reset, start, sent, finish, fail }), [steps, reset, start, sent, finish, fail]);
}

export function TxSteps({ steps, explorer }: { steps: Step[]; explorer?: string }) {
  if (steps.length === 0) return null;
  return (
    <ol className="grid rounded-[14px] border border-line bg-raised px-3 py-2 text-[13px]" aria-live="polite" aria-label="Transaction progress">
      {steps.map((step, index) => {
        const href = step.hash ? txUrl(explorer, step.hash) : undefined;
        return (
          <li key={`${step.label}-${index}`} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2.5">
            <span className="flex flex-col items-center">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full",
                step.state === "done" && "bg-[#047857] text-white",
                step.state === "active" && "text-link",
                step.state === "error" && "bg-[#BE123C] text-white",
              )}
              aria-hidden
            >
              {step.state === "done" ? <Check className="size-3" strokeWidth={3} /> : null}
              {step.state === "error" ? <X className="size-3" strokeWidth={3} /> : null}
              {step.state === "active" ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : null}
            </span>
            {index < steps.length - 1 ? <span className="my-0.5 w-px flex-1 bg-line-2" aria-hidden /> : <span className="h-2" />}
            </span>
            <span className={cn("flex items-center gap-2 py-1.5", step.state === "active" ? "text-ink" : "text-body")}>
            <span className="min-w-0 flex-1">
              {step.label}
              {step.state === "active" ? (step.hash ? " · waiting for the block" : " · confirm in your wallet") : null}
              <span className="sr-only">{step.state === "done" ? " (done)" : step.state === "error" ? " (failed)" : " (in progress)"}</span>
            </span>
            {href ? (
              <ExternalLink href={href} className="text-[12px]">
                tx
              </ExternalLink>
            ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
