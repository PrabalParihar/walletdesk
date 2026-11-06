import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live overflow",
  description: "Maker balances, the Chainlink CRE price guard and the last overflow fill, read from the Unichain Sepolia contracts. Run an overflow swap yourself.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
