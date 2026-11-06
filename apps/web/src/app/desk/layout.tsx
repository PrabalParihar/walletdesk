import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Make a desk",
  description: "Ship a DeskBand strategy on 1inch Aqua and register it on the hook. Your tokens stay in your wallet until a swap fills against your desk.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
