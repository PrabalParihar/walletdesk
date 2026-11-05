import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DocsPage() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>How the fill is split</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[14px] leading-relaxed text-[#5D5D66]">
          <p>A maker ships a DeskBand strategy on the Aqua registry. Tokens stay in the wallet. Aqua records a virtual balance.</p>
          <p>
            A taker swaps through OverflowRouter. The router settles the full input into the Uniswap v4 PoolManager first. OverflowHook lets the pool take only the configured cap and routes the residual through WalletDeskRouter.
          </p>
          <p>
            WalletDeskRouter is a modified SwapVM. It still calls Aqua pull and push. The opcode is DeskBand, an inventory-weighted linear band with optional time decay and a fee, not XYCConcentrate.
          </p>
          <p>
            The fee stays in the maker output that was not pulled. On Unichain Sepolia, CctpFeeBridge burns 6-decimal USDC toward Arc domain 26.
            A local fork cannot be attested by Iris, so the keeper calls creditFromFill on a treasury deployed beside the fork. The maker claims either way.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Where to read the code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-[13px]">
          <p>README.md maps the Uniswap and Aqua lines.</p>
          <p>docs/architecture.md is the diagram. docs/ORACLE.md says why the pool spot is not the default quote.</p>
          <p>docs/CCTP.md and docs/WALKTHROUGH.md cover settlement and the demo beats.</p>
          <p>FEEDBACK.md is the Uniswap note. AI.md lists assisted files.</p>
        </CardContent>
      </Card>
    </div>
  );
}
