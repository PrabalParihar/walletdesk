"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { mock } from "wagmi/connectors";

import { networkMode } from "@/lib/chains";
import { useDeployment } from "@/lib/use-deployment";
import { ChainSwitcher } from "@/components/chain-switcher";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/how", label: "HOW" },
  { href: "/desk", label: "DESK" },
  { href: "/live", label: "LIVE" },
  { href: "/fees", label: "REBATES" },
];

/** Flat top bar: the mark goes home, nav and Connect sit right. Connect stays the only filled control. */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const injected = connectors[0];
  const deployment = useDeployment();
  const demoAccounts =
    networkMode === "fork" && deployment.status === "ready"
      ? [
          { label: "Demo maker", address: deployment.deployment.maker },
          { label: "Demo taker", address: deployment.deployment.taker },
        ]
      : [];
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-surface text-ink">
      <a
        href="#main"
        className="sr-only z-30 bg-ink px-3 py-2 font-mono text-[12px] tracking-[0.08em] text-surface uppercase focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="relative z-10 border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between gap-4 px-5">
          <Link href="/" aria-label="WalletDesk home" className="flex shrink-0 items-center gap-2 text-[14px] font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.svg" alt="" width={18} height={18} className="size-[18px]" />
            <span className="hidden sm:inline">WalletDesk</span>
          </Link>
          <div className="flex items-center gap-5">
            <nav className="hidden items-center gap-6 font-mono text-[12px] tracking-[0.08em] text-muted-ink md:flex" aria-label="Browse">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn(
                    "transition-colors duration-200 hover:text-ink motion-reduce:transition-none",
                    isActive(link.href) && "text-ink",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {demoAccounts.map((account) => (
              <button
                key={account.label}
                type="button"
                disabled={isPending}
                title={`Unlocked Anvil account ${account.address} on the local fork`}
                onClick={() => connect({ connector: mock({ accounts: [account.address] }) })}
                className="hidden font-mono text-[12px] tracking-[0.08em] text-muted-ink uppercase hover:text-ink lg:inline"
              >
                {account.label}
              </button>
            ))}
            {isConnected ? <ChainSwitcher /> : null}
            {isConnected ? (
              <button type="button" onClick={() => disconnect()} className={buttonVariants({ size: "sm" })} title={chain?.name ?? "Disconnect"}>
                {address?.slice(0, 6)}…{address?.slice(-4)}
              </button>
            ) : (
              <button
                type="button"
                className={buttonVariants({ size: "sm" })}
                disabled={!injected || isPending}
                onClick={() => injected && connect({ connector: injected })}
              >
                {injected ? "Connect" : "No wallet"}
              </button>
            )}
          </div>
        </div>
      </header>
      <nav className="relative z-10 flex gap-5 overflow-x-auto border-b border-line px-5 py-3 font-mono text-[12px] tracking-[0.08em] text-muted-ink [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden" aria-label="Browse">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(link.href) ? "page" : undefined}
            className={cn("shrink-0 whitespace-nowrap hover:text-ink", isActive(link.href) && "text-ink")}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <main id="main" tabIndex={-1} className={cn("relative z-10 outline-none", pathname === "/" ? "" : "mx-auto w-full max-w-[1120px] px-5 py-8 md:py-10")}>
        {children}
      </main>
      <footer className="relative z-10 border-t border-line px-6 py-6 text-center font-mono text-[11px] text-muted-ink">
        <p>Powered by SwapVM and Aqua — © Degensoft Ltd 2025</p>
      </footer>
    </div>
  );
}
