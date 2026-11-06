import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function ExternalLink({
  href,
  children,
  className,
}: {
  href: string | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-0.5 text-[#0066FA] underline-offset-2 hover:underline", className)}
    >
      {children}
      <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
    </a>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-semibold tracking-wide text-[#0066FA] uppercase">{children}</p>;
}

export function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance md:text-[28px]">{title}</h2>
      {lead ? <p className="mt-3 text-[15px] leading-relaxed text-[#5D5D66]">{lead}</p> : null}
    </div>
  );
}

export function InfoCard({
  tag,
  title,
  children,
  tone = "plain",
}: {
  tag?: string;
  title: string;
  children: React.ReactNode;
  tone?: "plain" | "problem" | "solution";
}) {
  return (
    <article
      className={cn(
        "rounded-[12px] border p-5",
        tone === "problem" && "border-[#E11D48]/15 bg-[#FFF7F8]",
        tone === "solution" && "border-[#0066FA]/15 bg-[#F5F9FF]",
        tone === "plain" && "border-black/8 bg-white",
      )}
    >
      {tag ? (
        <p
          className={cn(
            "mb-2 text-[11px] font-semibold tracking-wide uppercase",
            tone === "problem" ? "text-[#BE123C]" : "text-[#0066FA]",
          )}
        >
          {tag}
        </p>
      ) : null}
      <h3 className="text-[16px] font-semibold">{title}</h3>
      <div className="mt-2 text-[14px] leading-relaxed text-[#4A4A52]">{children}</div>
    </article>
  );
}

export function StatLink({ value, label, href, internal }: { value: string; label: string; href?: string; internal?: boolean }) {
  const body = (
    <>
      <p className="text-[26px] font-semibold tracking-tight text-[#18181B]">{value}</p>
      <p className="mt-1 text-[13px] leading-snug text-[#5D5D66]">{label}</p>
      {href ? <ArrowUpRight className="absolute top-4 right-4 size-4 text-[#0066FA]" aria-hidden /> : null}
    </>
  );
  const cls = "relative block rounded-[12px] border border-black/8 bg-white p-4 transition-colors hover:border-[#0066FA]/40";
  if (!href) return <div className={cls}>{body}</div>;
  if (internal) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  );
}

/** How one exact-input swap is split between the Uniswap pool (up to the cap) and a maker desk (the residual). */
export function SplitBar({
  total,
  poolPart,
  symbol,
  caption,
}: {
  total: number;
  poolPart: number;
  symbol: string;
  caption?: string;
}) {
  const deskPart = Math.max(total - poolPart, 0);
  const poolPct = total > 0 ? Math.min(100, Math.max(0, (poolPart / total) * 100)) : 0;
  const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""));
  return (
    <figure className="w-full">
      <div className="flex h-11 w-full overflow-hidden rounded-[10px] text-[13px] font-medium" role="img"
        aria-label={`${fmt(total)} ${symbol} in: ${fmt(poolPart)} filled by the Uniswap pool, ${fmt(deskPart)} filled from a maker wallet`}>
        <div className="flex items-center justify-center bg-[#FF007A] px-2 text-white" style={{ width: `${poolPct}%`, minWidth: poolPart > 0 ? "3.5rem" : 0 }}>
          {poolPart > 0 ? `${fmt(poolPart)} ${symbol}` : null}
        </div>
        <div className="flex flex-1 items-center justify-center bg-[#0066FA] px-2 text-white">
          {deskPart > 0 ? `${fmt(deskPart)} ${symbol}` : "no overflow"}
        </div>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#5D5D66]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-[#FF007A]" /> Uniswap v4 pool, up to its cap
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-[#0066FA]" /> Maker wallet via 1inch Aqua
        </span>
        {caption ? <span className="w-full text-[12px] text-[#5D5D66]">{caption}</span> : null}
      </figcaption>
    </figure>
  );
}
