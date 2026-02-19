import { useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import Badge from "../components/ui/Badge";
import DisputeResolveModal from "../components/disputes/DisputeResolveModal";
import { apiFetch } from "../lib/api";

function disputeTone(status) {
  if (status === "OPEN") return "warn";
  if (status === "RESOLVED") return "ok";
  if (status === "REJECTED") return "bad";
  return "warn";
}

export default function AdminPage({ notify, onAuthError }) {
  const [userId, setUserId] = useState("1");
  const [disputes, setDisputes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [busyLoad, setBusyLoad] = useState(false);
  const [busyResolve, setBusyResolve] = useState(null);
  const [resolveModal, setResolveModal] = useState(null);

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
    </>
  );
}
