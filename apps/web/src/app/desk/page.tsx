"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addresses } from "@/lib/chains";
import { STORAGE_KEY, encodeProgram, parseUnits18, programHash, type DeskDraft } from "@/lib/desk";

const defaults = {
  symbolIn: "DA",
  symbolOut: "DB",
  amount: "1000",
  priceLow: "0.99",
  priceHigh: "1.01",
  feeBps: "30",
  halfLife: "0",
  poolCap: "1",
  swapSize: "5",
};

export default function DeskPage() {
  const [form, setForm] = useState(defaults);
  const [saved, setSaved] = useState<DeskDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof defaults>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function ship() {
    const priceLow = parseUnits18(form.priceLow);
    const priceHigh = parseUnits18(form.priceHigh);
    const feeBps = Number(form.feeBps);
    const halfLife = Number(form.halfLife);
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
    const program = encodeProgram({
      priceLow,
      priceHigh,
      feeBps,
      start: Math.floor(Date.now() / 1000),
      halfLife,
    });
    const draft: DeskDraft = {
      ...form,
      program,
      programHash: programHash(program),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setSaved(draft);
    setError(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <CardHeader>
          <CardTitle>Ship a desk</CardTitle>
          <p className="text-[13px] text-[#5D5D66]">
            This preview packs the DeskBand program the router runs. Shipping on Aqua does not move tokens. The fork test is the onchain proof.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Token in symbol" value={form.symbolIn} onChange={(v) => set("symbolIn", v)} />
            <Field label="Token out symbol" value={form.symbolOut} onChange={(v) => set("symbolOut", v)} />
            <Field label="Shelf amount (18 decimals)" value={form.amount} onChange={(v) => set("amount", v)} />
            <Field label="Pool cap, input units" value={form.poolCap} onChange={(v) => set("poolCap", v)} />
            <Field label="Price low" value={form.priceLow} onChange={(v) => set("priceLow", v)} />
            <Field label="Price high" value={form.priceHigh} onChange={(v) => set("priceHigh", v)} />
            <Field label="Fee bps" value={form.feeBps} onChange={(v) => set("feeBps", v)} />
            <Field label="Half life, seconds" value={form.halfLife} onChange={(v) => set("halfLife", v)} />
          </div>
          {error ? <p className="text-[13px] text-[#E11D48]">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled>
              Approve Aqua
            </Button>
            <Button type="button" onClick={ship}>
              Build program
            </Button>
          </div>
          <p className="text-[12px] leading-relaxed text-[#5D5D66]">
            Approve is disabled here because this shell has no deployed desk. On a chain, the maker approves the Aqua registry{" "}
            <span className="font-mono">{addresses.aqua}</span>, then calls ship. Wallet balances stay put.
          </p>
        </CardContent>
      </Card>
      <Card className="bg-[#F2F2F3] shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Program</CardTitle>
            <Badge variant="secondary">{saved ? "saved locally" : "empty"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          <Row label="Virtual in" value={saved ? `${saved.amount} ${saved.symbolIn}` : "Not shipped"} />
          <Row label="Virtual out" value={saved ? `${saved.amount} ${saved.symbolOut}` : "Not shipped"} />
          <Row label="Wallet movement" value="None on ship" />
          <div>
            <p className="text-[#5D5D66]">Program hash</p>
            <p className="mt-1 break-all font-mono text-xs">{saved?.programHash ?? "Build a program to hash the bytecode."}</p>
          </div>
          <div>
            <p className="text-[#5D5D66]">Bytes</p>
            <p className="mt-1 break-all font-mono text-xs">{saved?.program ?? "Opcode 0, then 74 argument bytes."}</p>
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
      <span className="text-right">{value}</span>
    </div>
  );
}
