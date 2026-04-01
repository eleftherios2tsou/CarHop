import { useCallback, useEffect, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import Badge from "../components/ui/Badge";
import DisputeResolveModal from "../components/disputes/DisputeResolveModal";
import DamageReportResolveModal from "../components/DamageReportResolveModal";
import { apiFetch } from "../lib/api";

// format pence as £ with 2 decimal places
function gbp(pence) {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// date string (YYYY-MM-DD) → "12 Apr 2025"
function fmtDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function bookingTone(status) {
  if (status === "PENDING") return "warn";
  if (status === "APPROVED" || status === "COMPLETED") return "ok";
  if (status === "CANCELLED" || status === "REJECTED") return "bad";
  return "neutral";
}

function disputeTone(status) {
  if (status === "OPEN") return "warn";
  if (status === "RESOLVED") return "ok";
  if (status === "REJECTED") return "bad";
  return "warn";
}

function drTone(status) {
  if (status === "OPEN" || status === "UNDER_REVIEW") return "warn";
  if (status === "RESOLVED") return "ok";
  if (status === "DISMISSED") return "neutral";
  return "warn";
}

function paymentTone(status) {
  if (status === "HELD_IN_ESCROW") return "warn";
  if (status === "RELEASED") return "ok";
  if (status === "FORFEITED" || status === "REFUNDED") return "bad";
  return "neutral";
}

// small stat card used on the overview grid
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderRadius: 10,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-faint)" }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: accent || "var(--text)" }}>
        {value ?? "—"}
      </div>
      {sub && <div className="tiny muted">{sub}</div>}
    </div>
  );
}

// thin section heading used inside each tab
function SectionHeading({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-faint)", marginBottom: 10 }}>
      {children}
    </div>
  );
}

const TABS = ["Overview", "Users", "Bookings", "Disputes", "Damage Reports", "Escrow"];
const BOOKING_STATUSES = ["", "PENDING", "APPROVED", "COMPLETED", "CANCELLED", "REJECTED"];

