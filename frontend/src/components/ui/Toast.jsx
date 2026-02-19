export default function Toast({ tone = "info", message, onClose }) {
  if (!message) return null;
  const cls =
    tone === "ok" ? "toast toastOk" : tone === "bad" ? "toast toastBad" : "toast";
  return (
    <div className={cls} role="status">
      <div className="toastMsg">{message}</div>
      <button className="toastX" onClick={onClose} aria-label="close">
        x
      </button>
    </div>
  );
}
