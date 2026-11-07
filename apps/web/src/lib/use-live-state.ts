"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";

import { aquaAbi, erc20Abi, feedAbi, hookAbi, shortError, type Deployment } from "@/lib/contracts";
import type { Balances, Fill, Guard, KeeperFill, KeeperSkip } from "@/lib/live-strip";

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Reads the pool, the maker wallet and the keeper every 8 seconds. Shared by the Live page and the home live strip.
export function useLiveState(deployment: Deployment | null) {
  const [fill, setFill] = useState<Fill | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [guard, setGuard] = useState<Guard | null>(null);
  const [keeper, setKeeper] = useState<KeeperFill[]>([]);
  const [skips, setSkips] = useState<KeeperSkip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return { fill, balances, guard, keeper, skips, loading, error };
}
