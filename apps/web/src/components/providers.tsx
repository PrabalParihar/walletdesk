"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { http, createConfig, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { appChains, rpcUrls } from "@/lib/chains";

const config = createConfig({
  chains: appChains,
  connectors: [injected()],
  ssr: true,
  transports: Object.fromEntries(appChains.map((chain) => [chain.id, http(rpcUrls[chain.id])])) as Record<
    (typeof appChains)[number]["id"],
    ReturnType<typeof http>
  >,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
