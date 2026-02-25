export default function TermsPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px", display: "flex", flexDirection: "column", gap: 24 }}>

      <div>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: 28, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
          Terms of Service
        </h1>
        <p style={{ margin: 0, color: "var(--text-soft)", fontSize: 15, lineHeight: 1.6 }}>
          Last updated: February 2026. Please read these terms carefully before using CarHop. By registering an account you agree to be bound by them.
        </p>
      </div>

      {/* ── Introduction ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <h2 style={headingStyle}>1. Introduction</h2>
        </div>
        <div style={bodyStyle}>
          <p>CarHop is a peer-to-peer car rental marketplace that connects private car owners ("Owners") with drivers who wish to rent a car ("Renters"). CarHop acts as a platform intermediary only — we are not a party to the rental agreement between Owner and Renter, and we do not own or operate any vehicles listed on the platform.</p>
          <p style={{ margin: 0 }}>These Terms of Service ("Terms") govern your access to and use of the CarHop website and related services. By creating an account you confirm that you are at least 21 years of age and legally permitted to drive in the United Kingdom.</p>
        </div>
      </section>

      {/* ── Eligibility ── */}
      <section style={sectionStyle("warn")}>
        <div style={sectionHeader}>
          <div style={iconBox("warn")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <h2 style={headingStyle}>2. Eligibility</h2>
        </div>
        <div style={bodyStyle}>
          <p>To use CarHop you must:</p>
          <ul style={listStyle}>
            <li>Be at least <strong>21 years old</strong>.</li>
            <li>Hold a <strong>valid UK or EU driving licence</strong> that has been verified through our licence upload process.</li>
            <li>Have a verified email address.</li>
            <li>Not have been previously suspended or banned from the platform.</li>
          </ul>
          <p style={{ margin: 0 }}>We reserve the right to refuse registration or suspend any account at our sole discretion.</p>
        </div>
      </section>

      {/* ── User Responsibilities ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <h2 style={headingStyle}>3. User Responsibilities</h2>
        </div>
        <div style={bodyStyle}>
          <p><strong>All users</strong> must provide accurate information and keep their details up to date. You are responsible for all activity on your account.</p>
          <p><strong>Renters</strong> must:</p>
          <ul style={listStyle}>
            <li>Hold valid car insurance covering the rental vehicle for the rental period.</li>
            <li>Inspect and photograph the vehicle before and after the rental.</li>
            <li>Return the vehicle in the same condition it was received, on time and with the agreed fuel level.</li>
            <li>Pay all tolls, parking fines, and traffic penalties incurred during the rental period.</li>
          </ul>
          <p><strong>Owners</strong> must:</p>
          <ul style={listStyle}>
            <li>Ensure the vehicle is roadworthy, has a valid MOT, and is taxed.</li>
            <li>Disclose any known defects to the renter before the rental starts.</li>
            <li>Not list a vehicle they do not have authority to rent out.</li>
          </ul>
          <p style={{ margin: 0 }}>Any misuse of the platform — including fraudulent listings, false damage reports, or identity misrepresentation — may result in immediate account suspension and referral to law enforcement.</p>
        </div>
      </section>

      {/* ── Bookings & Payments ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <h2 style={headingStyle}>4. Bookings &amp; Payments</h2>
        </div>
        <div style={bodyStyle}>
          <p>All payments are processed securely through <strong>Stripe</strong>. When a booking is approved and paid, funds (including the £250 security deposit) are held in escrow and released to the owner only after the rental concludes without dispute.</p>
          <p>CarHop charges a <strong>platform fee</strong> on each transaction to cover operating costs. The fee is displayed at checkout before payment is confirmed.</p>
          <p style={{ margin: 0 }}>Owner payouts require a connected Stripe Express account. You are responsible for any tax obligations arising from income received through the platform.</p>
        </div>
      </section>

      {/* ── Cancellation ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h2 style={headingStyle}>5. Cancellation Policy</h2>
        </div>
        <div style={bodyStyle}>
          <p>Each car listing has one of three cancellation policies set by the owner:</p>
          <ul style={listStyle}>
            <li><strong>Flexible</strong> — full refund if cancelled more than 24 hours before the rental start.</li>
            <li><strong>Moderate</strong> — full refund if cancelled 5+ days before start; 50% refund if cancelled 1–5 days before start.</li>
            <li><strong>Strict</strong> — full refund if cancelled 7+ days before start; 50% refund if cancelled 2–7 days before start.</li>
          </ul>
          <p style={{ margin: 0 }}>The applicable policy and estimated refund amount are shown to you before you confirm a cancellation. No refunds apply outside the policy windows.</p>
        </div>
      </section>

      {/* ── Liability ── */}
      <section style={sectionStyle("warn")}>
        <div style={sectionHeader}>
          <div style={iconBox("warn")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2 style={headingStyle}>6. Limitation of Liability</h2>
        </div>
        <div style={bodyStyle}>
          <p>CarHop is a marketplace platform. <strong>We are not responsible</strong> for the condition of any vehicle, the conduct of owners or renters, any accidents or damage occurring during a rental, or any financial loss arising from cancelled or disputed bookings.</p>
          <p style={{ margin: 0 }}>To the maximum extent permitted by law, CarHop's total liability for any claim arising out of your use of the platform is limited to the platform fees paid by you in the 12 months preceding the claim.</p>
        </div>
      </section>

      {/* ── Governing Law ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h2 style={headingStyle}>7. Governing Law</h2>
        </div>
        <div style={bodyStyle}>
          <p style={{ margin: 0 }}>These Terms are governed by the laws of <strong>England and Wales</strong>. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales. If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.</p>
        </div>
      </section>

    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function sectionStyle(tone) {
  const isWarn = tone === "warn";
  return {
    border: `1px solid ${isWarn ? "var(--warn-line)" : "var(--line)"}`,
    borderRadius: "var(--radius-lg)",
    background: isWarn ? "var(--warn-bg)" : "var(--surface)",
    overflow: "hidden",
    boxShadow: "var(--shadow-sm)",
  };
}

function iconBox(tone) {
  const isWarn = tone === "warn";
  return {
    width: 40, height: 40, borderRadius: "var(--radius-md)",
    background: isWarn ? "var(--warn-line)" : "var(--brand-soft)",
    color: isWarn ? "var(--warn-text)" : "var(--brand)",
    display: "grid", placeItems: "center", flexShrink: 0,
  };
}

const sectionHeader = {
  display: "flex", alignItems: "center", gap: 12,
  padding: "16px 20px", borderBottom: "1px solid var(--line)",
};

const headingStyle = {
  margin: 0, fontSize: 16, fontWeight: 700,
  fontFamily: "var(--font-head)", color: "var(--text)",
};

const bodyStyle = {
  padding: "16px 20px",
  display: "flex", flexDirection: "column", gap: 10,
  fontSize: 14, color: "var(--text-soft)", lineHeight: 1.65,
};

const listStyle = {
  margin: "0", paddingLeft: 18,
  display: "flex", flexDirection: "column", gap: 5,
};
