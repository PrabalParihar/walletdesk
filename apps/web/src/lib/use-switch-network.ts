"use client";

import { useCallback, useState } from "react";
import { numberToHex, type EIP1193Provider } from "viem";
import { useConfig, useConnection, useSwitchChain } from "wagmi";
import { getConnection, watchConnection } from "wagmi/actions";

import { findAppChain, rpcUrls } from "@/lib/chains";

type RpcError = { code?: number; message?: string; data?: { originalError?: { code?: number } }; cause?: unknown };

const USER_REJECTED = 4001;

function codeOf(error: unknown): number | undefined {
  const e = error as RpcError | undefined;
  return e?.code ?? e?.data?.originalError?.code ?? (e?.cause ? codeOf(e.cause) : undefined);
}

/** Readable reason for a failed switch. */
export function switchErrorMessage(error: unknown): string {
  if (codeOf(error) === USER_REJECTED) return "Network switch was rejected in the wallet.";
  const message = (error as RpcError | undefined)?.message ?? String(error);
  return message.split("\n")[0].split(". ")[0];
}

/**
 * Moves the wallet to a chain this app knows. If the wallet has never seen the chain
 * (MetaMask answers 4902, or a generic -32603 on some versions), it adds it first with
 * our RPC and explorer, then switches. Resolves once wagmi sees the new chain.
 */
export function useSwitchNetwork() {
  const config = useConfig();
  const { connector, chainId: walletChainId } = useConnection();
  const { switchChainAsync } = useSwitchChain();
  const [pending, setPending] = useState<number | null>(null);

  const waitForChain = useCallback(
    (target: number) =>
      new Promise<void>((resolve) => {
        if (getConnection(config).chainId === target) return resolve();
        const timer = setTimeout(() => {
          unwatch();
          resolve();
        }, 8000);
        const unwatch = watchConnection(config, {
          onChange(connection) {
            if (connection.chainId === target) {
              clearTimeout(timer);
              unwatch();
              resolve();
            }
          },
        });
      }),
    [config],
  );

  const switchTo = useCallback(
    async (target: number) => {
      const chain = findAppChain(target);
      if (!chain) throw new Error(`Chain ${target} is not configured in this app.`);
      if (getConnection(config).chainId === target) return;
      setPending(target);
      try {
        // Demo/mock connectors don't speak EIP-1193 chain methods; let wagmi handle them.
        if (!connector || connector.type !== "injected") {
          await switchChainAsync({ chainId: chain.id });
          return;
        }
        const provider = (await connector.getProvider()) as EIP1193Provider;
        const hexId = numberToHex(chain.id);
        try {
          await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
        } catch (error) {
          if (codeOf(error) === USER_REJECTED) throw error;
          const explorer = chain.blockExplorers?.default.url;
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hexId,
                chainName: chain.name,
                nativeCurrency: chain.nativeCurrency,
                rpcUrls: [rpcUrls[chain.id] ?? chain.rpcUrls.default.http[0]],
                blockExplorerUrls: explorer ? [explorer] : undefined,
              },
            ],
          });
          // MetaMask usually switches as part of adding; others need an explicit ask.
          const now = Number(await provider.request({ method: "eth_chainId" }));
          if (now !== chain.id) {
            await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
          }
        }
        await waitForChain(chain.id);
      } finally {
        setPending(null);
      }
    },
    [config, connector, switchChainAsync, waitForChain],
  );

  return { switchTo, pending, walletChainId };
}
