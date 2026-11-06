"use client";

import { ArrowUpRight, CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, VisuallyHidden } from "radix-ui";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { addressUrl, REPO_URL, repoFile, SEPOLIA_DEPLOYMENT, SEPOLIA_EXPLORER, SEPOLIA_PROOF, txUrl } from "@/lib/live";
import { cn } from "@/lib/utils";

type Item = { group: string; label: string; hint: string; href: string; external?: boolean };

const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const d = SEPOLIA_DEPLOYMENT;

/** Everything a judge might want to open, one keystroke away. */
const items: Item[] = [
  { group: "Pages", label: "Overview", hint: "/", href: "/" },
  { group: "Pages", label: "How it works", hint: "/how", href: "/how" },
  { group: "Pages", label: "Make a desk", hint: "/desk", href: "/desk" },
  { group: "Pages", label: "Live overflow", hint: "/live", href: "/live" },
  { group: "Pages", label: "Rebates", hint: "/fees", href: "/fees" },
  { group: "On Unichain Sepolia", label: "Overflow fill: pool 1 DA, wallet 4 DA", hint: "tx", href: txUrl(SEPOLIA_EXPLORER, SEPOLIA_PROOF.overflowRouterFill) ?? "", external: true },
  { group: "On Unichain Sepolia", label: "Fill through Uniswap's PoolSwapTest", hint: "tx", href: txUrl(SEPOLIA_EXPLORER, SEPOLIA_PROOF.stockRouterFill) ?? "", external: true },
  { group: "On Unichain Sepolia", label: "OverflowHook", hint: short(d.hook), href: addressUrl(SEPOLIA_EXPLORER, d.hook) ?? "", external: true },
  { group: "On Unichain Sepolia", label: "WalletDeskRouter (SwapVM + DeskBand)", hint: short(d.swapVm), href: addressUrl(SEPOLIA_EXPLORER, d.swapVm) ?? "", external: true },
  { group: "On Unichain Sepolia", label: "DeskPriceFeed (Chainlink CRE consumer)", hint: short(d.priceFeed ?? d.hook), href: addressUrl(SEPOLIA_EXPLORER, d.priceFeed ?? d.hook) ?? "", external: true },
  { group: "Docs", label: "Judging guide", hint: "docs/JUDGING.md", href: repoFile("docs/JUDGING.md"), external: true },
  { group: "Docs", label: "Every Sepolia transaction", hint: "docs/DEPLOYMENTS.md", href: repoFile("docs/DEPLOYMENTS.md"), external: true },
  { group: "Docs", label: "CRE simulation run", hint: "SIMULATION.md", href: repoFile("services/cre/desk-guard/SIMULATION.md"), external: true },
  { group: "Docs", label: "Threat model", hint: "docs/THREAT_MODEL.md", href: repoFile("docs/THREAT_MODEL.md"), external: true },
  { group: "Docs", label: "Source code", hint: "GitHub", href: REPO_URL, external: true },
];

export function JumpMenu({ wide = false }: { wide?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Shortcut label: ⌘ on Apple devices, Ctrl elsewhere. Read on the client only; the server renders "Ctrl".
  const mac = useSyncExternalStore(
    () => () => undefined,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((item) => `${item.label} ${item.hint} ${item.group}`.toLowerCase().includes(q)) : items;
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    setQuery("");
    setActive(0);
    if (item.external) window.open(item.href, "_blank", "noopener,noreferrer");
    else router.push(item.href);
  }

  const kbd = mac ? "⌘" : "Ctrl";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setQuery("");
          setActive(0);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-lg border border-line-2 px-2 text-[12px] text-muted-ink transition-colors hover:bg-hover hover:text-ink md:pr-1.5 md:pl-2.5",
            // Designeer-style search pill on wider screens
            wide && "md:h-9 md:w-[340px] md:rounded-[10px] md:bg-raised md:px-3 md:text-[13px]",
          )}
          aria-label="Jump to a page, contract, transaction or doc"
        >
          <Search className="size-3.5" aria-hidden />
          <span className={cn("hidden md:inline", wide && "md:flex-1 md:text-left")}>{wide ? "Search pages, contracts, txs" : "Jump to"}</span>
          <span className="hidden items-center gap-0.5 md:inline-flex" aria-hidden>
            <kbd className="rounded border border-line-2 bg-sunken px-1 font-mono text-[10px] leading-4">{kbd}</kbd>
            <kbd className="rounded border border-line-2 bg-sunken px-1 font-mono text-[10px] leading-4">K</kbd>
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-surface/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed top-[12vh] left-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[14px] border border-line-2 bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.14)] outline-none"
          aria-describedby={undefined}
        >
          <VisuallyHidden.Root>
            <Dialog.Title>Jump to</Dialog.Title>
          </VisuallyHidden.Root>
          <div className="flex items-center gap-2 border-b border-dashed border-line-2 px-4">
            <Search className="size-4 text-muted-ink" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((i) => Math.min(i + 1, results.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  go(results[active]);
                }
              }}
              placeholder="Pages, contracts, transactions, docs"
              className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint-strong"
              role="combobox"
              aria-expanded
              aria-controls="jump-results"
              aria-activedescendant={results[active] ? `jump-${active}` : undefined}
              aria-label="Search"
            />
            <kbd className="rounded border border-line-2 bg-sunken px-1.5 font-mono text-[10px] leading-5 text-muted-ink">Esc</kbd>
          </div>
          <ul id="jump-results" ref={listRef} role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
            {results.length === 0 ? <li className="px-3 py-6 text-center text-[13px] text-muted-ink">Nothing matches.</li> : null}
            {results.map((item, index) => {
              const showGroup = index === 0 || results[index - 1].group !== item.group;
              const row = (
                <>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-ink">{item.hint}</span>
                  {item.external ? (
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted-ink" aria-hidden />
                  ) : (
                    <CornerDownLeft className={cn("size-3.5 shrink-0 text-muted-ink", index !== active && "opacity-0")} aria-hidden />
                  )}
                </>
              );
              const cls = cn(
                "flex cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2 text-[13px] text-ink",
                index === active && "bg-sunken",
              );
              return (
                <li key={item.label} role="presentation">
                  {showGroup ? (
                    <p className="px-3 pt-3 pb-1 font-mono text-[10px] tracking-wider text-muted-ink uppercase first:pt-1">{item.group}</p>
                  ) : null}
                  <div
                    id={`jump-${index}`}
                    role="option"
                    aria-selected={index === active}
                    data-index={index}
                    className={cls}
                    onMouseMove={() => setActive(index)}
                    onClick={() => go(item)}
                  >
                    {row}
                    {item.external ? <span className="sr-only"> (opens in a new tab)</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
