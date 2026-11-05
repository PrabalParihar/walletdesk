"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";
import { networkMode } from "@/lib/chains";
import { cn } from "@/lib/utils";

const links = [
  { href: "/desk", label: "Ship" },
  { href: "/live", label: "Live" },
  { href: "/fees", label: "Fees" },
  { href: "/docs", label: "Docs" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const injected = connectors[0];

  return (
    <div className="min-h-screen bg-white text-[#18181B]">
      <header className="sticky top-0 z-20 border-b border-black/8 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-[15px] font-semibold tracking-tight">
              WalletDesk
            </Link>
            <span className="rounded-full bg-[#00BBFF]/15 px-2 py-0.5 text-[11px] font-medium text-[#0B6E99]">
              {networkMode === "sepolia" ? "Unichain Sepolia" : "Unichain fork"}
            </span>
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[13px] text-[#5D5D66] transition-colors hover:text-[#18181B]",
                  pathname === link.href && "bg-[#F2F2F3] text-[#18181B]",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {isConnected ? (
            <Button variant="outline" size="sm" onClick={() => disconnect()}>
              <span className="font-mono text-xs">
                {address?.slice(0, 6)}…{address?.slice(-4)}
              </span>
              <span className="text-[#5D5D66]">{chain?.name ?? "wallet"}</span>
            </Button>
          ) : (
            <Button size="sm" disabled={!injected || isPending} onClick={() => injected && connect({ connector: injected })}>
              {injected ? "Connect" : "No wallet"}
            </Button>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-black/8 px-4 py-2 sm:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-1 text-[13px] text-[#5D5D66]",
                pathname === link.href && "bg-[#F2F2F3] text-[#18181B]",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">{children}</main>
    </div>
  );
}
