"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { aquaAbi, builderAbi, erc20Abi, hookAbi, poolKey, shortError } from "@/lib/contracts";
import { encodeProgram, priceToX18, programHash, STORAGE_KEY, type DeskDraft } from "@/lib/desk";
import { useDeployment } from "@/lib/use-deployment";

const defaults = {
  amount: "1000",
  priceLow: "0.99",
  priceHigh: "1.01",
  feeBps: "30",
  halfLife: "0",
  maxDeviationBps: "100",
};

function safeUnits(value: string, decimals: number): bigint {
  try {
    return parseUnits(value.trim(), decimals);
  } catch {
    return 0n;
  }
}

export default function DeskPage() {
  const state = useDeployment();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [form, setForm] = useState(defaults);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ hash: string; strategy: `0x${string}` } | null>(null);

  function set<K extends keyof typeof defaults>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function ship() {
    if (state.status !== "ready" || !address || !client) {
      setError("Connect a wallet on the demo chain first.");
      return;
    }
    const deployment = state.deployment;
    const priceLow = priceToX18(form.priceLow, deployment.decimals0, deployment.decimals1);
    const priceHigh = priceToX18(form.priceHigh, deployment.decimals0, deployment.decimals1);
    const feeBps = Number(form.feeBps);
    const halfLife = Number(form.halfLife);
    const maxDeviationBps = Number(form.maxDeviationBps);
    const shelf0 = safeUnits(form.amount, deployment.decimals0);
    const shelf1 = safeUnits(form.amount, deployment.decimals1);
    if (priceLow === 0n || priceHigh < priceLow) {
      setError("Set a price band with a positive low and a high at or above it.");
      return;
    }
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
      setError("Fee bps must be an integer from 0 to 10000.");
      return;
    }
    if (!Number.isInteger(halfLife) || halfLife < 0) {
      setError("Half life must be a whole number of seconds, or 0 to skip decay.");
      return;
    }
    if (!Number.isInteger(maxDeviationBps) || maxDeviationBps < 1 || maxDeviationBps > 10_000) {
      setError("Max deviation must be an integer from 1 to 10000 bps.");
      return;
    }
    if (shelf0 === 0n || shelf1 === 0n) {
      setError("Shelf amount must be greater than zero.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (chainId !== deployment.chainId) {
        setStatus("Switching network");
        await switchChainAsync({ chainId: deployment.chainId });
      }
      const block = await client.getBlock();
      const start = Number(block.timestamp);
      for (const [token, shelf] of [
        [deployment.token0, shelf0],
        [deployment.token1, shelf1],
      ] as const) {
        const allowance = await client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, deployment.aqua],
        });
        if (allowance < shelf) {
          setStatus(`Approving ${token === deployment.token0 ? deployment.symbol0 : deployment.symbol1}`);
          const hash = await writeContractAsync({
            address: token,
            abi: erc20Abi,
            functionName: "approve",
            args: [deployment.aqua, shelf],
            chainId: deployment.chainId,
          });
          await client.waitForTransactionReceipt({ hash });
        }
      }

      setStatus("Packing the DeskBand program");
      const built = await client.readContract({
        address: deployment.orderBuilder,
        abi: builderAbi,
        functionName: "buildBand",
        args: [address, priceLow, priceHigh, feeBps, start, halfLife],
      });
      const traits = built[0];
      const data = built[1];
      const strategy = built[2];

      setStatus("Shipping to Aqua");
      const shipHash = await writeContractAsync({
        address: deployment.aqua,
        abi: aquaAbi,
        functionName: "ship",
        args: [deployment.swapVm, strategy, [deployment.token0, deployment.token1], [shelf0, shelf1]],
        chainId: deployment.chainId,
      });
      await client.waitForTransactionReceipt({ hash: shipHash });

      setStatus("Registering the desk on the hook");
      const registerHash = await writeContractAsync({
        address: deployment.hook,
        abi: hookAbi,
        functionName: "registerDesk",
        args: [poolKey(deployment), { maker: address, traits, data }, maxDeviationBps],
        chainId: deployment.chainId,
      });
      await client.waitForTransactionReceipt({ hash: registerHash });

      const draft: DeskDraft = {
        symbolIn: deployment.symbol0,
        symbolOut: deployment.symbol1,
        amount: form.amount,
        priceLow: form.priceLow,
        priceHigh: form.priceHigh,
        feeBps: form.feeBps,
        halfLife: form.halfLife,
        maxDeviationBps: form.maxDeviationBps,
        swapSize: "5",
        program: encodeProgram({ priceLow, priceHigh, feeBps, start, halfLife }),
        programHash: programHash(strategy),
        savedAt: Date.now(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      setResult({ hash: registerHash, strategy });
      setStatus(null);
    } catch (caught) {
      setStatus(null);
      setError(shortError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <CardHeader>
          <CardTitle>Ship a desk</CardTitle>
          <p className="text-[13px] text-[#5D5D66]">
            Approve the Aqua registry, ship a DeskBand strategy, and register it on OverflowHook. Shipping does not move tokens. Prices are{" "}
            {state.status === "ready" ? `${state.deployment.symbol1} per ${state.deployment.symbol0}` : "token1 per token0"}. The desk is
            skipped whenever its quote is further than the max deviation from the pool spot or the Chainlink CRE reference.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          {state.status === "loading" ? <Notice tone="info">Loading the deployment…</Notice> : null}
          {state.status === "missing" ? (
            <Notice tone="info">
              No deployment yet. From the repo root run <span className="font-mono">./script/demo.sh</span>. For Unichain Sepolia, set{" "}
              <span className="font-mono">NEXT_PUBLIC_NETWORK=sepolia</span> and the contract addresses in{" "}
              <span className="font-mono">apps/web/.env.local</span> after you broadcast the deploy script.
            </Notice>
          ) : null}
          {state.status === "error" ? <Notice tone="error">{state.error}</Notice> : null}
          {state.status === "ready" ? (
            <Notice tone="info">
              Pair {state.deployment.symbol0}/{state.deployment.symbol1} on chain {state.deployment.chainId}. Seeded maker{" "}
              <span className="font-mono">{state.deployment.maker}</span>.
            </Notice>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shelf amount" value={form.amount} onChange={(value) => set("amount", value)} />
            <Field label="Max deviation, bps" value={form.maxDeviationBps} onChange={(value) => set("maxDeviationBps", value)} />
            <Field label="Price low" value={form.priceLow} onChange={(value) => set("priceLow", value)} />
            <Field label="Price high" value={form.priceHigh} onChange={(value) => set("priceHigh", value)} />
            <Field label="Fee bps" value={form.feeBps} onChange={(value) => set("feeBps", value)} />
            <Field label="Decay half life, seconds (0 = off)" value={form.halfLife} onChange={(value) => set("halfLife", value)} />
          </div>
          {status ? <Notice tone="info">{status}…</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void ship()} disabled={busy || !isConnected || state.status !== "ready"}>
              {busy ? "Working" : isConnected ? "Approve and ship" : "Connect a wallet"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-[#F2F2F3] shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Program</CardTitle>
            <Badge variant="secondary">{result ? "shipped" : "waiting"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          <Row label="Wallet movement" value="None on ship" />
          <Row label="Registry" value={state.status === "ready" ? state.deployment.aqua : "Aqua"} />
          <div>
            <p className="text-[#5D5D66]">Strategy bytes</p>
            <p className="mt-1 break-all font-mono text-xs">{result?.strategy ?? "Ship to write the order Aqua stores."}</p>
          </div>
          <div>
            <p className="text-[#5D5D66]">Register transaction</p>
            <p className="mt-1 break-all font-mono text-xs">{result?.hash ?? "No transaction yet."}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-[12px] text-[#5D5D66]">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[#5D5D66]">{label}</span>
      <span className="max-w-[16rem] truncate text-right font-mono text-xs">{value}</span>
    </div>
  );
}
