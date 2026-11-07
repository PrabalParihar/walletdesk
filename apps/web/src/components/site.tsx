import { ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

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
      className={cn("inline-flex items-center gap-0.5 text-link underline decoration-current/35 underline-offset-2 hover:decoration-current", className)}
    >
      {children}
      <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
    </a>
  );
}

/** Section label: a two-digit index and a monospace caption, so a long page reads as numbered parts. */
export function Eyebrow({ children, index, className }: { children: React.ReactNode; index?: string; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 font-mono text-[12px] tracking-wider text-muted-ink uppercase", className)}>
      {index ? <span className="text-link">{index}</span> : null}
      <span>{children}</span>
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  index,
  id,
  level = 2,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  index?: string;
  id?: string;
  /** 1 when this heading is the page title. */
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className="max-w-2xl">
      <Eyebrow index={index}>{eyebrow}</Eyebrow>
      <Heading id={id} className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-balance md:text-[28px] md:leading-[1.15]">
        {title}
      </Heading>
      {lead ? <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">{lead}</p> : null}
    </div>
  );
}

export function InfoCard({
  tag,
  title,
  children,
  tone = "plain",
  icon: Icon,
  className,
}: {
  tag?: string;
  title: string;
  children: React.ReactNode;
  tone?: "plain" | "problem" | "solution";
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "rounded-[14px] border p-5 shadow-[var(--wd-shadow-float)]",
        tone === "problem" && "border-[#E11D48]/15 bg-problem-soft",
        tone === "solution" && "border-desk/15 bg-solution",
        tone === "plain" && "border-line bg-surface",
        className,
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "mb-3 flex size-8 items-center justify-center rounded-[8px]",
            tone === "problem" ? "bg-[#E11D48]/10 text-problem" : "bg-desk/10 text-desk-ink",
          )}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
      ) : null}
      {tag ? (
        <p
          className={cn(
            "mb-2 font-mono text-[11px] tracking-wider uppercase",
            tone === "problem" ? "text-problem" : "text-link",
          )}
        >
          {tag}
        </p>
      ) : null}
      <h3 className="text-[16px] font-semibold text-balance">{title}</h3>
      <div className="mt-2 text-[14px] leading-relaxed text-pretty text-body">{children}</div>
    </article>
  );
}

export function StatLink({ value, label, href, internal }: { value: string; label: string; href?: string; internal?: boolean }) {
  const body = (
    <>
      <p className="text-[26px] font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-[13px] leading-snug text-muted-ink">{label}</p>
      {href ? <ArrowUpRight className="absolute top-4 right-4 size-4 text-link" aria-hidden /> : null}
    </>
  );
  const cls = "wd-lift relative block rounded-[14px] border border-line bg-surface p-4 shadow-[var(--wd-shadow-float)] hover:border-desk/30";
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
  reveal = false,
}: {
  total: number;
  poolPart: number;
  symbol: string;
  caption?: string;
  /** Draw the bar left to right on first paint: the pool leg, then the desk leg. Skipped under reduced motion. */
  reveal?: boolean;
}) {
  const deskPart = Math.max(total - poolPart, 0);
  const poolPct = total > 0 ? Math.min(100, Math.max(0, (poolPart / total) * 100)) : 0;
  const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""));
  return (
    <figure className="w-full">
      <div className={cn("flex h-11 w-full overflow-hidden rounded-[10px] text-[13px] font-medium tabular-nums", reveal && "wd-reveal")} role="img"
        aria-label={`${fmt(total)} ${symbol} in: ${fmt(poolPart)} filled by the Uniswap pool, ${fmt(deskPart)} filled from a maker wallet`}>
        <div
          className="flex items-center justify-center bg-[var(--pool)] px-2 text-white transition-[width] duration-300 ease-[cubic-bezier(0.3,1.12,0.4,1)] motion-reduce:transition-none"
          style={{ width: `${poolPct}%`, minWidth: poolPart > 0 ? "3.5rem" : 0 }}
        >
          {poolPart > 0 ? `${fmt(poolPart)} ${symbol}` : null}
        </div>
        <div className="flex flex-1 items-center justify-center bg-desk px-2 text-white">
          {deskPart > 0 ? `${fmt(deskPart)} ${symbol}` : "no overflow"}
        </div>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-ink">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-[var(--pool)]" aria-hidden /> Uniswap v4 pool, up to its cap
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-desk" aria-hidden /> Maker wallet via 1inch Aqua
        </span>
        {caption ? <span className="w-full text-[12px] text-muted-ink">{caption}</span> : null}
      </figcaption>
    </figure>
  );
}

/** Page title used by the desk, live, and rebate screens: one eyebrow, one sentence, then the actions. */
export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-balance md:text-[34px] md:leading-[1.1]">{title}</h1>
      {lead ? <p className="max-w-2xl text-[14px] leading-relaxed text-pretty text-body">{lead}</p> : null}
      {children}
    </header>
  );
}

/** Small status pill. Tones stay inside the existing ink / desk / problem palette. */
export function StatusChip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" | "brand" }) {
  const toneClass = {
    neutral: "bg-sunken text-body",
    ok: "bg-[#047857]/10 text-[#047857] dark:text-[#34D399]",
    warn: "bg-problem-soft text-problem",
    brand: "bg-desk/10 text-desk-ink",
  }[tone];
  return <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium", toneClass)}>{children}</span>;
}

/** Binary or filter choice, in the same pill family as a catalogue chip. Selected state is the desk blue. */
export function FilterChip({ pressed, className, children, ...props }: { pressed: boolean } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "wd-spring inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium disabled:pointer-events-none disabled:opacity-40",
        pressed ? "bg-desk text-white shadow-[0_1px_2px_rgba(0,102,250,0.45)]" : "text-body hover:bg-surface hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Quiet empty surface: a hatched tile, a title, and one sentence. No illustration. */
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[14px] border border-line bg-sunken px-5 py-8 text-center">
      <span
        aria-hidden
        className="mb-3 size-10 rounded-[8px] border border-line bg-surface"
        style={{ backgroundImage: "repeating-linear-gradient(-45deg, var(--wd-hatch) 0 1px, transparent 1px 6px)" }}
      />
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-[13px] leading-relaxed text-pretty text-muted-ink">{children}</div> : null}
    </div>
  );
}
