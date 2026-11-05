import { defineChain } from "viem";
import { unichain, unichainSepolia } from "viem/chains";

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } },
  blockExplorers: { default: { name: "Arcscan", url: "https://explorer.testnet.arc.io" } },
});

export const chains = [unichain, unichainSepolia, arcTestnet] as const;

export const addresses = {
  aqua: "0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a" as const,
  canonicalSwapVm: "0x111111338c5091E8440b67B168bAe16a668AC0De" as const,
  unichainPoolManager: "0x1F98400000000000000000000000000000000004" as const,
  arcUsdc: "0x3600000000000000000000000000000000000000" as const,
};
