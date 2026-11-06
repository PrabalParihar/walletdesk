import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";

import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import { themeInitScript } from "@/components/theme-toggle";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const description =
  "A Uniswap v4 hook that fills the overflow of large swaps from market makers' wallets through 1inch Aqua, at a price checked by Chainlink CRE. Live on Unichain Sepolia.";

/** Absolute base for the Open Graph image. Set NEXT_PUBLIC_SITE_URL when hosting; Vercel's own URL is used otherwise. */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:43127");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "WalletDesk: wallets back Uniswap pools without depositing", template: "%s · WalletDesk" },
  description,
  applicationName: "WalletDesk",
  openGraph: { type: "website", siteName: "WalletDesk", title: "WalletDesk", description },
  twitter: { card: "summary_large_image", title: "WalletDesk", description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the theme class before first paint, so the page never flashes the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
