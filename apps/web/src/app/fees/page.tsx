"use client";

import { useEffect, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { useAccount, useChainId, useConnect, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/site";
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
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Maker"
        title="Rebates"
        lead="The maker's spread on each fill stays in the maker wallet as the output token. On top of that, a protocol-funded rebate program pays USDC per attested fill into FeeShareTreasury."
      />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Maker rebates in USDC</CardTitle>
            <Badge variant="outline">USDC, 6 decimals on the ERC-20 interface</Badge>
          </div>
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-ink">
            Circle CCTP V2 can carry that USDC from Unichain Sepolia (domain 10) to Arc testnet (domain 26). The local fork cannot get an
            Iris attestation, so here the keeper credits the treasury directly and the path is labelled attestor. Claims use the 6-decimal
            ERC-20 interface at <span className="font-mono">{addresses.arcUsdc}</span> on Arc.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Stat label="Claimable USDC rebate" value={claimableLabel} numeric={claimable !== null && !loading} />
          <Stat label="Protocol split" value={splitLabel} numeric={split !== null} />
          <Stat label="Settlement" value={settlementLabel} detail={loading ? "Reading the keeper…" : keeper || undefined} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Claim</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px] text-muted-ink">
          {state.status === "missing" ? (
            <Notice tone="info">The fork treasury appears after ./script/demo.sh. Arc Studio steps are in arc/README.md. There is no Studio URL until you create the project.</Notice>
          ) : null}
          {deployment ? (
            <p>
              Treasury <span className="font-mono">{claimTreasury ?? "not set"}</span>. USDC balance in the contract{" "}
              {balance === null ? "…" : formatUnits(balance, 6)}. Showing the connected wallet, or the seeded maker if the wallet is disconnected.
            </p>
          ) : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          {connectError && !isConnected ? <Notice tone="error">Could not connect a wallet ({connectError.message.split(".")[0]}).</Notice> : null}
          {hash ? <Notice tone="ok">Claim mined. {hash}</Notice> : null}
          {isConnected ? (
            <Button className="h-11 rounded-[10px]" disabled={busy || !deployment} onClick={() => void claim()}>
              {busy ? "Claiming" : "Claim USDC"}
            </Button>
          ) : (
            <Button className="h-11 rounded-[10px]" disabled={!injected || connecting} onClick={() => injected && connect({ connector: injected })}>
              {injected ? "Connect a wallet to claim" : "No browser wallet found"}
            </Button>
          )}
          <p>
            Studio paste steps: <span className="font-mono">arc/README.md</span>. Do not send native value to the treasury.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, detail, numeric = false }: { label: string; value: string; detail?: string; numeric?: boolean }) {
  return (
    <div className="rounded-[14px] border border-line bg-sunken px-4 py-3">
      <p className="text-[12px] text-muted-ink">{label}</p>
      <p className={numeric ? "mt-1 text-[26px] font-semibold tracking-[-0.03em] text-ink tabular-nums" : "mt-1 text-[15px] font-medium text-ink"}>{value}</p>
      {detail ? <p className="mt-1 text-[12px] leading-snug text-muted-ink">{detail}</p> : null}
    </div>
  );
}
