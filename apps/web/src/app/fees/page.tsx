"use client";

import { useEffect, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Maker rebates in USDC</CardTitle>
            <Badge variant="outline">USDC, 6 decimals on the ERC-20 interface</Badge>
          </div>
          <p className="max-w-2xl text-[13px] leading-relaxed text-[#5D5D66]">
            The maker&apos;s spread on each fill stays in the maker wallet as the output token. On top of that, a protocol-funded rebate
            program pays USDC per attested fill into FeeShareTreasury. Circle CCTP V2 can carry that USDC from Unichain Sepolia (domain 10)
            to Arc testnet (domain 26). The local fork cannot get an Iris attestation, so here the keeper credits the treasury directly and
            the path is labelled attestor. Claims use the 6-decimal ERC-20 interface at <span className="font-mono">{addresses.arcUsdc}</span> on Arc.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Stat label="Claimable USDC rebate" value={loading ? "Reading…" : claimable === null ? "No treasury yet" : formatUnits(claimable, 6)} />
          <Stat label="Protocol split" value={split === null ? "0 bps until the owner sets one" : `${split} bps`} />
          <Stat label="Settlement" value={deployment ? `${deployment.settlement}. ${keeper || ""}` : "Not deployed"} />
        </CardContent>
      </Card>
      <Card className="bg-[#F2F2F3] shadow-none">
        <CardHeader>
          <CardTitle>Claim</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px] text-[#5D5D66]">
          {state.status === "missing" ? (
            <Notice tone="info">The fork treasury appears after ./script/demo.sh. Arc Studio steps are in arc/README.md. There is no Studio URL until you create the project.</Notice>
          ) : null}
          {deployment ? (
            <p>
              Treasury <span className="font-mono">{claimTreasury}</span>. USDC balance in the contract{" "}
              {balance === null ? "…" : formatUnits(balance, 6)}. Showing the connected wallet, or the seeded maker if the wallet is disconnected.
            </p>
          ) : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          {hash ? <Notice tone="ok">Claim mined. {hash}</Notice> : null}
          <Button disabled={busy || !isConnected || !deployment} onClick={() => void claim()}>
            {busy ? "Claiming" : isConnected ? "Claim USDC" : "Connect to claim"}
          </Button>
          <p>
            Studio paste steps: <span className="font-mono">arc/README.md</span>. Do not send native value to the treasury.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-black/8 bg-white p-3">
      <p className="text-[12px] text-[#5D5D66]">{label}</p>
      <p className="mt-1 text-[14px] break-words">{value}</p>
    </div>
  );
}
