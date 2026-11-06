export function Notice({ tone, children }: { tone: "error" | "info" | "ok"; children: React.ReactNode }) {
  const styles = {
    error: "border-[#E11D48]/30 bg-[#E11D48]/5 text-[#9F1239]",
    info: "border-black/10 bg-[#F2F2F3] text-[#5D5D66]",
    ok: "border-[#0F9F6E]/30 bg-[#0F9F6E]/8 text-[#047857]",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-[10px] border px-3 py-2 text-[13px] leading-relaxed ${styles}`}>
      {children}
    </p>
  );
}
