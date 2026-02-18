import { useState, useEffect } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { apiFetch } from "../lib/api";

function bookingStatusTone(status) {
  if (status === "PENDING") return "warn";
  if (status === "APPROVED") return "ok";
  if (status === "REJECTED") return "bad";
  return "warn";
}

export default function IncomingBookingsPage({ isAuthed, notify, onAuthError }) {
  const [incoming, setIncoming] = useState([]);
  const [busy, setBusy] = useState(false);
  const [busyDecision, setBusyDecision] = useState(null);

  async function fetchIncoming() {
    setBusy(true);
    try {
      const data = await apiFetch("/bookings/incoming", { onAuthError });
      setIncoming(Array.isArray(data) ? data : []);
    } catch {
      setIncoming([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (isAuthed) fetchIncoming();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  async function approveBooking(bookingId) {
    setBusyDecision(bookingId);
    try {
      await apiFetch(`/bookings/${bookingId}/approve`, { method: "POST", onAuthError });
      notify(`Booking #${bookingId} approved ✅`, "ok");
      await fetchIncoming();
    } catch (err) {
      notify(`Approve error: ${err.message}`, "bad");
    } finally {
      setBusyDecision(null);
    }
  }

  async function rejectBooking(bookingId) {
    setBusyDecision(bookingId);
    try {
      await apiFetch(`/bookings/${bookingId}/reject`, { method: "POST", onAuthError });
      notify(`Booking #${bookingId} rejected`, "ok");
      await fetchIncoming();
    } catch (err) {
      notify(`Reject error: ${err.message}`, "bad");
    } finally {
      setBusyDecision(null);
    }
  }

  return (
    <Card
      title="Incoming Booking Requests"
      subtitle="Owners can approve or reject pending requests."
    >
      {!isAuthed ? (
        <p className="muted">Login to view incoming bookings.</p>
      ) : busy && incoming.length === 0 ? (
        <p className="muted">Loading…</p>
      ) : incoming.length === 0 ? (
        <p className="muted">No incoming bookings.</p>
      ) : (
        <div className="stack">
          {incoming.map((b) => (
            <div className="rowCard" key={b.id}>
              <div className="rowCardMain">
                <div className="rowCardTitle">
                  Booking #{b.id}{" "}
                  <span className="muted">
                    · car #{b.car_id} · renter #{b.renter_id}
                  </span>
                </div>
                <div className="rowCardSub">
                  Dates: <span className="mono">{b.start_date}</span> →{" "}
                  <span className="mono">{b.end_date}</span>
                </div>
                <div className="rowCardSub">
                  Status: <Badge tone={bookingStatusTone(b.status)}>{b.status}</Badge>
                </div>
              </div>

              <div className="rowCardActions">
                {b.status === "PENDING" ? (
                  <>
                    <Button
                      onClick={() => approveBooking(b.id)}
                      loading={busyDecision === b.id}
                      disabled={busyDecision !== null && busyDecision !== b.id}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => rejectBooking(b.id)}
                      loading={busyDecision === b.id}
                      disabled={busyDecision !== null && busyDecision !== b.id}
                    >
                      Reject
                    </Button>
                  </>
                ) : (
                  <span className="tiny muted">No action</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
