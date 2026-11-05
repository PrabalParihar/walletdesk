"use client";

import { useEffect, useState } from "react";

import { parseDeployment, type Deployment } from "@/lib/contracts";

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
        const response = await fetch("/deployments.json", { cache: "no-store" });
        if (response.ok) {
          const parsed = parseDeployment(await response.json());
          if (!cancelled) setState({ status: "ready", deployment: parsed, error: null });
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
  if (process.env.NEXT_PUBLIC_NETWORK !== "sepolia") return null;
  const hook = envAddress("NEXT_PUBLIC_HOOK");
  const swapVm = envAddress("NEXT_PUBLIC_SWAP_VM");
  const overflowRouter = envAddress("NEXT_PUBLIC_OVERFLOW_ROUTER");
  const orderBuilder = envAddress("NEXT_PUBLIC_ORDER_BUILDER");
  const token0 = envAddress("NEXT_PUBLIC_TOKEN0");
  const token1 = envAddress("NEXT_PUBLIC_TOKEN1");
  const treasury = envAddress("NEXT_PUBLIC_TREASURY");
  const usdc = envAddress("NEXT_PUBLIC_USDC");
  if (!hook || !swapVm || !overflowRouter || !orderBuilder || !token0 || !token1 || !treasury || !usdc) return null;
  const arcTreasury = envAddress("NEXT_PUBLIC_ARC_TREASURY");
  return {
    network: "sepolia",
    chainId: 1301,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.unichain.org",
    keeperUrl: process.env.NEXT_PUBLIC_KEEPER_URL || "http://127.0.0.1:8787",
    aqua: envAddress("NEXT_PUBLIC_AQUA") || "0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a",
    poolManager: envAddress("NEXT_PUBLIC_POOL_MANAGER") || "0x00B036B58a818B1BC34d502D3fE730Db729e62AC",
    swapVm,
    hook,
    overflowRouter,
    orderBuilder,
    token0,
    token1,
    symbol0: process.env.NEXT_PUBLIC_SYMBOL0 || "token0",
    symbol1: process.env.NEXT_PUBLIC_SYMBOL1 || "token1",
    fee: Number(process.env.NEXT_PUBLIC_POOL_FEE || 3000),
    tickSpacing: Number(process.env.NEXT_PUBLIC_TICK_SPACING || 60),
    treasury,
    usdc,
    maker: envAddress("NEXT_PUBLIC_MAKER") || "0x0000000000000000000000000000000000000000",
    taker: envAddress("NEXT_PUBLIC_TAKER") || "0x0000000000000000000000000000000000000000",
    deployBlock: Number(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || 0),
    poolId: (envAddress("NEXT_PUBLIC_POOL_ID") || "0x0000000000000000000000000000000000000000000000000000000000000000"),
    poolCap: process.env.NEXT_PUBLIC_POOL_CAP || "1000000000000000000",
    shipAmount: process.env.NEXT_PUBLIC_SHIP_AMOUNT || "1000000000000000000000",
    exampleSwap: process.env.NEXT_PUBLIC_EXAMPLE_SWAP || "5000000000000000000",
    strategyHash: (envAddress("NEXT_PUBLIC_STRATEGY_HASH") ||
      "0x0000000000000000000000000000000000000000000000000000000000000000"),
    settlement: "cctp",
    arcChainId: arcTreasury ? 5_042_002 : undefined,
    arcTreasury: arcTreasury || undefined,
    explorer: "https://sepolia.uniscan.xyz",
  };
}
