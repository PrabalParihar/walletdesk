"use client";

import { useEffect, useState } from "react";

import { networkMode } from "@/lib/chains";
import { parseDeployment, type Deployment } from "@/lib/contracts";
import { SEPOLIA_DEPLOYMENT } from "@/lib/live";

export type DeploymentState =
  | { status: "loading"; deployment: null; error: null }
  | { status: "ready"; deployment: Deployment; error: null }
  | { status: "missing"; deployment: null; error: null }
  | { status: "error"; deployment: null; error: string };

export function useDeployment(): DeploymentState {
  const [state, setState] = useState<DeploymentState>({ status: "loading", deployment: null, error: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // public/deployments.json is written by ./script/demo.sh for the local fork only. Other networks never read
        // it, so a leftover fork file cannot masquerade as a live deployment.
        if (networkMode === "fork") {
          const response = await fetch("/deployments.json", { cache: "no-store" });
          if (response.ok) {
            const parsed = parseDeployment(await response.json());
            if (!cancelled) setState({ status: "ready", deployment: parsed, error: null });
            return;
          }
          if (!cancelled) setState({ status: "missing", deployment: null, error: null });
          return;
        }
        const fromEnv = deploymentFromEnv();
        if (!cancelled) {
          setState(fromEnv ? { status: "ready", deployment: fromEnv, error: null } : { status: "missing", deployment: null, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            deployment: null,
            error: error instanceof Error ? error.message : "Could not read the deployment file.",
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function envAddress(name: string): `0x${string}` | null {
  const value = process.env[name];
  if (!value || !value.startsWith("0x")) return null;
  return value as `0x${string}`;
}

function deploymentFromEnv(): Deployment | null {
  if (networkMode === "fork") return null;
  const live = networkMode === "unichain";
  const hook = envAddress("NEXT_PUBLIC_HOOK");
  const swapVm = envAddress("NEXT_PUBLIC_SWAP_VM");
  const overflowRouter = envAddress("NEXT_PUBLIC_OVERFLOW_ROUTER");
  const orderBuilder = envAddress("NEXT_PUBLIC_ORDER_BUILDER");
  const token0 = envAddress("NEXT_PUBLIC_TOKEN0");
  const token1 = envAddress("NEXT_PUBLIC_TOKEN1");
  const treasury = envAddress("NEXT_PUBLIC_TREASURY") || undefined;
  const usdc = envAddress("NEXT_PUBLIC_USDC") || undefined;
  const maker = envAddress("NEXT_PUBLIC_MAKER");
  if (!hook || !swapVm || !overflowRouter || !orderBuilder || !token0 || !token1 || !maker) {
    // No overrides: Sepolia falls back to the committed live deployment.
    return live ? null : SEPOLIA_DEPLOYMENT;
  }
  const arcTreasury = envAddress("NEXT_PUBLIC_ARC_TREASURY");
  return {
    network: live ? "unichain" : "sepolia",
    chainId: live ? 130 : 1301,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || (live ? "https://mainnet.unichain.org" : "https://sepolia.unichain.org"),
    keeperUrl: process.env.NEXT_PUBLIC_KEEPER_URL || "",
    // Aqua is not deployed on Unichain Sepolia. Set NEXT_PUBLIC_AQUA to the registry DeployUnichainSepolia created.
    aqua: envAddress("NEXT_PUBLIC_AQUA") || "0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a",
    poolManager:
      envAddress("NEXT_PUBLIC_POOL_MANAGER") ||
      (live ? "0x1F98400000000000000000000000000000000004" : "0x00B036B58a818B1BC34d502D3fE730Db729e62AC"),
    swapVm,
    hook,
    overflowRouter,
    priceFeed: envAddress("NEXT_PUBLIC_PRICE_FEED") || undefined,
    orderBuilder,
    token0,
    token1,
    symbol0: process.env.NEXT_PUBLIC_SYMBOL0 || "token0",
    symbol1: process.env.NEXT_PUBLIC_SYMBOL1 || "token1",
    decimals0: Number(process.env.NEXT_PUBLIC_DECIMALS0 || 18),
    decimals1: Number(process.env.NEXT_PUBLIC_DECIMALS1 || 18),
    fee: Number(process.env.NEXT_PUBLIC_POOL_FEE || 3000),
    tickSpacing: Number(process.env.NEXT_PUBLIC_TICK_SPACING || 60),
    maxDeviationBps: Number(process.env.NEXT_PUBLIC_MAX_DEVIATION_BPS || 100),
    treasury,
    usdc,
    maker,
    taker: envAddress("NEXT_PUBLIC_TAKER") || "0x0000000000000000000000000000000000000000",
    deployBlock: Number(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || 0),
    poolId: (envAddress("NEXT_PUBLIC_POOL_ID") || "0x0000000000000000000000000000000000000000000000000000000000000000"),
    poolCap: process.env.NEXT_PUBLIC_POOL_CAP || "1000000000000000000",
    shipAmount: process.env.NEXT_PUBLIC_SHIP_AMOUNT || "1000000000000000000000",
    exampleSwap: process.env.NEXT_PUBLIC_EXAMPLE_SWAP || "5000000000000000000",
    strategyHash: (envAddress("NEXT_PUBLIC_STRATEGY_HASH") ||
      "0x0000000000000000000000000000000000000000000000000000000000000000"),
    settlement: live ? "none" : "cctp",
    arcChainId: arcTreasury ? 5_042_002 : undefined,
    arcTreasury: arcTreasury || undefined,
    explorer: live ? "https://uniscan.xyz" : "https://sepolia.uniscan.xyz",
  };
}
