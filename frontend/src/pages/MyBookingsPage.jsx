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

export default function MyBookingsPage({ isAuthed, notify, onAuthError }) {
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(false);
  const [busyCancel, setBusyCancel] = useState(null);

  async function fetchMine() {
    setBusy(true);
    try {
      const data = await apiFetch("/bookings/mine", { onAuthError });
      setMine(Array.isArray(data) ? data : []);
    } catch {
      setMine([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (isAuthed) fetchMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  async function cancelBooking(bookingId) {
    setBusyCancel(bookingId);
    try {
      await apiFetch(`/bookings/${bookingId}/cancel`, { method: "POST", onAuthError });
      notify(`Booking #${bookingId} cancelled`, "ok");
      await fetchMine();
    } catch (err) {
      notify(`Cancel error: ${err.message}`, "bad");
    } finally {
      setBusyCancel(null);
    }
  }

  return (
    <Card title="My Bookings" subtitle="Your booking requests (renter view).">
      {!isAuthed ? (
        <p className="muted">Login to view your bookings.</p>
      ) : busy && mine.length === 0 ? (
        <p className="muted">Loading…</p>
      ) : mine.length === 0 ? (
        <p className="muted">No bookings yet.</p>
      ) : (
        <div className="stack">
          {mine.map((b) => {
            const canCancel =
              b.status === "PENDING" ||
              (b.status === "APPROVED" &&
                new Date(b.start_date).getTime() > Date.now());

            return (
              <div className="rowCard" key={b.id}>
                <div className="rowCardMain">
                  <div className="rowCardTitle">
                    Booking #{b.id}{" "}
                    <span className="muted">· car #{b.car_id}</span>
                  </div>
                  <div className="rowCardSub">
                    Dates: <span className="mono">{b.start_date}</span> →{" "}
                    <span className="mono">{b.end_date}</span>
                  </div>
                  <div className="rowCardSub">
                    Status:{" "}
                    <Badge tone={bookingStatusTone(b.status)}>{b.status}</Badge>
                  </div>
                </div>

                <div className="rowCardActions">
                  <Button
                    variant="danger"
                    onClick={() => cancelBooking(b.id)}
                    disabled={!canCancel}
                    loading={busyCancel === b.id}
                  >
                    Cancel
                  </Button>
                  {!canCancel ? (
                    <span className="tiny muted">Cannot cancel</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
