export default function Badge({ tone = "neutral", children }) {
  const cls =
    tone === "ok"
      ? "badge badgeOk"
      : tone === "warn"
      ? "badge badgeWarn"
      : tone === "bad"
      ? "badge badgeBad"
      : "badge";
  return <span className={cls}>{children}</span>;
}
