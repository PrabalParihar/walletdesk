import { defineChain } from "viem";
import { unichain, unichainSepolia } from "viem/chains";

export const unichainFork = defineChain({
  id: 130,
  name: "Unichain fork",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545"] } },
});

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } },
  blockExplorers: { default: { name: "Arcscan", url: "https://explorer.testnet.arc.io" } },
});

export const chains = [unichainFork, unichain, unichainSepolia, arcTestnet] as const;

export type NetworkMode = "fork" | "sepolia" | "unichain";
const requested = process.env.NEXT_PUBLIC_NETWORK;
/** Default is the live Unichain Sepolia deployment, so the app works with no local chain. demo.sh sets "fork". */
export const networkMode: NetworkMode = requested === "fork" || requested === "unichain" ? requested : "sepolia";

/** RPC each chain is read through and offered to wallets that don't know the chain yet. */
export const rpcUrls: Record<number, string> = {
  [unichainFork.id]: process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545",
  [unichainSepolia.id]: process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.unichain.org",
  [arcTestnet.id]: process.env.NEXT_PUBLIC_ARC_RPC || "https://rpc.testnet.arc.io",
};
if (networkMode === "unichain") rpcUrls[unichain.id] = process.env.NEXT_PUBLIC_RPC_URL || "https://mainnet.unichain.org";

/** Chains this build talks to, in switcher order. */
export const appChains =
  networkMode === "unichain"
    ? ([unichain] as const)
    : networkMode === "sepolia"
      ? ([unichainSepolia, arcTestnet] as const)
      : ([unichainFork] as const);

export type AppChain = (typeof appChains)[number];

export const findAppChain = (id: number | undefined) => appChains.find((chain) => chain.id === id);

export const networkLabel: Record<NetworkMode, string> = {
  fork: "Unichain fork",
  sepolia: "Unichain Sepolia",
  unichain: "Unichain",
};

export const addresses = {
  aqua: "0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a" as const,
  canonicalSwapVm: "0x111111338c5091E8440b67B168bAe16a668AC0De" as const,
  unichainPoolManager: "0x1F98400000000000000000000000000000000004" as const,
  arcUsdc: "0x3600000000000000000000000000000000000000" as const,
};
