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
            A taker swaps through any Uniswap v4 router. When the input is above the pool cap, OverflowHook lets the pool take the cap and
            fills the residual from the best registered desk through WalletDeskRouter. The hook advances the residual from PoolManager
            reserves inside flash accounting; the swap caller is charged for it, so the transaction reverts unless the router settles.
          </p>
          <p>
            WalletDeskRouter is a modified SwapVM (Powered by SwapVM). It still calls Aqua pull and push. The opcode is DeskBand: a
            value-weighted linear price band in the Uniswap price unit (token1 per token0), optional hyperbolic decay, and a fee.
          </p>
          <p>
            Every fill passes a price guard: the desk quote must sit within the maker&apos;s max deviation of the pool spot and of a fresh
            Chainlink CRE reference price. Unfunded wallets, failing fills, and stale references are skipped, never reverted. The pool
            then fills the whole swap.
          </p>
          <p>
            The maker&apos;s spread stays in the wallet. A separate, protocol-funded USDC rebate can be credited per fill on FeeShareTreasury
            and bridged to Arc with Circle CCTP V2.
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
          <p>docs/CRE.md is the Chainlink workflow. docs/CCTP.md and docs/WALKTHROUGH.md cover rebates and the demo beats.</p>
          <p>FEEDBACK.md is the Uniswap note. AI.md lists assisted files.</p>
        </CardContent>
      </Card>
    </div>
  );
}
