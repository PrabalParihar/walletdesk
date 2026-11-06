"use client";

import { Activity, ArrowUpRight, Coins, FileCode2, LayoutGrid, Receipt, ScrollText, Store, Workflow } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { mock } from "wagmi/connectors";

import { JumpMenu } from "@/components/jump-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { networkLabel, networkMode } from "@/lib/chains";
import { addressUrl, REPO_URL, repoFile, SEPOLIA_EXPLORER, SEPOLIA_PROOF, txUrl } from "@/lib/live";
import { useDeployment } from "@/lib/use-deployment";
import { cn } from "@/lib/utils";

const browse = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/how", label: "How it works", icon: Workflow },
  { href: "/desk", label: "Make a desk", icon: Store },
  { href: "/live", label: "Live", icon: Activity },
  { href: "/fees", label: "Rebates", icon: Coins },
];

const proof = [
  { href: txUrl(SEPOLIA_EXPLORER, SEPOLIA_PROOF.overflowRouterFill) ?? REPO_URL, label: "The overflow fill", icon: Receipt },
  { href: repoFile("docs/DEPLOYMENTS.md"), label: "Every Sepolia tx", icon: ScrollText },
  { href: REPO_URL, label: "Source code", icon: FileCode2 },
];

/**
 * The app frame, after Designeer's interface: a sticky sidebar (identity, Browse, Proof, and a live-network card where
 * Designeer keeps its sponsor slot) beside a top bar with a wide Ctrl K search pill. Below `lg` it collapses to a header.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const injected = connectors[0];
  const deployment = useDeployment();
  // Local fork only: Anvil's dev accounts are unlocked, so a mock connector can send transactions through the
  // fork RPC with no private key in the browser. Saves importing keys into a wallet for the demo.
  const demoAccounts =
    networkMode === "fork" && deployment.status === "ready"
      ? [
          { label: "Demo maker", address: deployment.deployment.maker },
          { label: "Demo taker", address: deployment.deployment.taker },
        ]
      : [];
  const hook = deployment.status === "ready" ? deployment.deployment.hook : undefined;
  const hookUrl = deployment.status === "ready" && hook ? addressUrl(deployment.deployment.explorer, hook) : undefined;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  const wallet = isConnected ? (
    <Button variant="outline" size="sm" onClick={() => disconnect()}>
      <span className="font-mono text-xs">
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </span>
      <span className="text-muted-ink">{chain?.name ?? "wallet"}</span>
    </Button>
  ) : (
    <div className="flex items-center gap-2">
      {demoAccounts.map((account) => (
        <Button
          key={account.label}
          size="sm"
          variant="outline"
          disabled={isPending}
          title={`Unlocked Anvil account ${account.address} on the local fork`}
          onClick={() => connect({ connector: mock({ accounts: [account.address] }) })}
        >
          {account.label}
        </Button>
      ))}
      <Button size="sm" variant="outline" disabled={!injected || isPending} onClick={() => injected && connect({ connector: injected })}>
        {injected ? "Connect" : "No wallet"}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-surface text-ink md:px-4">
      <a
        href="#main"
        className="sr-only z-30 rounded-md bg-ink px-3 py-2 text-[13px] text-surface focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="wd-frame mx-auto flex min-h-screen max-w-[1320px]">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-dashed border-line-3 lg:flex" aria-label="Site">
          <div className="px-6 pt-7">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mark.svg" alt="" width={40} height={40} className="size-10" />
              <span className="text-[22px] font-semibold tracking-tight">
                WalletDesk<span className="text-faint">.</span>
              </span>
            </Link>
            <p className="mt-5 text-[13px] leading-relaxed text-body">
              A Uniswap v4 hook that fills big swaps from market makers&apos; wallets through 1inch Aqua, priced against Chainlink CRE.
            </p>
          </div>
          <div className="mx-6 mt-6 border-t border-dashed border-line-3" />
          <nav className="mt-5 px-4" aria-label="Browse">
            <p className="px-2 font-mono text-[11px] tracking-wider text-muted-ink uppercase">Browse</p>
            <ul className="mt-2 space-y-0.5">
              {browse.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-[14px] text-body transition-colors hover:bg-hover hover:text-ink",
                      isActive(href) && "bg-sunken font-medium text-ink shadow-[inset_0_0_0_1px_var(--wd-line)]",
                    )}
                  >
                    <Icon className="size-[18px] shrink-0 text-muted-ink" aria-hidden />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-6 px-4">
            <p className="px-2 font-mono text-[11px] tracking-wider text-muted-ink uppercase">Proof</p>
            <ul className="mt-2 space-y-0.5">
              {proof.map(({ href, label, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-[14px] text-body transition-colors hover:bg-hover hover:text-ink"
                  >
                    <Icon className="size-[18px] shrink-0 text-muted-ink" aria-hidden />
                    <span className="flex-1">{label}</span>
                    <ArrowUpRight className="size-3.5 text-faint group-hover:text-link" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-auto px-4 pb-5">
            {/* Where Designeer keeps its sponsor slot: the live deployment */}
            <div className="rounded-[14px] border border-line bg-raised p-4">
              <p className="flex items-center gap-2 text-[13px] font-medium">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-2 rounded-full bg-[#34D399] opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-[#10B981]" />
                </span>
                {networkMode === "fork" ? "Local Unichain fork" : `Live on ${networkLabel[networkMode]}`}
              </p>
              {hook ? (
                <p className="mt-2 font-mono text-[12px] text-muted-ink">
                  OverflowHook {hook.slice(0, 6)}…{hook.slice(-4)}
                </p>
              ) : null}
              {hookUrl ? (
                <a
                  href={hookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-[13px] text-link underline decoration-current/35 underline-offset-2 hover:decoration-current"
                >
                  View on the explorer
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              ) : null}
            </div>
            <p className="mt-4 px-1 font-mono text-[11px] leading-relaxed text-muted-ink">Built for ETHGlobal Mumbai</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-dashed border-line-3 bg-surface/90 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
              <div className="flex items-center gap-2">
                <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight lg:hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/mark.svg" alt="" width={20} height={20} className="size-5" />
                  WalletDesk
                </Link>
                {(() => {
                  const badge = "hidden whitespace-nowrap rounded-full bg-[#00BBFF]/15 px-2 py-0.5 text-[11px] font-medium text-[#0B6E99] sm:inline-flex dark:text-[#7DD3FC]";
                  return hookUrl ? (
                    <a href={hookUrl} target="_blank" rel="noopener noreferrer" className={`${badge} hover:bg-[#00BBFF]/25`} title="Open the live OverflowHook on the explorer">
                      {networkLabel[networkMode]} · live
                    </a>
                  ) : (
                    <span className={badge}>{networkLabel[networkMode]}</span>
                  );
                })()}
              </div>
              {/* One instance only: it owns the global Ctrl/⌘K shortcut. Icon on phones, search pill from md. */}
              <div className="ml-auto flex md:ml-0 md:flex-1 md:justify-center">
                <JumpMenu wide />
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                {wallet}
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto border-t border-dashed border-line-3 px-4 py-2 lg:hidden" aria-label="Browse">
              {browse.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn("shrink-0 rounded-lg px-3 py-1.5 text-[13px] text-muted-ink", isActive(link.href) && "bg-sunken text-ink")}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </header>
          <main id="main" tabIndex={-1} className="w-full flex-1 px-4 py-8 outline-none md:px-8 md:py-12">
            {children}
          </main>
          <footer className="border-t border-dashed border-line-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-4 font-mono text-[11px] text-muted-ink md:px-8">
              <span>Powered by SwapVM — © Degensoft Ltd 2025</span>
              <span>Powered by Aqua — © Degensoft Ltd 2025</span>
              <span>Uniswap v4 hook · Chainlink CRE reference price</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
