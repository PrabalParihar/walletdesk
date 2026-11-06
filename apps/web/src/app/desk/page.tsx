"use client";

import { useId, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useChainId, useConnect, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { aquaAbi, builderAbi, erc20Abi, hookAbi, poolKey, shortError } from "@/lib/contracts";
import { Amount } from "@/components/amount";
import { CopyButton } from "@/components/copy-button";
import { MintTestTokens } from "@/components/mint-test-tokens";
import { ExternalLink } from "@/components/site";
import { TxSteps, useTxSteps } from "@/components/tx-steps";
import { encodeProgram, formatPriceX18, priceToX18, programHash, quoteExactIn, STORAGE_KEY, type DeskDraft } from "@/lib/desk";
import { txUrl } from "@/lib/live";
import { useDeployment } from "@/lib/use-deployment";

/** Overflow size used for the quote preview: a 5-token swap against a 1-token pool cap leaves 4 for the desk. */
const PREVIEW_RESIDUAL = "4";

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
  const { connect, connectors, isPending: connecting, error: connectError } = useConnect();
  const injected = connectors[0];
  const [form, setForm] = useState(defaults);
  const tx = useTxSteps();
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
    tx.reset();
    try {
      if (chainId !== deployment.chainId) {
        tx.start("Switch network");
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
          tx.start(`Approve ${token === deployment.token0 ? deployment.symbol0 : deployment.symbol1} for Aqua (allowance only, no transfer)`);
          const hash = await writeContractAsync({
            address: token,
            abi: erc20Abi,
            functionName: "approve",
            args: [deployment.aqua, shelf],
            chainId: deployment.chainId,
          });
          tx.sent(hash);
          await client.waitForTransactionReceipt({ hash });
        }
      }

      tx.start("Pack the DeskBand program (read only)");
      const built = await client.readContract({
        address: deployment.orderBuilder,
        abi: builderAbi,
        functionName: "buildBand",
        args: [address, priceLow, priceHigh, feeBps, start, halfLife],
      });
      const traits = built[0];
      const data = built[1];
      const strategy = built[2];

      tx.start("Ship the strategy to Aqua (virtual balances, no transfer)");
      const shipHash = await writeContractAsync({
        address: deployment.aqua,
        abi: aquaAbi,
        functionName: "ship",
        args: [deployment.swapVm, strategy, [deployment.token0, deployment.token1], [shelf0, shelf1]],
        chainId: deployment.chainId,
      });
      tx.sent(shipHash);
      await client.waitForTransactionReceipt({ hash: shipHash });

      tx.start("Register the desk on OverflowHook");
      const registerHash = await writeContractAsync({
        address: deployment.hook,
        abi: hookAbi,
        functionName: "registerDesk",
        args: [poolKey(deployment), { maker: address, traits, data }, maxDeviationBps],
        chainId: deployment.chainId,
      });
      tx.sent(registerHash);
      await client.waitForTransactionReceipt({ hash: registerHash });
      tx.finish();

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
    } catch (caught) {
      tx.fail();
      setError(shortError(caught));
    } finally {
      setBusy(false);
    }
  }

  const d0 = state.status === "ready" ? state.deployment.decimals0 : 18;
  const d1 = state.status === "ready" ? state.deployment.decimals1 : 18;
  const sym0 = state.status === "ready" ? state.deployment.symbol0 : "token0";
  const sym1 = state.status === "ready" ? state.deployment.symbol1 : "token1";
  const preview = (() => {
    const shelf0 = safeUnits(form.amount, d0);
    const shelf1 = safeUnits(form.amount, d1);
    const amountIn = safeUnits(PREVIEW_RESIDUAL, d0);
    const low = priceToX18(form.priceLow, d0, d1);
    const high = priceToX18(form.priceHigh, d0, d1);
    const feeBps = BigInt(Number.isInteger(Number(form.feeBps)) ? Number(form.feeBps) : 0);
    if (shelf0 === 0n || shelf1 === 0n || low === 0n || high < low) return null;
    return quoteExactIn({
      balanceIn: shelf0,
      balanceOut: shelf1,
      amountIn,
      zeroForOne: true,
      priceLow: low,
      priceHigh: high,
      feeBps,
      start: 0n,
      halfLife: 0n,
      timestamp: 0n,
    });
  })();

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[14px] border border-line bg-raised p-5 md:p-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">Make a desk</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-body">
          A desk is a quote that lives in your wallet. You pick a price band and a fee, ship it as a DeskBand strategy on 1inch Aqua, and
          register it on the hook. Your tokens never leave the wallet until a swap fills against your desk.
        </p>
        {state.status === "ready" ? (
          <div className="mt-4">
            <MintTestTokens deployment={state.deployment} which="both" amount="1000" />
          </div>
        ) : null}
      </section>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card className="shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <CardHeader>
          <CardTitle>Ship a desk</CardTitle>
          <p className="text-[13px] text-muted-ink">
            Approve the Aqua registry, ship a DeskBand strategy, and register it on OverflowHook. Shipping does not move tokens. Prices are{" "}
            {state.status === "ready" ? `${state.deployment.symbol1} per ${state.deployment.symbol0}` : "token1 per token0"}. The desk is
            skipped whenever its quote is further than the max deviation from the pool spot or the Chainlink CRE reference.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          {state.status === "loading" ? <Notice tone="info">Loading the deployment…</Notice> : null}
          {state.status === "missing" ? (
            <Notice tone="info">
              No local deployment yet. From the repo root run <span className="font-mono">./script/demo.sh</span>, or run the app without{" "}
              <span className="font-mono">NEXT_PUBLIC_NETWORK</span> to use the live Unichain Sepolia deployment.
            </Notice>
          ) : null}
          {state.status === "error" ? <Notice tone="error">{state.error}</Notice> : null}
          {state.status === "ready" ? (
            <Notice tone="info">
              Pair {state.deployment.symbol0}/{state.deployment.symbol1} on chain {state.deployment.chainId}. Connect a wallet on this chain;
              it becomes the maker.
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
          <TxSteps steps={tx.steps} explorer={state.status === "ready" ? state.deployment.explorer : undefined} />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            {isConnected ? (
              <Button type="button" onClick={() => void ship()} disabled={busy || state.status !== "ready"}>
                {busy ? "Shipping…" : "Approve and ship"}
              </Button>
            ) : (
              // A disabled "Connect" button looks clickable and does nothing; this one connects.
              <Button type="button" variant="outline" disabled={!injected || connecting} onClick={() => injected && connect({ connector: injected })}>
                {injected ? "Connect a wallet to ship" : "No browser wallet found"}
              </Button>
            )}
            {!isConnected && connectError ? (
              <Notice tone="error">
                Could not connect a wallet ({connectError.message.split(".")[0]}). Install a browser wallet on Unichain Sepolia, or run the local
                demo with ./script/demo.sh.
              </Notice>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <div className="grid content-start gap-6">
      <Card className="border-desk/15 bg-solution shadow-none">
        <CardHeader>
          <CardTitle>Quote preview</CardTitle>
          <p className="text-[13px] text-muted-ink">
            What this desk would pay for a {PREVIEW_RESIDUAL} {sym0} overflow, with equal shelves. Same math as the on-chain DeskBand opcode.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          {preview && !("error" in preview) ? (
            <>
              <p className="text-[28px] font-semibold tracking-tight tabular-nums">
                <Amount value={Number(formatUnits(preview.amountOut, d1))} /> {sym1}
              </p>
              <Row label="Band price now" value={`${formatPriceX18(preview.priceX18, d0, d1)} ${sym1} per ${sym0}`} />
              <Row label="Your spread (kept in wallet)" value={`${formatPriceX18((preview.feeOut * 10n ** 18n) / 10n ** BigInt(d1), 18, 18, 6)} ${sym1}`} />
              <p className="text-[12px] leading-relaxed text-muted-ink">
                As your {sym1} shelf drains, the price slides toward the low end of the band, so the quote gets worse for takers on the side
                you are running out of.
              </p>
            </>
          ) : (
            <p className="text-muted-ink">{preview && "error" in preview ? preview.error : "Set a shelf amount and a valid band."}</p>
          )}
        </CardContent>
      </Card>
      <Card className="bg-sunken shadow-none">
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
            <p className="flex items-center gap-1 text-muted-ink">
              Strategy bytes {result ? <CopyButton value={result.strategy} label="strategy bytes" /> : null}
            </p>
            <p className="mt-1 break-all font-mono text-xs">{result?.strategy ?? "Ship to write the order Aqua stores."}</p>
          </div>
          <div>
            <p className="text-muted-ink">Register transaction</p>
            <p className="mt-1 break-all font-mono text-xs">
              {result ? (
                txUrl(state.status === "ready" ? state.deployment.explorer : undefined, result.hash) ? (
                  <ExternalLink href={txUrl(state.status === "ready" ? state.deployment.explorer : undefined, result.hash)}>
                    {result.hash}
                  </ExternalLink>
                ) : (
                  result.hash
                )
              ) : (
                "No transaction yet."
              )}
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[12px] text-muted-ink">
        {label}
      </Label>
      <Input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-ink">{label}</span>
      <span className="max-w-[16rem] truncate text-right font-mono text-xs">{value}</span>
    </div>
  );
}
