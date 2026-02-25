import { useState } from "react";

export default function CookieConsentBanner({ onPrivacy }) {
  const [visible, setVisible] = useState(
    !localStorage.getItem("carhop_cookie_consent")
  );

  if (!visible) return null;

  function accept() {
    localStorage.setItem("carhop_cookie_consent", "accepted");
    setVisible(false);
  }

  return (
    <div className="cookieBanner">
      <span className="tiny">
        We use cookies to keep you logged in and remember your preferences.
      </span>
      <div className="row" style={{ gap: 8, flexShrink: 0 }}>
        <button className="btn btnSecondary" style={{ fontSize: 12 }} onClick={onPrivacy}>
          Privacy Policy
        </button>
        <button className="btn" style={{ fontSize: 12 }} onClick={accept}>
          Accept
        </button>
      </div>
    </div>
  );
}
