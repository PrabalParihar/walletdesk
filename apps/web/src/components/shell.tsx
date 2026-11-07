"use client";

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
  { href: "/", label: "Overview" },
  { href: "/how", label: "How it works" },
  { href: "/desk", label: "Make a desk" },
  { href: "/live", label: "Live" },
  { href: "/fees", label: "Rebates" },
];

const proof = [
  { href: txUrl(SEPOLIA_EXPLORER, SEPOLIA_PROOF.overflowRouterFill) ?? REPO_URL, label: "The overflow fill" },
  { href: repoFile("docs/DEPLOYMENTS.md"), label: "Every Sepolia tx" },
  { href: REPO_URL, label: "Source" },
];

/**
 * Top bar only, the way Mobbin, Details, and Minimal Gallery open: mark, text links, one action.
 * The network is a single quiet line in the footer, not a card, a badge, and a hero link.
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

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      aria-current={isActive(href) ? "page" : undefined}
      className={cn(
        "shrink-0 px-2.5 py-1 text-[13px] whitespace-nowrap transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
        isActive(href) ? "text-ink" : "text-muted-ink hover:text-ink",
      )}
    >
      {label}
    </Link>
  );

  const status = (
    <a
      href={hookUrl}
      target={hookUrl ? "_blank" : undefined}
      rel={hookUrl ? "noopener noreferrer" : undefined}
      className={cn("inline-flex items-center gap-2 text-[12px] text-muted-ink", hookUrl && "hover:text-ink")}
    >
      <span className="size-1.5 rounded-full bg-[#10B981]" aria-hidden />
      {networkMode === "fork" ? "Local fork" : networkLabel[networkMode]}
    </a>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface text-ink">
      <a
        href="#main"
        className="sr-only z-30 rounded-md bg-ink px-3 py-2 text-[13px] text-surface focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="z-20 border-b border-line">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-2 px-5">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.svg" alt="" width={22} height={22} className="size-[22px]" />
            WalletDesk
          </Link>
          <nav className="ml-6 hidden items-center md:flex" aria-label="Browse">
            {browse.map((link) => (
              <span key={link.href}>{navLink(link.href, link.label)}</span>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <JumpMenu />
            <ThemeToggle />
            {wallet}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden" aria-label="Browse">
          {browse.map((link) => (
            <span key={link.href}>{navLink(link.href, link.label)}</span>
          ))}
        </nav>
      </header>
      <div className="wd-scroll min-h-0 flex-1 overflow-y-auto">
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1120px] px-5 py-8 outline-none md:py-10">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 text-[12px] text-muted-ink">
            {hookUrl ? status : <span className="inline-flex items-center gap-2"><span className="size-1.5 rounded-full bg-[#10B981]" aria-hidden />{networkMode === "fork" ? "Local fork" : networkLabel[networkMode]}</span>}
            {proof.map(({ href, label }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                {label}
              </a>
            ))}
            <span className="ml-auto font-mono text-[11px]">ETHGlobal Mumbai</span>
          </div>
          <div className="mx-auto flex max-w-[1120px] flex-wrap gap-x-4 gap-y-1 px-5 pb-4 font-mono text-[11px] text-faint">
            <span>Powered by SwapVM — © Degensoft Ltd 2025</span>
            <span>Powered by Aqua — © Degensoft Ltd 2025</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
