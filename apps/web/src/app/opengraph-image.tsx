import { ImageResponse } from "next/og";

export const alt = "WalletDesk: one swap of 5 DA, 1 filled by the Uniswap pool and 4 by a maker's wallet through 1inch Aqua";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview a judge sees when the URL is pasted into ETHGlobal, Discord or X. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#18181B", color: "#FFFFFF" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", gap: 6, padding: 10, borderRadius: 14, background: "#27272A" }}>
            <div style={{ width: 16, height: 32, borderRadius: 4, background: "#FF3D9A" }} />
            <div style={{ width: 32, height: 32, borderRadius: 4, background: "#3D8BFF" }} />
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5 }}>WalletDesk</div>
          <div style={{ marginLeft: "auto", fontSize: 22, color: "#7CB4FF" }}>Live on Unichain Sepolia</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 980 }}>
            Wallets back Uniswap pools without depositing.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", height: 64, borderRadius: 14, overflow: "hidden", fontSize: 26, fontWeight: 600 }}>
              <div style={{ width: "20%", display: "flex", alignItems: "center", justifyContent: "center", background: "#D6006F" }}>1 DA pool</div>
              <div style={{ width: "80%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0066FA" }}>4 DA from a maker&apos;s wallet</div>
            </div>
            <div style={{ display: "flex", fontSize: 22, color: "#A1A1AA" }}>One swap of 5 DA, one transaction, any v4 router.</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 22 }}>
          <div style={{ display: "flex", padding: "8px 18px", borderRadius: 999, background: "rgba(255,0,122,0.18)", color: "#FF8CC3" }}>Uniswap v4 hook</div>
          <div style={{ display: "flex", padding: "8px 18px", borderRadius: 999, background: "rgba(0,102,250,0.22)", color: "#9CC3FF" }}>1inch Aqua · SwapVM</div>
          <div style={{ display: "flex", padding: "8px 18px", borderRadius: 999, background: "rgba(55,91,210,0.28)", color: "#B4C3F5" }}>Chainlink CRE</div>
        </div>
      </div>
    ),
    size,
  );
}
