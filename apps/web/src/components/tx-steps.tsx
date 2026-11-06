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
    <ol className="grid gap-1.5 rounded-[10px] border border-line bg-raised p-3 text-[13px]" aria-live="polite" aria-label="Transaction progress">
      {steps.map((step, index) => {
        const href = step.hash ? txUrl(explorer, step.hash) : undefined;
        return (
          <li key={`${step.label}-${index}`} className="flex items-center gap-2.5">
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
            <span className={cn("flex-1", step.state === "active" ? "text-ink" : "text-body")}>
              {step.label}
              {step.state === "active" ? (step.hash ? " · waiting for the block" : " · confirm in your wallet") : null}
              <span className="sr-only">{step.state === "done" ? " (done)" : step.state === "error" ? " (failed)" : " (in progress)"}</span>
            </span>
            {href ? (
              <ExternalLink href={href} className="text-[12px]">
                tx
              </ExternalLink>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
