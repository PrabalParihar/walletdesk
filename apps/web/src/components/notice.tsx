export function Notice({ tone, children }: { tone: "error" | "info" | "ok"; children: React.ReactNode }) {
  const styles = {
    error: "border-[#E11D48]/30 bg-[#E11D48]/5 text-[#9F1239] dark:text-[#FDA4AF]",
    info: "border-line-2 bg-sunken text-muted-ink",
    ok: "border-[#0F9F6E]/30 bg-[#0F9F6E]/8 text-[#047857] dark:text-[#34D399]",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-[10px] border px-3 py-2 text-[13px] leading-relaxed ${styles}`}>
      {children}
    </p>
  );
}
