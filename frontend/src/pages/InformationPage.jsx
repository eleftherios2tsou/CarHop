export default function InformationPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px", display: "flex", flexDirection: "column", gap: 24 }}>

      <div>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: 28, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
          Renter &amp; Owner Information
        </h1>
        <p style={{ margin: 0, color: "var(--text-soft)", fontSize: 15, lineHeight: 1.6 }}>
          Before listing or booking a car on CarHop, please read the following carefully. These rules protect both parties and ensure every rental runs smoothly.
        </p>
      </div>

      {/* ── Insurance ── */}
      <section style={sectionStyle("warn")}>
        <div style={sectionHeader}>
          <div style={iconBox("warn")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h2 style={headingStyle}>Insurance — your responsibility</h2>
        </div>
        <div style={bodyStyle}>
          <p><strong>CarHop does not provide insurance</strong> for any rental. As a renter, you must hold one of the following before your trip begins:</p>
          <ul style={listStyle}>
            <li>A <strong>fully comprehensive car insurance policy</strong> that explicitly covers driving third-party vehicles (check your policy's "driving other cars" clause), or</li>
            <li>A <strong>short-term specialist policy</strong> purchased specifically for the rental period (e.g. from Dayinsure, Tempcover, or a similar provider).</li>
          </ul>
          <p>Driving without valid insurance is a criminal offence in the UK and can result in fines, points, and disqualification. CarHop accepts no liability for uninsured driving.</p>
          <p style={{ margin: 0 }}>
            <strong>Owners:</strong> your standard policy may be voided if a non-named driver causes an accident. Check with your insurer before listing your vehicle.
          </p>
        </div>
      </section>

      {/* ── Condition Photos ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <h2 style={headingStyle}>Condition photos — required from both parties</h2>
        </div>
        <div style={bodyStyle}>
          <p>To protect both the owner and renter in the event of a damage dispute, <strong>both parties must photograph the vehicle</strong> immediately before and after the rental period. Photos should cover:</p>
          <ul style={listStyle}>
            <li>All four exterior sides of the vehicle</li>
            <li>The interior (seats, dashboard, boot)</li>
            <li>The odometer reading</li>
            <li>Any pre-existing damage (scratches, dents, marks)</li>
          </ul>
          <p style={{ margin: 0 }}>These photos are your primary evidence if a damage report is filed. <strong>Failure to document the vehicle's condition before the rental starts may affect the outcome of any dispute.</strong> We strongly recommend timestamped photos taken on the day of handover.</p>
        </div>
      </section>

      {/* ── Security Deposit ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <h2 style={headingStyle}>£250 refundable security deposit</h2>
        </div>
        <div style={bodyStyle}>
          <p>When you pay for a booking, a <strong>£250 security deposit</strong> is held alongside the rental cost. This deposit:</p>
          <ul style={listStyle}>
            <li>Is held securely via Stripe during the rental period.</li>
            <li>Is <strong>automatically returned</strong> to you after the trip concludes with no damage report filed by the owner.</li>
            <li>Is <strong>held pending review</strong> if the owner files a damage report within 48 hours of the rental ending.</li>
          </ul>
          <p style={{ margin: 0 }}>If a damage report is raised, a CarHop administrator will review the evidence and decide whether the deposit is released in full to the renter, partially or fully forfeited to the owner, or split between both parties.</p>
        </div>
      </section>

      {/* ── Booking Flow ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <h2 style={headingStyle}>How the booking process works</h2>
        </div>
        <div style={bodyStyle}>
          <ol style={{ ...listStyle, paddingLeft: 20 }}>
            <li><strong>Browse &amp; request</strong> — Find a car in the Marketplace, select your dates, and submit a booking request.</li>
            <li><strong>Owner approval</strong> — The owner reviews your request and accepts or declines within 48 hours.</li>
            <li><strong>Payment</strong> — Once approved, you pay the rental cost plus the £250 deposit. Funds are held in escrow until the trip ends.</li>
            <li><strong>Handover</strong> — Meet the owner, complete condition photos together, and collect the keys.</li>
            <li><strong>Return</strong> — Return the car at the agreed time. Complete condition photos again with the owner.</li>
            <li><strong>Escrow release</strong> — The owner releases the escrow funds. Your deposit is returned automatically if no damage is reported.</li>
          </ol>
        </div>
      </section>

      {/* ── Eligibility ── */}
      <section style={sectionStyle("neutral")}>
        <div style={sectionHeader}>
          <div style={iconBox("neutral")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <h2 style={headingStyle}>Eligibility requirements</h2>
        </div>
        <div style={bodyStyle}>
          <p>To use CarHop as a renter or owner you must:</p>
          <ul style={listStyle}>
            <li>Be <strong>21 years of age or older</strong></li>
            <li>Hold a <strong>valid UK driving licence</strong> (or equivalent recognised in the UK)</li>
            <li>Have your licence verified through the CarHop verification process</li>
            <li>Hold valid insurance for any vehicle you drive (see above)</li>
          </ul>
          <p style={{ margin: 0 }}>
            <strong>Owners</strong> must additionally ensure their vehicle has a valid MOT, current road tax, and that their insurance policy permits third-party use of the vehicle.
          </p>
        </div>
      </section>

      <p style={{ margin: 0, fontSize: 13, color: "var(--text-faint)", borderTop: "1px solid var(--line)", paddingTop: 16 }}>
        If you have any questions about these requirements, contact CarHop support before making a booking. CarHop is a peer-to-peer marketplace and is not an insurer, lender, or party to the rental agreement between owner and renter.
      </p>

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
