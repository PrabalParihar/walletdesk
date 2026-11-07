"use client";

import { Check, ChevronDown, LoaderCircle, TriangleAlert } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";

import { appChains, findAppChain } from "@/lib/chains";
import { switchErrorMessage, useSwitchNetwork } from "@/lib/use-switch-network";
import { cn } from "@/lib/utils";

/** Header pill showing the wallet's chain. Picks any app chain and adds it to the wallet if missing. */
export function ChainSwitcher() {
  const { switchTo, pending, walletChainId } = useSwitchNetwork();
  const [error, setError] = useState<string | null>(null);
  const current = findAppChain(walletChainId);
  const wrong = walletChainId !== undefined && !current;

  async function pick(id: number) {
    setError(null);
    try {
      await switchTo(id);
    } catch (caught) {
      setError(switchErrorMessage(caught));
    }
  }

  return (
    <DropdownMenu.Root onOpenChange={(open) => open && setError(null)}>
      <DropdownMenu.Trigger
        className={cn(
          "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors duration-200 motion-reduce:transition-none",
          wrong
            ? "border-problem/40 bg-problem/10 text-problem hover:bg-problem/15"
            : "border-white/[0.08] text-muted-ink hover:text-ink",
        )}
        aria-label={wrong ? "Wrong network, switch chain" : `Network: ${current?.name ?? "unknown"}, switch chain`}
      >
        {pending !== null ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        ) : wrong ? (
          <TriangleAlert className="size-3.5" aria-hidden />
        ) : (
          <span className="size-1.5 rounded-full bg-solution" aria-hidden />
        )}
        <span className="max-w-[9rem] truncate">{wrong ? "Wrong network" : (current?.name ?? "Network")}</span>
        <ChevronDown className="size-3.5 opacity-70" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-60 rounded-[12px] border border-white/[0.08] bg-[#141416] p-1.5 text-[13px] text-ink shadow-xl"
        >
          <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 text-[11px] text-faint">
            Switch network — added to your wallet if missing
          </DropdownMenu.Label>
          {appChains.map((chain) => {
            const active = chain.id === walletChainId;
            return (
              <DropdownMenu.Item
                key={chain.id}
                disabled={pending !== null}
                onSelect={(event) => {
                  event.preventDefault();
                  if (!active) void pick(chain.id);
                }}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-[8px] px-2.5 py-2 outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-white/[0.06]"
              >
                <span>
                  {chain.name}
                  <span className="ml-2 font-mono text-[11px] text-faint">{chain.id}</span>
                </span>
                {pending === chain.id ? (
                  <LoaderCircle className="size-3.5 animate-spin text-muted-ink" aria-hidden />
                ) : active ? (
                  <Check className="size-3.5 text-solution" aria-label="Connected" />
                ) : null}
              </DropdownMenu.Item>
            );
          })}
          {error ? (
            <p role="alert" className="px-2.5 pt-1.5 pb-1 text-[12px] text-problem">
              {error}
            </p>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
