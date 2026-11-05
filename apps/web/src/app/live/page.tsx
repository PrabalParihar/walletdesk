"use client";

import { useEffect, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { aquaAbi, erc20Abi, hookAbi, poolKey, routerAbi, shortError, type Deployment } from "@/lib/contracts";
import { parseUnits18 } from "@/lib/desk";
import { useDeployment } from "@/lib/use-deployment";

type Fill = {
  maker: `0x${string}`;
  residualIn: bigint;
  filledOut: bigint;
  feeOut: bigint;
  fillId: `0x${string}`;
};

type KeeperFill = {
  fillId: string;
  txHash: string;
  residualIn: string | null;
  filledOut: string | null;
  feeOut: string;
  transfers: { event: string; token: string; amount: string }[];
  credited: boolean;
  creditNote?: string;
};

type Balances = { wallet0: bigint; wallet1: bigint; virtual0: bigint; virtual1: bigint };

export default function LivePage() {
  const state = useDeployment();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const walletClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [swapSize, setSwapSize] = useState("5");
  const [fill, setFill] = useState<Fill | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [keeper, setKeeper] = useState<KeeperFill[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [swapHash, setSwapHash] = useState<string | null>(null);

  const deployment = state.status === "ready" ? state.deployment : null;

  useEffect(() => {
    if (!deployment) return;
    let cancelled = false;
    const client = createPublicClient({ transport: http(deployment.rpcUrl) });
    async function load(current: Deployment) {
      setLoading(true);
      try {
        const last = await client.readContract({
          address: current.hook,
          abi: hookAbi,
          functionName: "lastFill",
          args: [current.poolId],
        });
        const [maker, , , residualIn, filledOut, feeOut, fillId] = last;
        const [wallet0, wallet1, virtual] = await Promise.all([
          client.readContract({ address: current.token0, abi: erc20Abi, functionName: "balanceOf", args: [current.maker] }),
          client.readContract({ address: current.token1, abi: erc20Abi, functionName: "balanceOf", args: [current.maker] }),
          client.readContract({
            address: current.aqua,
            abi: aquaAbi,
            functionName: "safeBalances",
            args: [current.maker, current.swapVm, current.strategyHash, current.token0, current.token1],
          }),
        ]);
        let keeperFills: KeeperFill[] = [];
        try {
          const response = await fetch(`${current.keeperUrl}/fills`);
          if (response.ok) {
            const body = (await response.json()) as { fills: KeeperFill[] };
            keeperFills = body.fills;
          }
        } catch {
          keeperFills = [];
        }
        if (!cancelled) {
          setFill(maker === "0x0000000000000000000000000000000000000000" ? null : { maker, residualIn, filledOut, feeOut, fillId });
          setBalances({ wallet0, wallet1, virtual0: virtual[0], virtual1: virtual[1] });
          setKeeper(keeperFills);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) setError(shortError(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load(deployment);
    const timer = window.setInterval(() => void load(deployment), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [deployment]);

  async function runSwap() {
    if (!deployment || !address || !walletClient) {
      setError("Connect the taker wallet on the demo chain.");
      return;
    }
    const amount = parseUnits18(swapSize);
    if (amount === 0n) {
      setError("Enter a swap size.");
      return;
    }
    setBusy(true);
    setError(null);
    setSwapHash(null);
    try {
      if (chainId !== deployment.chainId) {
        setStatus("Switching network");
        await switchChainAsync({ chainId: deployment.chainId });
      }
      const allowance = await walletClient.readContract({
        address: deployment.token0,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, deployment.overflowRouter],
      });
      if (allowance < amount) {
        setStatus("Approving the overflow router");
        const hash = await writeContractAsync({
          address: deployment.token0,
          abi: erc20Abi,
          functionName: "approve",
          args: [deployment.overflowRouter, amount],
          chainId: deployment.chainId,
        });
        await walletClient.waitForTransactionReceipt({ hash });
      }
      setStatus("Swapping through OverflowRouter");
      const hash = await writeContractAsync({
        address: deployment.overflowRouter,
        abi: routerAbi,
        functionName: "swapExactInput",
        args: [poolKey(deployment), true, amount, 0n, address],
        chainId: deployment.chainId,
      });
      await walletClient.waitForTransactionReceipt({ hash });
      setSwapHash(hash);
      setStatus(null);
    } catch (caught) {
      setStatus(null);
      setError(shortError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Desk status</CardTitle>
            <Badge className="bg-[#00BBFF] text-white">{loading ? "loading" : fill ? "live" : "empty"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          {state.status === "missing" ? (
            <Notice tone="info">Run ./script/demo.sh to fork Unichain, ship a maker, and place an overflow fill on this page.</Notice>
          ) : null}
          {state.status === "error" ? <Notice tone="error">{state.error}</Notice> : null}
          {deployment && balances ? (
            <div className="overflow-hidden rounded-[10px] border border-black/8">
              <table className="w-full text-left">
                <thead className="bg-[#F2F2F3] text-[#5D5D66]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Side</th>
                    <th className="px-3 py-2 font-medium">Wallet</th>
                    <th className="px-3 py-2 font-medium">Virtual</th>
                  </tr>
                </thead>
                <tbody>
                  <BalanceRow symbol={deployment.symbol0} wallet={balances.wallet0} virtual={balances.virtual0} />
                  <BalanceRow symbol={deployment.symbol1} wallet={balances.wallet1} virtual={balances.virtual1} />
                </tbody>
              </table>
            </div>
          ) : deployment && loading ? (
            <p className="text-[#5D5D66]">Reading the fork…</p>
          ) : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </CardContent>
      </Card>
      <Card className="shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <CardHeader>
          <CardTitle>Overflow fill</CardTitle>
          <p className="text-[13px] text-[#5D5D66]">
            The seeded swap is already on the fork. Run another one from the taker wallet. Amounts above the pool cap pull the maker shelf.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          {fill ? (
            <div className="overflow-hidden rounded-[10px] border border-black/8 text-[13px]">
              <table className="w-full">
                <tbody>
                  <Line label="Maker" value={fill.maker} />
                  <Line label="Residual in" value={formatUnits(fill.residualIn, 18)} />
                  <Line label="Shelf out (pulled)" value={formatUnits(fill.filledOut, 18)} />
                  <Line label="Fee kept on the shelf" value={formatUnits(fill.feeOut, 18)} />
                  <Line label="Fill id" value={fill.fillId} />
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-[10px] border border-dashed border-black/15 bg-[#F2F2F3] px-3 py-6 text-center text-[13px] text-[#5D5D66]">
              No overflow fill on this pool yet.
            </p>
          )}
          {keeper[0] ? (
            <div className="space-y-2 text-[13px]">
              <p className="text-[#5D5D66]">Keeper transfers</p>
              <p className="break-all font-mono text-xs">{keeper[0].txHash}</p>
              {keeper[0].transfers.map((transfer, index) => (
                <p key={`${transfer.event}-${index}`}>
                  {transfer.event} {formatUnits(BigInt(transfer.amount), 18)}
                </p>
              ))}
              <p>{keeper[0].credited ? "Fee credited on the local treasury." : keeper[0].creditNote || "Credit pending."}</p>
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label>Swap size, input units</Label>
            <Input value={swapSize} onChange={(event) => setSwapSize(event.target.value)} />
          </div>
          {status ? <Notice tone="info">{status}…</Notice> : null}
          {swapHash ? <Notice tone="ok">Swap mined. {swapHash}</Notice> : null}
          <Button type="button" onClick={() => void runSwap()} disabled={busy || !isConnected || !deployment}>
            {busy ? "Swapping" : isConnected ? "Run overflow" : "Connect the taker"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function BalanceRow({ symbol, wallet, virtual }: { symbol: string; wallet: bigint; virtual: bigint }) {
  return (
    <tr className="border-t border-black/8">
      <td className="px-3 py-2">{symbol}</td>
      <td className="px-3 py-2 font-mono">{formatUnits(wallet, 18)}</td>
      <td className="px-3 py-2 font-mono">{formatUnits(virtual, 18)}</td>
    </tr>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t border-black/8 first:border-t-0">
      <td className="px-3 py-2 text-[#5D5D66]">{label}</td>
      <td className="px-3 py-2 text-right font-mono text-xs break-all">{value}</td>
    </tr>
  );
}
