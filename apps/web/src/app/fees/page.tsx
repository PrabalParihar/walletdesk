import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addresses } from "@/lib/chains";

export default function FeesPage() {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Arc fees</CardTitle>
            <Badge variant="outline">USDC · 6 decimals on the ERC-20 interface</Badge>
          </div>
          <p className="max-w-2xl text-[13px] leading-relaxed text-[#5D5D66]">
            FeeShareTreasury is written for Arc Studio. Native gas on Arc is USDC with 18 decimals. Claims use the ERC-20 interface at{" "}
            <span className="font-mono">{addresses.arcUsdc}</span>, which has 6 decimals. The contract refuses native value so the two units are not mixed.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Stat label="Claimable USDC" value="Set after deploy" />
          <Stat label="Protocol split" value="0 bps until the owner sets one" />
          <Stat label="Studio project" value="Not created in this repo" />
        </CardContent>
      </Card>
      <Card className="bg-[#F2F2F3] shadow-none">
        <CardHeader>
          <CardTitle>Claim</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px] text-[#5D5D66]">
          <p>
            Connect on Arc testnet after the treasury is deployed, then claim. This shell does not invent a Studio URL or a claim transaction.
            Paste <span className="font-mono">arc/FeeShareTreasury.sol</span> into Arc Studio, deploy it, and put the address in the README.
          </p>
          <Button disabled>Claim USDC</Button>
          <p>CCTP from Unichain to Arc is documented as follow-up work. The hackathon path is an attestor calling creditFromFill.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-black/8 bg-white p-3">
      <p className="text-[12px] text-[#5D5D66]">{label}</p>
      <p className="mt-1 text-[14px]">{value}</p>
    </div>
  );
}
