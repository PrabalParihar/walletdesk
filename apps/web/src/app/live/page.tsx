"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  STORAGE_KEY,
  formatUnits18,
  parseUnits18,
  quoteExactIn,
  type DeskDraft,
} from "@/lib/desk";

type Preview = {
  poolIn: bigint;
  shelfIn: bigint;
  shelfOut: bigint;
  feeOut: bigint;
  priceX18: bigint;
};

export default function LivePage() {
  const [desk, setDesk] = useState<DeskDraft | null>(null);
  const [swapSize, setSwapSize] = useState("5");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as DeskDraft;
    setDesk(parsed);
    if (parsed.swapSize) setSwapSize(parsed.swapSize);
  }, []);

  function run() {
    if (!desk) {
      setError("Build a program on the ship screen first.");
      return;
    }
    const amount = parseUnits18(swapSize);
    const cap = parseUnits18(desk.poolCap);
    const shelf = parseUnits18(desk.amount);
    if (amount === 0n) {
      setError("Enter a swap size.");
      return;
    }
    if (cap === 0n || amount <= cap) {
      setPreview({ poolIn: amount, shelfIn: 0n, shelfOut: 0n, feeOut: 0n, priceX18: 0n });
      setError(null);
      return;
    }
    const shelfIn = amount - cap;
    const quoted = quoteExactIn({
      balanceIn: shelf,
      balanceOut: shelf,
      amountIn: shelfIn,
      priceLow: parseUnits18(desk.priceLow),
      priceHigh: parseUnits18(desk.priceHigh),
      feeBps: BigInt(desk.feeBps || "0"),
      start: BigInt(Math.floor(desk.savedAt / 1000)),
      halfLife: BigInt(desk.halfLife || "0"),
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
    });
    if ("error" in quoted) {
      setError(quoted.error);
      setPreview(null);
      return;
    }
    setPreview({ poolIn: cap, shelfIn, shelfOut: quoted.amountOut, feeOut: quoted.feeOut, priceX18: quoted.priceX18 });
    setError(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Desk status</CardTitle>
            <Badge className="bg-[#00BBFF] text-white">{desk ? "preview" : "empty"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          {desk ? (
            <>
              <p>
                {desk.symbolIn} / {desk.symbolOut} · fee {desk.feeBps} bps · half life {desk.halfLife}s
              </p>
              <div className="overflow-hidden rounded-[10px] border border-black/8">
                <table className="w-full text-left">
                  <thead className="bg-[#F2F2F3] text-[#5D5D66]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Side</th>
                      <th className="px-3 py-2 font-medium">Wallet</th>
                      <th className="px-3 py-2 font-medium">Virtual</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-black/8">
                      <td className="px-3 py-2">{desk.symbolIn}</td>
                      <td className="px-3 py-2">Unchanged by ship</td>
                      <td className="px-3 py-2">{desk.amount}</td>
                    </tr>
                    <tr className="border-t border-black/8">
                      <td className="px-3 py-2">{desk.symbolOut}</td>
                      <td className="px-3 py-2">Unchanged by ship</td>
                      <td className="px-3 py-2">{desk.amount}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="break-all font-mono text-xs text-[#5D5D66]">{desk.programHash}</p>
            </>
          ) : (
            <p className="text-[#5D5D66]">No local desk yet. Ship one, then come back to preview the split.</p>
          )}
        </CardContent>
      </Card>
      <Card className="shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <CardHeader>
          <CardTitle>Simulate overflow</CardTitle>
          <p className="text-[13px] text-[#5D5D66]">
            Local math only. The same formula is what DeskBand runs onchain. A fork test asserts the token transfers.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Swap size, input units</Label>
            <Input value={swapSize} onChange={(event) => setSwapSize(event.target.value)} />
          </div>
          <Button type="button" onClick={run}>
            Run overflow
          </Button>
          {error ? <p className="text-[13px] text-[#E11D48]">{error}</p> : null}
          {preview ? (
            <div className="overflow-hidden rounded-[10px] border border-black/8 text-[13px]">
              <table className="w-full">
                <tbody>
                  <Line label="Pool input" value={formatUnits18(preview.poolIn)} />
                  <Line label="Shelf input (Pulled side pays this in)" value={formatUnits18(preview.shelfIn)} />
                  <Line label="Shelf output (Pulled)" value={formatUnits18(preview.shelfOut)} />
                  <Line label="Fee kept on the shelf" value={formatUnits18(preview.feeOut)} />
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t border-black/8 first:border-t-0">
      <td className="px-3 py-2 text-[#5D5D66]">{label}</td>
      <td className="px-3 py-2 text-right font-mono">{value}</td>
    </tr>
  );
}
