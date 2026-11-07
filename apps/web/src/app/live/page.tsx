"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { createPublicClient, formatUnits, http, parseUnits } from "viem";
import { useAccount, useConnect, usePublicClient, useWriteContract } from "wagmi";

import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  aquaAbi,
  erc20Abi,
  feedAbi,
  hookAbi,
  poolKey,
  routerAbi,
  shortError,
  skipReasons,
  stockRouterAbi,
  type Deployment,
} from "@/lib/contracts";
import { CopyButton } from "@/components/copy-button";
import { MintTestTokens } from "@/components/mint-test-tokens";
import { ExternalLink, FilterChip, SplitBar } from "@/components/site";
import { TxSteps, useTxSteps } from "@/components/tx-steps";
import { formatAmount, formatPriceX18 } from "@/lib/desk";
import { addressUrl, txUrl } from "@/lib/live";
import { useDeployment } from "@/lib/use-deployment";
import { useSwitchNetwork } from "@/lib/use-switch-network";

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

type KeeperSkip = { txHash: string; maker: string; reason: number; blockNumber: number };

type Balances = { wallet0: bigint; wallet1: bigint; virtual0: bigint | null; virtual1: bigint | null };

type Guard = {
  spotX18: bigint;
  referenceX18: bigint | null;
  referenceAge: number | null;
  maxReferenceAge: number;
  deskCount: bigint;
  cap: bigint;
};

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
const MIN_SQRT_PRICE_PLUS_ONE = 4295128740n;

