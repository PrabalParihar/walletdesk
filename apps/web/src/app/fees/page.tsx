"use client";

import { useEffect, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { useAccount, useChainId, useConnect, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { erc20Abi, shortError, treasuryAbi } from "@/lib/contracts";
import { addresses } from "@/lib/chains";
import { useDeployment } from "@/lib/use-deployment";

export default function FeesPage() {
  const state = useDeployment();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const walletClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { connect, connectors, isPending: connecting, error: connectError } = useConnect();
  const injected = connectors[0];
  const [claimable, setClaimable] = useState<bigint | null>(null);
  const [split, setSplit] = useState<number | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [keeper, setKeeper] = useState<string | null>(null);

  const deployment = state.status === "ready" ? state.deployment : null;
  const claimChain = deployment?.arcChainId || deployment?.chainId;
  const claimTreasury = deployment?.arcTreasury || deployment?.treasury;
  const who = address || deployment?.maker;

  useEffect(() => {
    if (!deployment || !who || !claimTreasury) return;
    let cancelled = false;
    const rpc = deployment.arcChainId ? process.env.NEXT_PUBLIC_ARC_RPC || "https://rpc.testnet.arc.io" : deployment.rpcUrl;
    const client = createPublicClient({ transport: http(deployment.arcChainId && deployment.arcTreasury ? rpc : deployment.rpcUrl) });
    async function load() {
      setLoading(true);
      try {
        const usdc = deployment!.arcTreasury ? addresses.arcUsdc : deployment!.usdc;
        if (!usdc) return;
        const [amount, bps, treasuryBalance] = await Promise.all([
          client.readContract({ address: claimTreasury!, abi: treasuryAbi, functionName: "claimable", args: [who!] }),
          client.readContract({ address: claimTreasury!, abi: treasuryAbi, functionName: "protocolBps" }),
          client.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [claimTreasury!] }),
        ]);
        let health = "keeper not reached";
        try {
          if (!deployment!.keeperUrl) throw new Error("no keeper");
          const response = await fetch(`${deployment!.keeperUrl}/health`);
          if (response.ok) {
            const body = (await response.json()) as { ok: boolean; settlement: string; fills: number };
            health = `${body.settlement}, ${body.fills} fill${body.fills === 1 ? "" : "s"}`;
          }
        } catch {
          health = "keeper not reached";
        }
        if (!cancelled) {
          setClaimable(amount);
          setSplit(bps);
          setBalance(treasuryBalance);
          setKeeper(health);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) setError(shortError(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [deployment, who, claimTreasury]);

  async function claim() {
    if (!deployment || !address || !walletClient || !claimTreasury || !claimChain) {
      setError("Connect the maker wallet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (chainId !== claimChain) {
        await switchChainAsync({ chainId: claimChain });
      }
      const tx = await writeContractAsync({
        address: claimTreasury,
        abi: treasuryAbi,
        functionName: "claim",
        chainId: claimChain,
      });
      await walletClient.waitForTransactionReceipt({ hash: tx });
      setHash(tx);
    } catch (caught) {
      setError(shortError(caught));
    } finally {
      setBusy(false);
    }
  }

  const claimableLabel = loading ? "Reading…" : claimable === null ? "No treasury yet" : formatUnits(claimable, 6);
  const splitLabel = split === null ? "0 bps until the owner sets one" : `${split} bps`;
  const settlementLabel = deployment ? deployment.settlement : "Not deployed";

  return (
    <div className="mx-auto flex max-w-[720px] flex-col pt-10">
      <h1 className="text-[40px] font-semibold tracking-tight">Rebates</h1>
      <p className="mt-3 max-w-[460px] text-[16px] leading-relaxed text-body">USDC per attested fill, on top of the spread that stays in the wallet.</p>
      <div className="mt-10 overflow-hidden rounded-[14px] border border-white/[0.08] bg-raised">
        <div className="grid gap-px bg-white/[0.08] sm:grid-cols-3">
          <Stat label="Claimable" value={claimableLabel} numeric={claimable !== null && !loading} />
          <Stat label="Protocol split" value={splitLabel} />
          <Stat label="Settlement" value={settlementLabel} detail={loading ? "Reading…" : keeper || undefined} />
        </div>
        <div className="grid gap-4 p-6 md:p-8">
          {state.status === "missing" ? (
            <Notice tone="info">The fork treasury appears after ./script/demo.sh. Arc Studio steps are in arc/README.md.</Notice>
          ) : null}
          {deployment ? (
            <p className="font-mono text-[12px] text-muted-ink">
              Treasury {claimTreasury ?? "not set"} · balance {balance === null ? "…" : formatUnits(balance, 6)} USDC
            </p>
          ) : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          {connectError && !isConnected ? <Notice tone="error">Could not connect a wallet ({connectError.message.split(".")[0]}).</Notice> : null}
          {hash ? <Notice tone="ok">Claim mined. {hash}</Notice> : null}
          {isConnected ? (
            <Button className="h-11 w-fit rounded-[10px]" disabled={busy || !deployment} onClick={() => void claim()}>
              {busy ? "Claiming" : "Claim USDC"}
            </Button>
          ) : (
            <Button className="h-11 w-fit rounded-[10px]" disabled={!injected || connecting} onClick={() => injected && connect({ connector: injected })}>
              {injected ? "Connect a wallet to claim" : "No browser wallet found"}
            </Button>
          )}
          <p className="text-[13px] text-muted-ink">
            CCTP domain 10 to 26. Claims use <span className="font-mono">{addresses.arcUsdc}</span>. See arc/README.md. Do not send native value.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, detail, numeric = false }: { label: string; value: string; detail?: string; numeric?: boolean }) {
  return (
    <div className="bg-raised px-5 py-4">
      <p className="text-[12px] text-muted-ink">{label}</p>
      <p className={numeric ? "mt-1 text-[26px] font-semibold tracking-[-0.03em] text-ink tabular-nums" : "mt-1 text-[15px] font-medium text-ink"}>{value}</p>
      {detail ? <p className="mt-1 text-[12px] leading-snug text-muted-ink">{detail}</p> : null}
    </div>
  );
}