export default function AdminPage({ notify, onAuthError }) {
  const [tab, setTab] = useState("Overview");

  // ── Overview ─────────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);
  const [busyStats, setBusyStats] = useState(false);

  // ── Users ─────────────────────────────────────────────────────────────
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userList, setUserList] = useState(null);
  const [userPagination, setUserPagination] = useState({ total: 0, pages: 1 });
  const [busyUsers, setBusyUsers] = useState(false);
  const [busyToggle, setBusyToggle] = useState(null);

  // ── Bookings ──────────────────────────────────────────────────────────
  const [bookings, setBookings] = useState(null);
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingPagination, setBookingPagination] = useState({ total: 0, pages: 1 });
  const [busyBookings, setBusyBookings] = useState(false);
  const [bookingStatusFilter, setBookingStatusFilter] = useState("");

  // ── Disputes ──────────────────────────────────────────────────────────
  const [disputes, setDisputes] = useState([]);
  const [busyLoad, setBusyLoad] = useState(false);
  const [busyResolve, setBusyResolve] = useState(null);
  const [resolveModal, setResolveModal] = useState(null);

  // ── Damage Reports ────────────────────────────────────────────────────
  const [damageReports, setDamageReports] = useState([]);
  const [busyLoadDr, setBusyLoadDr] = useState(false);
  const [busyResolveDr, setBusyResolveDr] = useState(null);
  const [drResolveModal, setDrResolveModal] = useState(null);

  // ── Escrow ────────────────────────────────────────────────────────────
  const [escrowBookingId, setEscrowBookingId] = useState("");
  const [busyEscrow, setBusyEscrow] = useState(null);

  // load the right data when switching tabs
  useEffect(() => {
    if (tab === "Overview") loadStats();
    if (tab === "Bookings" && bookings === null) loadBookings(1, "");
    if (tab === "Disputes") loadOpenDisputes();
    if (tab === "Damage Reports") loadDamageReports();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data loaders ──────────────────────────────────────────────────────

  async function loadStats() {
    setBusyStats(true);
    try {
      const data = await apiFetch("/admin/stats", { onAuthError });
      setStats(data);
    } catch (err) {
      notify(`Stats error: ${err.message}`, "bad");
    } finally {
      setBusyStats(false);
    }
  }

  const loadUsers = useCallback(async (page, search) => {
    setBusyUsers(true);
    try {
      const params = new URLSearchParams({ page, page_size: 20 });
      if (search) params.set("search", search);
      const data = await apiFetch(`/admin/users?${params}`, { onAuthError });
      setUserList(data.items);
      setUserPagination({ total: data.total, pages: data.pages });
    } catch (err) {
      notify(`Load users error: ${err.message}`, "bad");
    } finally {
      setBusyUsers(false);
    }
  }, [onAuthError, notify]);

  async function toggleUserActive(user) {
    setBusyToggle(user.id);
    try {
      const action = user.is_active ? "deactivate" : "activate";
      await apiFetch(`/admin/users/${user.id}/${action}`, { method: "POST", onAuthError });
      notify(`User #${user.id} ${action}d`, "ok");
      loadUsers(userPage, userSearch);
    } catch (err) {
      notify(`Toggle error: ${err.message}`, "bad");
    } finally {
      setBusyToggle(null);
    }
  }

  async function loadBookings(page, status) {
    setBusyBookings(true);
    try {
      const params = new URLSearchParams({ page, page_size: 15 });
      if (status) params.set("status", status);
      const data = await apiFetch(`/admin/bookings?${params}`, { onAuthError });
      setBookings(data.items);
      setBookingPagination({ total: data.total, pages: data.pages });
      setBookingPage(page);
    } catch (err) {
      notify(`Load bookings error: ${err.message}`, "bad");
    } finally {
      setBusyBookings(false);
    }
  }

  async function loadOpenDisputes() {
    setBusyLoad(true);
    try {
      const data = await apiFetch("/disputes/open", { onAuthError });
      setDisputes(Array.isArray(data) ? data : []);
    } catch (err) {
      notify(`Load disputes error: ${err.message}`, "bad");
    } finally {
      setBusyLoad(false);
    }
  }

  async function resolveDispute({ disputeId, status, resolution_note }) {
    setBusyResolve(disputeId);
    try {
      await apiFetch(`/disputes/${disputeId}/resolve`, {
        method: "POST",
        onAuthError,
        body: JSON.stringify({ status, resolution_note }),
      });
      notify(`Dispute #${disputeId} ${status.toLowerCase()}`, "ok");
      await loadOpenDisputes();
      setResolveModal(null);
    } catch (err) {
      notify(`Resolve dispute error: ${err.message}`, "bad");
    } finally {
      setBusyResolve(null);
    }
  }

  async function loadDamageReports() {
    setBusyLoadDr(true);
    try {
      const data = await apiFetch("/damage-reports/", { onAuthError });
      setDamageReports(Array.isArray(data) ? data : []);
    } catch (err) {
      notify(`Load damage reports error: ${err.message}`, "bad");
    } finally {
      setBusyLoadDr(false);
    }
  }

  async function resolveDamageReport({ reportId, status, deposit_decision, admin_note }) {
    setBusyResolveDr(reportId);
    try {
      await apiFetch(`/damage-reports/${reportId}/resolve`, {
        method: "POST",
        onAuthError,
        body: JSON.stringify({ status, deposit_decision, admin_note }),
      });
      notify(`Damage report #${reportId} ${status.toLowerCase()}`, "ok");
      await loadDamageReports();
      setDrResolveModal(null);
    } catch (err) {
      notify(`Resolve damage report error: ${err.message}`, "bad");
    } finally {
      setBusyResolveDr(null);
    }
  }

  async function releaseEscrow() {
    const bid = Number(escrowBookingId);
    if (!bid) { notify("Enter a valid booking ID", "warn"); return; }
    setBusyEscrow("release");
    try {
      const res = await apiFetch(`/admin/payments/${bid}/release`, { method: "POST", onAuthError });
      notify(res.message || `Escrow released for booking #${bid}`, "ok");
    } catch (err) {
      notify(`Release error: ${err.message}`, "bad");
    } finally {
      setBusyEscrow(null);
    }
  }

  async function forfeitEscrow() {
    const bid = Number(escrowBookingId);
    if (!bid) { notify("Enter a valid booking ID", "warn"); return; }
    setBusyEscrow("forfeit");
    try {
      const res = await apiFetch(`/admin/payments/${bid}/forfeit`, { method: "POST", onAuthError });
      notify(res.message || `Escrow forfeited for booking #${bid}`, "ok");
    } catch (err) {
      notify(`Forfeit error: ${err.message}`, "bad");
    } finally {
      setBusyEscrow(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <Card title="Admin Panel" subtitle="Platform administration.">

        {/* ── Tab bar ── */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--line)",
          marginBottom: 24,
          marginTop: 8,
          overflowX: "auto",
          gap: 0,
        }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 16px",
                background: "none",
                border: "none",
                borderBottom: tab === t ? "2px solid var(--accent, #0ea5e9)" : "2px solid transparent",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? "var(--accent, #0ea5e9)" : "var(--text-faint)",
                whiteSpace: "nowrap",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Overview tab ─────────────────────────────────────────── */}
        {tab === "Overview" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Platform Overview</span>
              <Button variant="secondary" onClick={loadStats} loading={busyStats}>Refresh</Button>
            </div>

            {!stats ? (
              <p className="tiny muted">{busyStats ? "Loading…" : "Failed to load stats."}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                <div>
                  <SectionHeading>Users</SectionHeading>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                    <StatCard label="Total" value={stats.users.total} />
                    <StatCard label="Active" value={stats.users.active} sub={`${stats.users.total - stats.users.active} inactive`} accent="var(--ok-text, #15803d)" />
                    <StatCard label="Email Verified" value={stats.users.email_verified} />
                    <StatCard label="Admins" value={stats.users.admins} accent="var(--warn-text, #92400e)" />
                  </div>
                </div>

                <div>
                  <SectionHeading>Cars</SectionHeading>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                    <StatCard label="Total Listings" value={stats.cars.total} />
                    <StatCard label="Available" value={stats.cars.available} accent="var(--ok-text, #15803d)" sub={`${stats.cars.total - stats.cars.available} unavailable`} />
                  </div>
                </div>

                <div>
                  <SectionHeading>Bookings</SectionHeading>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                    <StatCard label="Total" value={stats.bookings.total} />
                    <StatCard label="Pending" value={stats.bookings.pending} accent="var(--warn-text, #92400e)" />
                    <StatCard label="Approved" value={stats.bookings.approved} accent="var(--ok-text, #15803d)" />
                    <StatCard label="Completed" value={stats.bookings.completed} accent="var(--ok-text, #15803d)" />
                    <StatCard label="Cancelled" value={stats.bookings.cancelled} accent="var(--bad-text, #b91c1c)" />
                  </div>
                </div>

                <div>
                  <SectionHeading>Revenue</SectionHeading>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                    <StatCard label="Total Processed" value={gbp(stats.revenue.total_pence)} />
                    <StatCard label="In Escrow" value={gbp(stats.revenue.in_escrow_pence)} accent="var(--warn-text, #92400e)" />
                    <StatCard label="Released" value={gbp(stats.revenue.released_pence)} accent="var(--ok-text, #15803d)" />
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ── Users tab ────────────────────────────────────────────── */}
        {tab === "Users" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { setUserPage(1); loadUsers(1, userSearch); }
                }}
              />
              <Button variant="secondary" onClick={() => { setUserPage(1); loadUsers(1, userSearch); }} loading={busyUsers}>
                Search
              </Button>
            </div>

            {userList === null ? (
              <p className="tiny muted">Search or click Search to load users.</p>
            ) : userList.length === 0 ? (
              <p className="tiny muted">No users found.</p>
            ) : (
              <>
                <p className="tiny muted" style={{ marginBottom: 10 }}>
                  {userPagination.total} user{userPagination.total !== 1 ? "s" : ""} — page {userPage} of {userPagination.pages}
                </p>
                <div className="stack">
                  {userList.map((u) => (
                    <div key={u.id} className="rowCard">
                      <div className="rowCardMain">
                        <div className="rowCardTitle">
                          <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)", marginRight: 6 }}>#{u.id}</span>
                          {u.full_name}
                          <span style={{ marginLeft: 8 }}>
                            <Badge tone={u.role === "ADMIN" ? "warn" : "neutral"}>{u.role}</Badge>
                          </span>
                        </div>
                        <div className="rowCardSub">{u.email}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                          <Badge tone={u.is_active ? "ok" : "bad"}>{u.is_active ? "Active" : "Inactive"}</Badge>
                          <Badge tone={u.email_verified ? "ok" : "warn"}>{u.email_verified ? "Email verified" : "Unverified"}</Badge>
                          <Badge tone={u.license_verified ? "ok" : "warn"}>{u.license_verified ? "Licence verified" : "No licence"}</Badge>
                        </div>
                        <div className="tiny muted" style={{ marginTop: 6 }}>
                          Joined {new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </div>
                      <div className="rowCardActions">
                        <Button
                          variant={u.is_active ? "danger" : "secondary"}
                          loading={busyToggle === u.id}
                          onClick={() => toggleUserActive(u)}
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {userPagination.pages > 1 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <Button variant="secondary" disabled={userPage <= 1 || busyUsers}
                      onClick={() => { const p = userPage - 1; setUserPage(p); loadUsers(p, userSearch); }}>
                      ← Previous
                    </Button>
                    <Button variant="secondary" disabled={userPage >= userPagination.pages || busyUsers}
                      onClick={() => { const p = userPage + 1; setUserPage(p); loadUsers(p, userSearch); }}>
                      Next →
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Bookings tab ─────────────────────────────────────────── */}
        {tab === "Bookings" && (
          <div>
            {/* status filter pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
              <span className="tiny muted" style={{ marginRight: 4 }}>Filter:</span>
              {BOOKING_STATUSES.map((s) => (
                <button
                  key={s || "ALL"}
                  onClick={() => {
                    setBookingStatusFilter(s);
                    loadBookings(1, s);
                  }}
                  style={{
                    padding: "4px 14px",
                    borderRadius: 20,
                    border: "1px solid var(--line)",
                    background: bookingStatusFilter === s ? "var(--accent, #0ea5e9)" : "var(--surface)",
                    color: bookingStatusFilter === s ? "#fff" : "var(--text)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: bookingStatusFilter === s ? 600 : 400,
                    transition: "background 0.15s",
                  }}
                >
                  {s || "All"}
                </button>
              ))}
              <Button variant="secondary" onClick={() => loadBookings(bookingPage, bookingStatusFilter)} loading={busyBookings}>
                Refresh
              </Button>
            </div>

            {bookings === null ? (
              <p className="tiny muted">{busyBookings ? "Loading…" : "No bookings loaded."}</p>
            ) : bookings.length === 0 ? (
              <p className="tiny muted">No bookings found.</p>
            ) : (
              <>
                <p className="tiny muted" style={{ marginBottom: 10 }}>
                  {bookingPagination.total} booking{bookingPagination.total !== 1 ? "s" : ""} — page {bookingPage} of {bookingPagination.pages}
                </p>
                <div className="stack">
                  {bookings.map((b) => (
                    <div key={b.id} className="rowCard">
                      <div className="rowCardMain">
                        <div className="rowCardTitle">
                          <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)", marginRight: 6 }}>#{b.id}</span>
                          {b.car_name}
                        </div>
                        <div className="rowCardSub">
                          Renter: <strong>{b.renter_name}</strong>
                          {b.renter_email && <span className="muted"> · {b.renter_email}</span>}
                        </div>
                        <div className="rowCardSub">
                          {fmtDate(b.start_date)} → {fmtDate(b.end_date)}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <Badge tone={bookingTone(b.status)}>{b.status}</Badge>
                          {b.payment_status && (
                            <Badge tone={paymentTone(b.payment_status)}>
                              {b.payment_status.replace(/_/g, " ")}
                            </Badge>
                          )}
                          {b.amount_pence != null && (
                            <span className="tiny muted">{gbp(b.amount_pence)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {bookingPagination.pages > 1 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <Button variant="secondary" disabled={bookingPage <= 1 || busyBookings}
                      onClick={() => loadBookings(bookingPage - 1, bookingStatusFilter)}>
                      ← Previous
                    </Button>
                    <Button variant="secondary" disabled={bookingPage >= bookingPagination.pages || busyBookings}
                      onClick={() => loadBookings(bookingPage + 1, bookingStatusFilter)}>
                      Next →
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Disputes tab ─────────────────────────────────────────── */}
        {tab === "Disputes" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Open Disputes</span>
              <Button variant="secondary" onClick={loadOpenDisputes} loading={busyLoad}>Refresh</Button>
            </div>
            {disputes.length === 0 ? (
              <p className="tiny muted">{busyLoad ? "Loading…" : "No open disputes."}</p>
            ) : (
              <div className="stack">
                {disputes.map((d) => (
                  <div key={d.id} className="rowCard">
                    <div className="rowCardMain">
                      <div className="rowCardTitle">
                        Dispute #{d.id}
                        <span className="muted" style={{ marginLeft: 6 }}>· Booking #{d.booking_id}</span>
                      </div>
                      <div className="rowCardSub" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Badge tone={disputeTone(d.status)}>{d.status}</Badge>
                        <span>User #{d.opened_by_user_id} → User #{d.against_user_id}</span>
                      </div>
                      <div className="rowCardSub">Reason: {d.reason}</div>
                      {d.details && <div className="rowCardSub muted">{d.details}</div>}
                    </div>
                    <div className="rowCardActions">
                      <Button onClick={() => setResolveModal({ id: d.id, initialStatus: "RESOLVED" })} loading={busyResolve === d.id}>
                        Resolve
                      </Button>
                      <Button variant="danger" onClick={() => setResolveModal({ id: d.id, initialStatus: "REJECTED" })} loading={busyResolve === d.id}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Damage Reports tab ───────────────────────────────────── */}
        {tab === "Damage Reports" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Damage Reports</span>
              <Button variant="secondary" onClick={loadDamageReports} loading={busyLoadDr}>Refresh</Button>
            </div>
            {damageReports.length === 0 ? (
              <p className="tiny muted">{busyLoadDr ? "Loading…" : "No damage reports."}</p>
            ) : (
              <div className="stack">
                {damageReports.map((dr) => (
                  <div key={dr.id} className="rowCard">
                    <div className="rowCardMain">
                      <div className="rowCardTitle">
                        Report #{dr.id}
                        <span className="muted" style={{ marginLeft: 6 }}>· Booking #{dr.booking_id}</span>
                      </div>
                      <div className="rowCardSub" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Badge tone={drTone(dr.status)}>{dr.status}</Badge>
                        <span>Reporter: User #{dr.reporter_id}</span>
                      </div>
                      <div className="rowCardSub">{dr.description}</div>
                      {dr.estimated_cost_pence != null && (
                        <div className="rowCardSub">Estimated cost: {gbp(dr.estimated_cost_pence)}</div>
                      )}
                      {dr.admin_note && <div className="rowCardSub muted">Admin note: {dr.admin_note}</div>}
                    </div>
                    {(dr.status === "OPEN" || dr.status === "UNDER_REVIEW") && (
                      <div className="rowCardActions">
                        <Button onClick={() => setDrResolveModal({ id: dr.id, bookingId: dr.booking_id })} loading={busyResolveDr === dr.id}>
                          Resolve
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Escrow tab ───────────────────────────────────────────── */}
        {tab === "Escrow" && (
          <div className="form" style={{ maxWidth: 480 }}>
            <p className="tiny muted" style={{ marginBottom: 16 }}>
              Manually release or forfeit escrow funds for a booking.
              Releasing sends the payout to the car owner; forfeiting refunds the renter.
            </p>
            <Field
              label="Booking ID"
              type="number"
              min="1"
              value={escrowBookingId}
              onChange={(e) => setEscrowBookingId(e.target.value)}
              placeholder="e.g. 42"
            />
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <Button onClick={releaseEscrow} loading={busyEscrow === "release"} disabled={busyEscrow !== null}>
                Release to Owner
              </Button>
              <Button variant="danger" onClick={forfeitEscrow} loading={busyEscrow === "forfeit"} disabled={busyEscrow !== null}>
                Forfeit (Refund Renter)
              </Button>
            </div>
          </div>
        )}

      </Card>

      <DisputeResolveModal
        open={resolveModal !== null}
        disputeId={resolveModal?.id || null}
        initialStatus={resolveModal?.initialStatus || "RESOLVED"}
        busy={busyResolve === resolveModal?.id}
        onClose={() => setResolveModal(null)}
        onSubmit={resolveDispute}
      />
      <DamageReportResolveModal
        open={drResolveModal !== null}
        reportId={drResolveModal?.id || null}
        bookingId={drResolveModal?.bookingId || null}
        busy={busyResolveDr === drResolveModal?.id}
        onClose={() => setDrResolveModal(null)}
        onSubmit={resolveDamageReport}
      />
    </>
  );
}