export default function LivePage() {
  const state = useDeployment();
  const { address, isConnected } = useAccount();
  const { switchTo, walletChainId } = useSwitchNetwork();
  const walletClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { connect, connectors, isPending: connecting, error: connectError } = useConnect();
  const injected = connectors[0];
  const [swapSize, setSwapSize] = useState("5");
  const [route, setRoute] = useState<"overflow" | "stock">("overflow");
  const [fill, setFill] = useState<Fill | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [guard, setGuard] = useState<Guard | null>(null);
  const [keeper, setKeeper] = useState<KeeperFill[]>([]);
  const [skips, setSkips] = useState<KeeperSkip[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const tx = useTxSteps();
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
        const [wallet0, wallet1, spotX18, deskCount, cap, maxReferenceAge] = await Promise.all([
          client.readContract({ address: current.token0, abi: erc20Abi, functionName: "balanceOf", args: [current.maker] }),
          client.readContract({ address: current.token1, abi: erc20Abi, functionName: "balanceOf", args: [current.maker] }),
          client.readContract({ address: current.hook, abi: hookAbi, functionName: "spotPriceX18", args: [current.poolId] }),
          client.readContract({ address: current.hook, abi: hookAbi, functionName: "deskCount", args: [current.poolId] }),
          client.readContract({ address: current.hook, abi: hookAbi, functionName: "poolInputCap", args: [current.poolId] }),
          client.readContract({ address: current.hook, abi: hookAbi, functionName: "maxReferenceAge" }),
        ]);
        let virtual: readonly [bigint, bigint] | null = null;
        if (current.strategyHash !== ZERO_HASH) {
          try {
            virtual = await client.readContract({
              address: current.aqua,
              abi: aquaAbi,
              functionName: "safeBalances",
              args: [current.maker, current.swapVm, current.strategyHash, current.token0, current.token1],
            });
          } catch {
            virtual = null;
          }
        }
        let referenceX18: bigint | null = null;
        let referenceAge: number | null = null;
        if (current.priceFeed) {
          const [price, updatedAt] = await client.readContract({
            address: current.priceFeed,
            abi: feedAbi,
            functionName: "referenceOf",
            args: [current.poolId],
          });
          const block = await client.getBlock();
          referenceX18 = price === 0n ? null : price;
          referenceAge = updatedAt === 0n ? null : Number(block.timestamp - updatedAt);
        }
        let keeperFills: KeeperFill[] = [];
        let keeperSkips: KeeperSkip[] = [];
        if (current.keeperUrl) {
          try {
            const [fillsResponse, skipsResponse] = await Promise.all([
              fetch(`${current.keeperUrl}/fills`),
              fetch(`${current.keeperUrl}/skips`),
            ]);
            if (fillsResponse.ok) keeperFills = ((await fillsResponse.json()) as { fills: KeeperFill[] }).fills;
            if (skipsResponse.ok) keeperSkips = ((await skipsResponse.json()) as { skips: KeeperSkip[] }).skips;
          } catch {
            keeperFills = [];
          }
        }
        if (!cancelled) {
          setFill(maker === "0x0000000000000000000000000000000000000000" ? null : { maker, residualIn, filledOut, feeOut, fillId });
          setBalances({ wallet0, wallet1, virtual0: virtual ? virtual[0] : null, virtual1: virtual ? virtual[1] : null });
          setGuard({ spotX18, referenceX18, referenceAge, maxReferenceAge: Number(maxReferenceAge), deskCount, cap });
          setKeeper(keeperFills);
          setSkips(keeperSkips);
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
      setSwapError("Connect the taker wallet on the demo chain.");
      return;
    }
    let amount: bigint;
    try {
      amount = parseUnits(swapSize.trim(), deployment.decimals0);
    } catch {
      amount = 0n;
    }
    if (amount === 0n) {
      setSwapError("Enter a swap size.");
      return;
    }
    const spender = route === "stock" && deployment.stockRouter ? deployment.stockRouter : deployment.overflowRouter;
    setBusy(true);
    setSwapError(null);
    setSwapHash(null);
    tx.reset();
    try {
      if (walletChainId !== deployment.chainId) {
        tx.start("Switch network");
        await switchTo(deployment.chainId);
      }
      const allowance = await walletClient.readContract({
        address: deployment.token0,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, spender],
      });
      if (allowance < amount) {
        tx.start(`Approve ${deployment.symbol0} for the router`);
        const hash = await writeContractAsync({
          address: deployment.token0,
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, amount],
          chainId: deployment.chainId,
        });
        tx.sent(hash);
        await walletClient.waitForTransactionReceipt({ hash });
      }
      let hash: `0x${string}`;
      if (route === "stock" && deployment.stockRouter) {
        tx.start("Swap through Uniswap's PoolSwapTest router");
        hash = await writeContractAsync({
          address: deployment.stockRouter,
          abi: stockRouterAbi,
          functionName: "swap",
          args: [
            poolKey(deployment),
            { zeroForOne: true, amountSpecified: -amount, sqrtPriceLimitX96: MIN_SQRT_PRICE_PLUS_ONE },
            { takeClaims: false, settleUsingBurn: false },
            "0x",
          ],
          chainId: deployment.chainId,
        });
      } else {
        tx.start("Swap through OverflowRouter");
        hash = await writeContractAsync({
          address: deployment.overflowRouter,
          abi: routerAbi,
          functionName: "swapExactInput",
          args: [poolKey(deployment), true, amount, 0n, address],
          chainId: deployment.chainId,
        });
      }
      tx.sent(hash);
      await walletClient.waitForTransactionReceipt({ hash });
      tx.finish();
      setSwapHash(hash);
    } catch (caught) {
      tx.fail();
      setSwapError(shortError(caught));
    } finally {
      setBusy(false);
    }
  }

  const d0 = deployment?.decimals0 ?? 18;
  const d1 = deployment?.decimals1 ?? 18;
  const referenceFresh =
    guard && guard.referenceAge !== null ? guard.referenceAge <= guard.maxReferenceAge : false;
  const lastSkip = skips[0];

  const explorer = deployment?.explorer;
  const capNumber = guard ? Number(formatUnits(guard.cap, d0)) : 1;
  const sizeNumber = Number(swapSize.trim());
  const plannedSize = Number.isFinite(sizeNumber) && sizeNumber > 0 ? sizeNumber : 0;
  const plannedPool = Math.min(plannedSize, capNumber);
  const plannedDesk = Math.max(plannedSize - capNumber, 0);

  const guardNote = !deployment?.priceFeed ? "Spot only" : referenceFresh ? "CRE fresh" : "CRE stale";

  return (
    <div className="mx-auto flex max-w-[760px] flex-col pt-10">
      <h1 className="text-[40px] font-semibold tracking-tight">Live</h1>
      <p className="mt-3 max-w-[420px] text-[16px] leading-relaxed text-body">Send a swap larger than the pool cap.</p>

      <div className="mt-10 overflow-hidden rounded-[14px] border border-white/[0.08] bg-raised">
        <div className="flex h-11 items-center gap-3 border-b border-white/[0.08] px-4">
          <span className="font-mono text-[11px] tracking-[0.06em] text-muted-ink uppercase">Swap</span>
          <span className="ml-auto font-mono text-[11px] text-muted-ink">{guardNote}</span>
        </div>
        <div className="grid gap-5 p-6 md:p-8">
          {state.status === "missing" ? (
            <Notice tone="info">Run ./script/demo.sh to fork Unichain, ship a maker, and place an overflow fill on this page.</Notice>
          ) : null}
          {state.status === "error" ? <Notice tone="error">{state.error}</Notice> : null}
          <div className="grid gap-1.5">
            <Label>Router</Label>
            <div role="group" aria-label="Router" className="inline-flex w-fit flex-wrap gap-1 rounded-full bg-sunken p-1">
              <FilterChip pressed={route === "overflow"} onClick={() => setRoute("overflow")}>
                OverflowRouter
              </FilterChip>
              <FilterChip pressed={route === "stock"} disabled={!deployment?.stockRouter} onClick={() => setRoute("stock")}>
                Uniswap PoolSwapTest
              </FilterChip>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="swap-size">Size, {deployment?.symbol0 ?? "input"} in</Label>
            <Input id="swap-size" inputMode="decimal" autoComplete="off" value={swapSize} onChange={(event) => setSwapSize(event.target.value)} className="h-12 font-mono text-[18px]" />
          </div>
          {plannedSize > 0 && guard ? <SplitBar total={plannedSize} poolPart={plannedPool} symbol={deployment?.symbol0 ?? ""} /> : null}
          <TxSteps steps={tx.steps} explorer={explorer} />
          {swapError ? <Notice tone="error">{swapError}</Notice> : null}
          {swapHash ? (
            <Notice tone="ok">
              Swap mined. {txUrl(explorer, swapHash) ? <ExternalLink href={txUrl(explorer, swapHash)}>View on the explorer</ExternalLink> : <span className="font-mono text-xs break-all">{swapHash}</span>}
            </Notice>
          ) : null}
          {isConnected ? (
            <Button type="button" className="h-11 rounded-[10px]" onClick={() => void runSwap()} disabled={busy || !deployment}>
              {busy ? "Swapping…" : "Run overflow"}
            </Button>
          ) : (
            <Button type="button" className="h-11 rounded-[10px]" disabled={!injected || connecting} onClick={() => injected && connect({ connector: injected })}>
              {injected ? "Connect a wallet to swap" : "No browser wallet found"}
            </Button>
          )}
          {!isConnected && connectError ? (
            <Notice tone="error">
              Could not connect a wallet ({connectError.message.split(".")[0]}). Install a browser wallet on Unichain Sepolia, or run the local demo
              with ./script/demo.sh.
            </Notice>
          ) : null}
        </div>
        <div className="grid border-t border-white/[0.08] md:grid-cols-2">
          <div className="border-b border-white/[0.08] p-6 md:border-r md:border-b-0">
            <p className="font-mono text-[11px] tracking-[0.08em] text-muted-ink uppercase">Maker wallet</p>
            {deployment && balances ? (
              <table className="mt-3 w-full text-left text-[13px]">
                <thead className="text-[12px] text-muted-ink">
                  <tr>
                    <th className="py-1 font-medium">Side</th>
                    <th className="py-1 font-medium">Wallet</th>
                    <th className="py-1 font-medium">Virtual</th>
                  </tr>
                </thead>
                <tbody>
                  <BalanceRow symbol={deployment.symbol0} wallet={balances.wallet0} virtual={balances.virtual0} decimals={d0} />
                  <BalanceRow symbol={deployment.symbol1} wallet={balances.wallet1} virtual={balances.virtual1} decimals={d1} />
                </tbody>
              </table>
            ) : (
              <p className="mt-3 text-[13px] text-muted-ink">{deployment && loading ? "Reading the chain…" : "No balances yet."}</p>
            )}
            {error ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}
          </div>
          <div className="p-6 text-[13px]">
            <p className="font-mono text-[11px] tracking-[0.08em] text-muted-ink uppercase">Price guard</p>
            <table className="mt-3 w-full">
              <tbody>
                <Line label="Pool spot" value={guard ? formatPriceX18(guard.spotX18, d0, d1) : "…"} />
                <Line
                  label="CRE"
                  value={
                    !deployment?.priceFeed
                      ? "no feed"
                      : guard?.referenceX18
                        ? `${formatPriceX18(guard.referenceX18, d0, d1)} · ${humanAge(guard.referenceAge ?? 0)}`
                        : "none yet"
                  }
                />
                <Line label="Desks" value={guard ? guard.deskCount.toString() : "…"} />
                <Line label="Cap" value={guard ? `${formatAmount(guard.cap, d0)} ${deployment?.symbol0 ?? ""}` : "…"} />
                <Line label="Last skip" value={lastSkip ? `${skipReasons[lastSkip.reason] ?? lastSkip.reason}` : "none"} />
              </tbody>
            </table>
          </div>
        </div>
        <div className="border-t border-white/[0.08] p-6">
          <p className="font-mono text-[11px] tracking-[0.08em] text-muted-ink uppercase">Last fill</p>
          {fill ? (
            <div className="mt-3 grid gap-3">
              <SplitBar total={capNumber + Number(formatUnits(fill.residualIn, d0))} poolPart={capNumber} symbol={deployment?.symbol0 ?? ""} />
              <table className="w-full text-[13px]">
                <tbody>
                  <Line label="Maker" value={fill.maker} copy="maker address" />
                  <Line label="Residual in" value={`${formatAmount(fill.residualIn, d0, 6)} ${deployment?.symbol0 ?? ""}`} />
                  <Line label="Shelf out" value={`${formatAmount(fill.filledOut, d1, 6)} ${deployment?.symbol1 ?? ""}`} />
                  <Line label="Spread kept" value={`${formatAmount(fill.feeOut, d1, 6)} ${deployment?.symbol1 ?? ""}`} />
                  <Line label="Fill id" value={fill.fillId} copy="fill id" />
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-muted-ink">None yet.</p>
          )}
          {keeper[0] ? (
            <div className="mt-4 space-y-1 text-[13px]">
              <p className="break-all font-mono text-[11px]">{keeper[0].txHash}</p>
              {keeper[0].transfers.map((transfer, index) => (
                <p key={`${transfer.event}-${index}`}>
                  {transfer.event} {formatUnits(BigInt(transfer.amount), 18)}
                </p>
              ))}
              <p className="text-muted-ink">{keeper[0].credited ? "USDC rebate credited." : keeper[0].creditNote || "Rebate pending."}</p>
            </div>
          ) : null}
        </div>
      </div>
      {deployment ? (
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-muted-ink" aria-label="Deployed contracts">
          {(
            [
              ["OverflowHook", deployment.hook],
              ["DeskPriceFeed", deployment.priceFeed],
              ["Maker", deployment.maker],
            ] as const
          ).map(([name, addr]) =>
            addr ? (
              <li key={name} className="inline-flex items-center gap-1">
                <span>{name}</span>
                <span title={addr}>{`${addr.slice(0, 6)}…${addr.slice(-4)}`}</span>
                <CopyButton value={addr} label={`${name} address`} />
                {addressUrl(explorer, addr) ? (
                  <a href={addressUrl(explorer, addr)} target="_blank" rel="noopener noreferrer" className="text-link" aria-label={`${name} on the explorer`}>
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </li>
            ) : null,
          )}
          <li>
            <MintTestTokens deployment={deployment} which="token0" />
          </li>
        </ul>
      ) : null}
    </div>
  );
}

function humanAge(seconds: number): string {
  if (seconds < 120) return `${seconds}s`;
  if (seconds < 7200) return `${Math.round(seconds / 60)} min`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

function BalanceRow({
  symbol,
  wallet,
  virtual,
  decimals,
}: {
  symbol: string;
  wallet: bigint;
  virtual: bigint | null;
  decimals: number;
}) {
  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2">{symbol}</td>
      <td className="px-3 py-2 font-mono tabular-nums">{formatAmount(wallet, decimals)}</td>
      <td className="px-3 py-2 font-mono tabular-nums">{virtual === null ? "not shipped" : formatAmount(virtual, decimals)}</td>
    </tr>
  );
}

function Line({ label, value, copy }: { label: string; value: string; copy?: string }) {
  return (
    <tr className="border-t border-line first:border-t-0">
      <td className="px-3 py-2 align-top text-muted-ink">{label}</td>
      <td className="px-3 py-2 text-right font-mono text-xs break-all tabular-nums">
        {copy ? (
          <span className="inline-flex items-center justify-end gap-1">
            {/* The copy button carries the full value; the cell shows both ends, which is what people compare. */}
            <span title={value}>{value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value}</span>
            <CopyButton value={value} label={copy} className="-my-1" />
          </span>
        ) : (
          value
        )}
      </td>
    </tr>
  );
}
