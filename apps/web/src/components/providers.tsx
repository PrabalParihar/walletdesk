"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { http, createConfig, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { unichain, unichainSepolia } from "viem/chains";

import { arcTestnet, networkMode, unichainFork } from "@/lib/chains";

const mode = networkMode;
const unichainRpc = process.env.NEXT_PUBLIC_RPC_URL || "https://mainnet.unichain.org";
const forkRpc = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
const sepoliaRpc = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.unichain.org";
const arcRpc = process.env.NEXT_PUBLIC_ARC_RPC || "https://rpc.testnet.arc.io";

const config =
  mode === "unichain"
    ? createConfig({
        chains: [unichain],
        connectors: [injected()],
        ssr: true,
        transports: {
          [unichain.id]: http(unichainRpc),
        },
      })
    : mode === "sepolia"
    ? createConfig({
        chains: [unichainSepolia, arcTestnet],
        connectors: [injected()],
        ssr: true,
        transports: {
          [unichainSepolia.id]: http(sepoliaRpc),
          [arcTestnet.id]: http(arcRpc),
        },
      })
    : createConfig({
        chains: [unichainFork],
        connectors: [injected()],
        ssr: true,
        transports: {
          [unichainFork.id]: http(forkRpc),
        },
      });

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
