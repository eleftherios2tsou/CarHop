export default function Button({ variant = "primary", loading, ...props }) {
  const cls =
    variant === "ghost"
      ? "btn btnGhost"
      : variant === "danger"
      ? "btn btnDanger"
      : variant === "secondary"
      ? "btn btnSecondary"
      : "btn btnPrimary";

  return (
    <button className={cls} {...props} disabled={props.disabled || loading}>
      {loading ? "Working..." : props.children}
    </button>
  );
}
