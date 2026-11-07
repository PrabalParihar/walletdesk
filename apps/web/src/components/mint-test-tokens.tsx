"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import { Button } from "@/components/ui/button";
import { mockTokenAbi, shortError, type Deployment } from "@/lib/contracts";
import { useSwitchNetwork } from "@/lib/use-switch-network";

/**
 * The demo pool's tokens are public-mint mocks with no value, so a judge can mint some and try the desk themselves.
 * Gas on Unichain Sepolia still needs a little testnet ETH.
 */
export function MintTestTokens({
  deployment,
  which,
  amount = "100",
}: {
  deployment: Deployment;
  which: "token0" | "both";
  amount?: string;
}) {
  const { address, isConnected } = useAccount();
  const { switchTo, walletChainId } = useSwitchNetwork();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<{ busy: boolean; note: string | null; error: string | null }>({
    busy: false,
    note: null,
    error: null,
  });

  async function mint() {
    if (!address || !client) return;
    setState({ busy: true, note: null, error: null });
    try {
      if (walletChainId !== deployment.chainId) await switchTo(deployment.chainId);
      const targets =
        which === "both"
          ? [
              { token: deployment.token0, symbol: deployment.symbol0, decimals: deployment.decimals0 },
              { token: deployment.token1, symbol: deployment.symbol1, decimals: deployment.decimals1 },
            ]
          : [{ token: deployment.token0, symbol: deployment.symbol0, decimals: deployment.decimals0 }];
      for (const t of targets) {
        setState({ busy: true, note: `Minting ${amount} ${t.symbol}`, error: null });
        const hash = await writeContractAsync({
          address: t.token,
          abi: mockTokenAbi,
          functionName: "mint",
          args: [address, parseUnits(amount, t.decimals)],
          chainId: deployment.chainId,
        });
        await client.waitForTransactionReceipt({ hash });
      }
      setState({ busy: false, note: `Minted ${amount} ${targets.map((t) => t.symbol).join(" and ")} to your wallet.`, error: null });
    } catch (caught) {
      setState({ busy: false, note: null, error: shortError(caught) });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-ink">
      <Button type="button" size="sm" variant="outline" disabled={!isConnected || state.busy} onClick={() => void mint()}>
        {state.busy ? "Minting…" : `Get ${amount} test ${which === "both" ? `${deployment.symbol0} + ${deployment.symbol1}` : deployment.symbol0}`}
      </Button>
      <span>{state.error ?? state.note ?? (isConnected ? "Demo tokens have no value." : "Connect a wallet first.")}</span>
    </div>
  );
}
