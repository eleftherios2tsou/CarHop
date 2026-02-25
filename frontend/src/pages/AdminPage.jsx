import { useCallback, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import Badge from "../components/ui/Badge";
import DisputeResolveModal from "../components/disputes/DisputeResolveModal";
import DamageReportResolveModal from "../components/DamageReportResolveModal";
import { apiFetch } from "../lib/api";

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

export default function AdminPage({ notify, onAuthError }) {
  // ── Users section state ──
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userList, setUserList] = useState(null); // null = not loaded yet
  const [userPagination, setUserPagination] = useState({ total: 0, pages: 1 });
  const [busyUsers, setBusyUsers] = useState(false);
  const [busyToggle, setBusyToggle] = useState(null); // user id being toggled

  const [userId, setUserId] = useState("1");
  const [disputes, setDisputes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [busyLoad, setBusyLoad] = useState(false);
  const [busyResolve, setBusyResolve] = useState(null);
  const [resolveModal, setResolveModal] = useState(null);
  const [damageReports, setDamageReports] = useState([]);
  const [busyLoadDr, setBusyLoadDr] = useState(false);
  const [busyResolveDr, setBusyResolveDr] = useState(null);
  const [drResolveModal, setDrResolveModal] = useState(null);

  async function adminVerifyLicense() {
    setBusy(true);
    try {
      const id = Number(userId);
      await apiFetch(`/profile/license/${id}/verify`, { method: "POST", onAuthError });
      notify(`Admin: verified license for user ${id}`, "ok");
    } catch (err) {
      notify(`Admin verify error: ${err.message}`, "bad");
    } finally {
      setBusy(false);
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

  const loadUsers = useCallback(async (page = userPage, search = userSearch) => {
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
  }, [userPage, userSearch, onAuthError, notify]);

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

  return (
    <>
      <Card title="Admin Panel" subtitle="Platform administration.">
      <div className="form" style={{ maxWidth: 820 }}>
        <div className="sectionTitle">License Verification</div>
        <Field
          label="User ID to verify licence"
          type="number"
          min="1"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <Button onClick={adminVerifyLicense} loading={busy}>
          Verify Licence
        </Button>

        <div className="divider" />

        <div className="sectionTitle">Open Disputes</div>
        <Button variant="secondary" onClick={loadOpenDisputes} loading={busyLoad}>
          Refresh Open Disputes
        </Button>

        {disputes.length === 0 ? (
          <p className="tiny muted" style={{ marginTop: 8 }}>No open disputes loaded.</p>
        ) : (
          <div className="stack" style={{ marginTop: 10 }}>
            {disputes.map((d) => (
              <div key={d.id} className="rowCard">
                <div className="rowCardMain">
                  <div className="rowCardTitle">
                    Dispute #{d.id} <span className="muted">- booking #{d.booking_id}</span>
                  </div>
                  <div className="rowCardSub">
                    Status: <Badge tone={disputeTone(d.status)}>{d.status}</Badge>
                  </div>
                  <div className="rowCardSub">
                    Opened by user #{d.opened_by_user_id} against user #{d.against_user_id}
                  </div>
                  <div className="rowCardSub">Reason: {d.reason}</div>
                  {d.details ? <div className="rowCardSub">Details: {d.details}</div> : null}
                </div>
                <div className="rowCardActions">
                  <Button
                    onClick={() => setResolveModal({ id: d.id, initialStatus: "RESOLVED" })}
                    loading={busyResolve === d.id}
                  >
                    Resolve
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setResolveModal({ id: d.id, initialStatus: "REJECTED" })}
                    loading={busyResolve === d.id}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="divider" />

        <div className="sectionTitle">Damage Reports</div>
        <Button variant="secondary" onClick={loadDamageReports} loading={busyLoadDr}>
          Refresh Damage Reports
        </Button>

        {damageReports.length === 0 ? (
          <p className="tiny muted" style={{ marginTop: 8 }}>No damage reports loaded.</p>
        ) : (
          <div className="stack" style={{ marginTop: 10 }}>
            {damageReports.map((dr) => (
              <div key={dr.id} className="rowCard">
                <div className="rowCardMain">
                  <div className="rowCardTitle">
                    Damage Report #{dr.id}{" "}
                    <span className="muted">- booking #{dr.booking_id}</span>
                  </div>
                  <div className="rowCardSub">
                    Status: <Badge tone={drTone(dr.status)}>{dr.status}</Badge>
                    <span style={{ marginLeft: 8 }} className="tiny muted">
                      Reporter: user #{dr.reporter_id}
                    </span>
                  </div>
                  <div className="rowCardSub">Description: {dr.description}</div>
                  {dr.estimated_cost_pence != null ? (
                    <div className="rowCardSub">
                      Estimated cost: £{(dr.estimated_cost_pence / 100).toFixed(2)}
                    </div>
                  ) : null}
                  {dr.admin_note ? (
                    <div className="rowCardSub">Admin note: {dr.admin_note}</div>
                  ) : null}
                </div>
                {dr.status === "OPEN" || dr.status === "UNDER_REVIEW" ? (
                  <div className="rowCardActions">
                    <Button
                      onClick={() => setDrResolveModal({ id: dr.id, bookingId: dr.booking_id })}
                      loading={busyResolveDr === dr.id}
                    >
                      Resolve
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <div className="divider" />

        <div className="sectionTitle">User Management</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Search by email or name…"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setUserPage(1);
                loadUsers(1, userSearch);
              }
            }}
          />
          <Button
            variant="secondary"
            onClick={() => { setUserPage(1); loadUsers(1, userSearch); }}
            loading={busyUsers}
          >
            Search
          </Button>
        </div>

        {userList === null ? (
          <p className="tiny muted">Use the search box above or click Search to load users.</p>
        ) : userList.length === 0 ? (
          <p className="tiny muted" style={{ marginTop: 8 }}>No users found.</p>
        ) : (
          <>
            <p className="tiny muted" style={{ marginBottom: 6 }}>
              {userPagination.total} user{userPagination.total !== 1 ? "s" : ""} — page {userPage} of {userPagination.pages}
            </p>
            <div className="stack">
              {userList.map((u) => (
                <div key={u.id} className="rowCard">
                  <div className="rowCardMain">
                    <div className="rowCardTitle">
                      #{u.id} {u.full_name}{" "}
                      <Badge tone={u.role === "ADMIN" ? "warn" : "neutral"}>{u.role}</Badge>{" "}
                      <Badge tone={u.is_active ? "ok" : "bad"}>{u.is_active ? "Active" : "Inactive"}</Badge>
                    </div>
                    <div className="rowCardSub">{u.email}</div>
                    <div className="rowCardSub tiny muted">
                      Joined {new Date(u.created_at).toLocaleDateString()}{" "}
                      · Email {u.email_verified ? "verified" : "unverified"}{" "}
                      · Licence {u.license_verified ? "verified" : "not verified"}
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
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Button
                  variant="secondary"
                  disabled={userPage <= 1 || busyUsers}
                  onClick={() => {
                    const p = userPage - 1;
                    setUserPage(p);
                    loadUsers(p, userSearch);
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={userPage >= userPagination.pages || busyUsers}
                  onClick={() => {
                    const p = userPage + 1;
                    setUserPage(p);
                    loadUsers(p, userSearch);
                  }}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
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
