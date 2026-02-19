export default function StateNotice({ title, detail, tone = "info" }) {
  const cls =
    tone === "warn"
      ? "stateNotice stateNoticeWarn"
      : tone === "bad"
        ? "stateNotice stateNoticeBad"
        : "stateNotice";

  return (
    <div className={cls}>
      <div className="stateNoticeTitle">{title}</div>
      {detail ? <div className="stateNoticeDetail">{detail}</div> : null}
    </div>
  );
}
