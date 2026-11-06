import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rebates",
  description: "Protocol-funded USDC rebates for makers on attested overflow fills, and how to claim them.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
