"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { mock } from "wagmi/connectors";

import { networkMode } from "@/lib/chains";
import { useDeployment } from "@/lib/use-deployment";
import { cn } from "@/lib/utils";

const links = [
  { href: "/how", label: "How it works" },
  { href: "/desk", label: "Make a desk" },
  { href: "/live", label: "Live" },
  { href: "/fees", label: "Rebates" },
];

/** Floating pill from the approved sparse hero. The mark goes home; Connect stays the only filled control. */
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
  const connectClass =
    "h-8 shrink-0 rounded-full bg-desk px-3.5 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-[#0050C8] motion-reduce:transition-none disabled:opacity-50";

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-surface text-ink">
      <div
        className="pointer-events-none absolute inset-x-0 top-[28%] mx-auto h-[420px] w-[min(720px,100%)] rounded-full"
        style={{ background: "radial-gradient(ellipse at center, rgba(0,102,250,0.14), transparent 68%)" }}
        aria-hidden
      />
      <a
        href="#main"
        className="sr-only z-30 rounded-md bg-ink px-3 py-2 text-[13px] text-surface focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="relative z-10 flex justify-center px-4 pt-6">
        <div className="flex h-12 max-w-full items-center gap-4 rounded-full border border-white/[0.08] bg-[#141416]/80 pr-1.5 pl-4 backdrop-blur-md md:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-[14px] font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.svg" alt="" width={18} height={18} className="size-[18px]" />
            WalletDesk
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] text-muted-ink md:flex" aria-label="Browse">
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
              className="hidden text-[12px] text-muted-ink hover:text-ink lg:inline"
            >
              {account.label}
            </button>
          ))}
          {isConnected ? (
            <button type="button" onClick={() => disconnect()} className={connectClass} title={chain?.name ?? "Disconnect"}>
              <span className="font-mono">
                {address?.slice(0, 6)}…{address?.slice(-4)}
              </span>
            </button>
          ) : (
            <button
              type="button"
              className={connectClass}
              disabled={!injected || isPending}
              onClick={() => injected && connect({ connector: injected })}
            >
              {injected ? "Connect" : "No wallet"}
            </button>
          )}
        </div>
      </header>
      <nav className="relative z-10 mt-3 flex justify-center gap-4 overflow-x-auto px-4 text-[13px] text-muted-ink [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden" aria-label="Browse">
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
      <footer className="relative z-10 px-6 pt-8 pb-6 text-center font-mono text-[11px] text-faint">
        <p>Powered by SwapVM — © Degensoft Ltd 2025</p>
        <p className="mt-1">Powered by Aqua — © Degensoft Ltd 2025</p>
      </footer>
    </div>
  );
}
