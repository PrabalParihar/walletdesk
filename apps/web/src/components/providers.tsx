"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { http, createConfig, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { unichain, unichainSepolia } from "viem/chains";

import { arcTestnet } from "@/lib/chains";

const config = createConfig({
  chains: [unichain, unichainSepolia, arcTestnet],
  connectors: [injected()],
  ssr: true,
  transports: {
    [unichain.id]: http("https://mainnet.unichain.org"),
    [unichainSepolia.id]: http("https://sepolia.unichain.org"),
    [arcTestnet.id]: http("https://rpc.testnet.arc.io"),
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
