"use client";

import { useId, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useChainId, useConnect, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
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

  const priceUnit = state.status === "ready" ? `${state.deployment.symbol1} per ${state.deployment.symbol0}` : "token1 per token0";

  const registerUrl = result ? txUrl(state.status === "ready" ? state.deployment.explorer : undefined, result.hash) : undefined;

  return (
    <div className="mx-auto flex max-w-[840px] flex-col pt-10">
      <h1 className="text-[40px] font-semibold tracking-tight">Make a desk</h1>
      <p className="mt-3 max-w-[420px] text-[16px] leading-relaxed text-body">A price band in your wallet. Tokens move only on a fill.</p>
      <p className="mt-4 font-mono text-[12px] text-muted-ink">
        {state.status === "ready" ? `${sym0}/${sym1} · ${priceUnit}` : "Prices are token1 per token0"}
        {state.status === "ready" ? <span className="ml-4"><MintTestTokens deployment={state.deployment} which="both" amount="1000" /></span> : null}
      </p>

      <div className="mt-10 overflow-hidden rounded-[14px] border border-white/[0.08] bg-raised">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-5 border-b border-white/[0.08] p-6 md:p-8 lg:border-r lg:border-b-0">
            {state.status === "loading" ? <Notice tone="info">Loading the deployment…</Notice> : null}
            {state.status === "missing" ? (
              <Notice tone="info">
                No local deployment yet. From the repo root run <span className="font-mono">./script/demo.sh</span>, or run the app without{" "}
                <span className="font-mono">NEXT_PUBLIC_NETWORK</span> to use the live Unichain Sepolia deployment.
              </Notice>
            ) : null}
            {state.status === "error" ? <Notice tone="error">{state.error}</Notice> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Shelf, each side" value={form.amount} onChange={(value) => set("amount", value)} />
              <Field label="Max deviation, bps" value={form.maxDeviationBps} onChange={(value) => set("maxDeviationBps", value)} />
              <Field label="Price low" value={form.priceLow} onChange={(value) => set("priceLow", value)} />
              <Field label="Price high" value={form.priceHigh} onChange={(value) => set("priceHigh", value)} />
              <Field label="Fee, bps" value={form.feeBps} onChange={(value) => set("feeBps", value)} />
              <Field label="Half life, seconds" hint="0 turns decay off." value={form.halfLife} onChange={(value) => set("halfLife", value)} />
            </div>
            <TxSteps steps={tx.steps} explorer={state.status === "ready" ? state.deployment.explorer : undefined} />
            {error ? <Notice tone="error">{error}</Notice> : null}
            {isConnected ? (
              <Button type="button" className="h-11 rounded-[10px]" onClick={() => void ship()} disabled={busy || state.status !== "ready"}>
                {busy ? "Shipping…" : "Approve and ship"}
              </Button>
            ) : (
              <Button type="button" className="h-11 rounded-[10px]" disabled={!injected || connecting} onClick={() => injected && connect({ connector: injected })}>
                {injected ? "Connect a wallet to ship" : "No browser wallet found"}
              </Button>
            )}
            {!isConnected && connectError ? (
              <Notice tone="error">
                Could not connect a wallet ({connectError.message.split(".")[0]}). Install a browser wallet on Unichain Sepolia, or run the local demo
                with ./script/demo.sh.
              </Notice>
            ) : null}
          </div>
          <div className="grid content-start gap-5 p-6 md:p-8">
            <p className="font-mono text-[11px] tracking-[0.08em] text-muted-ink uppercase">
              Quote for {PREVIEW_RESIDUAL} {sym0}
            </p>
            {preview && !("error" in preview) ? (
              <p className="text-[44px] leading-none font-semibold tracking-tight tabular-nums">
                <Amount value={Number(formatUnits(preview.amountOut, d1))} />
                <span className="ml-2 text-[16px] font-medium text-muted-ink">{sym1}</span>
              </p>
            ) : (
              <p className="text-[14px] text-muted-ink">{preview && "error" in preview ? preview.error : "Set a shelf and a band."}</p>
            )}
            {preview && !("error" in preview) ? (
              <div className="grid gap-2 text-[13px]">
                <Row label="Price now" value={`${formatPriceX18(preview.priceX18, d0, d1)} ${sym1}`} />
                <Row label="Spread kept" value={`${formatPriceX18((preview.feeOut * 10n ** 18n) / 10n ** BigInt(d1), 18, 18, 6)} ${sym1}`} />
              </div>
            ) : null}
            <div className="grid gap-2 border-t border-white/[0.08] pt-4 text-[13px]">
              <Row label="On ship" value="Nothing moves" />
              <div>
                <p className="flex items-center gap-1 text-muted-ink">
                  Strategy {result ? <CopyButton value={result.strategy} label="strategy bytes" /> : null}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-ink">{result?.strategy ?? "Ships with the desk."}</p>
              </div>
              <div>
                <p className="text-muted-ink">Register</p>
                <p className="mt-1 break-all font-mono text-[11px]">
                  {result ? registerUrl ? <ExternalLink href={registerUrl}>Transaction</ExternalLink> : result.hash : "None yet."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[12px] font-medium text-muted-ink">
        {label}
      </Label>
      <Input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} className="font-mono" />
      {hint ? <p className="text-[12px] leading-snug text-muted-ink">{hint}</p> : null}
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
