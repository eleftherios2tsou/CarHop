export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px", display: "flex", flexDirection: "column", gap: 24 }}>

      <div>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: 28, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
          Privacy Policy
        </h1>
        <p style={{ margin: 0, color: "var(--text-soft)", fontSize: 15, lineHeight: 1.6 }}>
          Last updated: February 2026. This policy explains what personal data CarHop collects, how we use it, and your rights under UK GDPR.
        </p>
      </div>

      {/* ── Data We Collect ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          </div>
          <h2 style={headingStyle}>1. Data We Collect</h2>
        </div>
        <div style={bodyStyle}>
          <p>We collect the following categories of personal data when you use CarHop:</p>
          <ul style={listStyle}>
            <li><strong>Account data</strong> — name, email address, date of birth, password (stored as a one-way hash).</li>
            <li><strong>Licence data</strong> — driver's licence photo, selfie, licence number, issuing country, and expiry date, collected for identity and eligibility verification.</li>
            <li><strong>Transaction data</strong> — booking dates, rental amounts, payment status, and Stripe payment references.</li>
            <li><strong>Profile data</strong> — avatar image and optional biography text.</li>
            <li><strong>Usage data</strong> — IP addresses, browser type, and session cookies used for authentication and rate-limiting.</li>
          </ul>
          <p style={{ margin: 0 }}>We do not collect full payment card details. Card processing is handled entirely by Stripe in accordance with their PCI-DSS obligations.</p>
        </div>
      </section>

      {/* ── How We Use It ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
          </div>
          <h2 style={headingStyle}>2. How We Use Your Data</h2>
        </div>
        <div style={bodyStyle}>
          <p>Your data is used to:</p>
          <ul style={listStyle}>
            <li>Create and manage your account and verify your identity.</li>
            <li>Facilitate car listings, bookings, and payments between owners and renters.</li>
            <li>Process refunds, resolve disputes, and handle damage reports.</li>
            <li>Send transactional emails (booking confirmations, verification links, notifications).</li>
            <li>Detect and prevent fraud, abuse, and violations of our Terms of Service.</li>
            <li>Comply with legal obligations (e.g. financial record-keeping).</li>
          </ul>
          <p style={{ margin: 0 }}>We do not sell your personal data to third parties. We do not use your data for targeted advertising.</p>
        </div>
      </section>

      {/* ── Cookies ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/>
            </svg>
          </div>
          <h2 style={headingStyle}>3. Cookies &amp; Local Storage</h2>
        </div>
        <div style={bodyStyle}>
          <p>CarHop uses the following cookies and browser storage:</p>
          <ul style={listStyle}>
            <li><strong>Session cookies</strong> (<code>access_token</code>, <code>refresh_token</code>, <code>csrf_token</code>) — strictly necessary for authentication. These expire when you log out or after 7 days.</li>
            <li><strong>localStorage key</strong> (<code>carhop_cookie_consent</code>) — records your acceptance of this cookie notice so we do not show it again.</li>
          </ul>
          <p style={{ margin: 0 }}>We do not use analytics or marketing cookies. Strictly-necessary cookies cannot be disabled as they are essential to the service.</p>
        </div>
      </section>

      {/* ── Data Sharing ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </div>
          <h2 style={headingStyle}>4. Data Sharing</h2>
        </div>
        <div style={bodyStyle}>
          <p>We share your data only with the following third-party processors:</p>
          <ul style={listStyle}>
            <li><strong>Stripe</strong> — for payment processing and owner payouts. Stripe acts as an independent data controller for payment card data.</li>
            <li><strong>Amazon Web Services / Azure</strong> — for secure cloud storage of uploaded images (licence photos, selfies, car photos, avatars).</li>
            <li><strong>Gmail SMTP</strong> — for sending transactional emails.</li>
          </ul>
          <p style={{ margin: 0 }}>We may disclose your data where required to do so by law, court order, or where necessary to enforce our Terms of Service or protect the rights of other users.</p>
        </div>
      </section>

      {/* ── Retention & Erasure ── */}
      <section style={sectionStyle("warn")}>
        <div style={sectionHeader}>
          <div style={iconBox("warn")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/>
              <path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </div>
          <h2 style={headingStyle}>5. Retention, Export &amp; Erasure</h2>
        </div>
        <div style={bodyStyle}>
          <p>We retain your personal data for as long as your account is active or as required by law (e.g. financial records must be kept for 6 years under UK tax law).</p>
          <p><strong>Your rights under UK GDPR:</strong></p>
          <ul style={listStyle}>
            <li><strong>Right to access</strong> — download a full copy of your personal data from the <strong>Profile → Export My Data</strong> button.</li>
            <li><strong>Right to erasure</strong> — permanently delete your account and anonymise your personal data from the <strong>Profile → Danger Zone → Delete My Account</strong> button. This action is irreversible.</li>
            <li><strong>Right to rectification</strong> — update your bio and avatar from your Profile page. For other corrections, contact us.</li>
            <li><strong>Right to portability</strong> — the data export is provided in machine-readable JSON format.</li>
          </ul>
          <p style={{ margin: 0 }}>Transaction records linked to your account are retained in anonymised form after deletion to comply with financial regulations. Uploaded licence and selfie images are deleted immediately upon account erasure.</p>
        </div>
      </section>

      {/* ── Contact ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <h2 style={headingStyle}>6. Contact</h2>
        </div>
        <div style={bodyStyle}>
          <p style={{ margin: 0 }}>For any privacy-related queries or to exercise your rights, please contact us at <strong>privacy@carhop.example</strong>. We aim to respond within 30 days as required by UK GDPR.</p>
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
