"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { mock } from "wagmi/connectors";

import { JumpMenu } from "@/components/jump-menu";
import { Button } from "@/components/ui/button";
import { networkLabel, networkMode } from "@/lib/chains";
import { addressUrl } from "@/lib/live";
import { useDeployment } from "@/lib/use-deployment";
import { cn } from "@/lib/utils";

const links = [
  { href: "/how", label: "How it works" },
  { href: "/desk", label: "Make a desk" },
  { href: "/live", label: "Live" },
  { href: "/fees", label: "Rebates" },
];

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

  return (
    <div className="min-h-screen overflow-x-clip bg-surface text-ink md:px-4">
      <a
        href="#main"
        className="sr-only z-30 rounded-md bg-band px-3 py-2 text-[13px] text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="wd-frame mx-auto flex min-h-screen max-w-6xl flex-col">
      <header className="sticky top-0 z-20 border-b border-dashed border-line-3 bg-surface/90 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mark.svg" alt="" width={20} height={20} className="size-5" />
              WalletDesk
            </Link>
            {(() => {
              const hookUrl =
                deployment.status === "ready" ? addressUrl(deployment.deployment.explorer, deployment.deployment.hook) : undefined;
              const badge = "rounded-full bg-[#00BBFF]/15 px-2 py-0.5 text-[11px] font-medium text-[#0B6E99]";
              return hookUrl ? (
                <a href={hookUrl} target="_blank" rel="noopener noreferrer" className={`${badge} hover:bg-[#00BBFF]/25`} title="Open the live OverflowHook on the explorer">
                  {networkLabel[networkMode]} · live
                </a>
              ) : (
                <span className={badge}>{networkLabel[networkMode]}</span>
              );
            })()}
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[13px] text-muted-ink transition-colors hover:text-ink",
                  pathname === link.href && "bg-sunken text-ink",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
          <JumpMenu />
          {isConnected ? (
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
          )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-dashed border-line-3 px-4 py-2 sm:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-[13px] text-muted-ink",
                pathname === link.href && "bg-sunken text-ink",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="w-full flex-1 px-4 py-8 outline-none md:px-6 md:py-12">
        {children}
      </main>
      <footer className="border-t border-dashed border-line-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-4 font-mono text-[11px] text-muted-ink md:px-6">
          <span>Powered by SwapVM — © Degensoft Ltd 2025</span>
          <span>Powered by Aqua — © Degensoft Ltd 2025</span>
          <span>Uniswap v4 hook · Chainlink CRE reference price</span>
        </div>
      </footer>
      </div>
    </div>
  );
}
