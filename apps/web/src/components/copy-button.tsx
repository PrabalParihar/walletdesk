"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** Copies an address or hash, so a judge can paste it into an explorer or a block of code. */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => setCopied(true), () => undefined);
      }}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-ink transition-colors hover:bg-hover hover:text-ink",
        className,
      )}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
    >
      {copied ? <Check className="size-3.5 text-[#047857] dark:text-[#34D399]" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}
