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

function disputeTone(status) {
  if (status === "OPEN") return "warn";
  if (status === "RESOLVED") return "ok";
  if (status === "REJECTED") return "bad";
  return "warn";
}

function paymentTone(status) {
  if (status === "HELD_IN_ESCROW") return "warn";
  if (status === "RELEASED_TO_OWNER") return "ok";
  if (status === "REFUNDED") return "bad";
  return "warn";
}

export default function IncomingBookingsPage({ profile, isAuthed, notify, onAuthError }) {
  const [incoming, setIncoming] = useState([]);
  const [messagesByBooking, setMessagesByBooking] = useState({});
  const [disputesByBooking, setDisputesByBooking] = useState({});
  const [paymentsByBooking, setPaymentsByBooking] = useState({});
  const [messageDrafts, setMessageDrafts] = useState({});
  const [openThreadId, setOpenThreadId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyDecision, setBusyDecision] = useState(null);
  const [busyThreadLoad, setBusyThreadLoad] = useState(null);
  const [busyThreadSend, setBusyThreadSend] = useState(null);
  const [busyDispute, setBusyDispute] = useState(null);
  const [busyPaymentAction, setBusyPaymentAction] = useState(null);

  async function fetchIncoming() {
    setBusy(true);
    try {
      const data = await apiFetch("/bookings/incoming", { onAuthError });
      const list = Array.isArray(data) ? data : [];
      setIncoming(list);
      await Promise.all(list.map((b) => loadDispute(b.id, false)));
      await Promise.all(list.map((b) => loadPayment(b.id, false)));
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
      notify(`Booking #${bookingId} approved`, "ok");
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

  async function loadDispute(bookingId, showError = true) {
    try {
      const dispute = await apiFetch(`/disputes/booking/${bookingId}`, { onAuthError });
      setDisputesByBooking((prev) => ({ ...prev, [bookingId]: dispute }));
    } catch (err) {
      if (String(err?.message || "").includes("No dispute")) {
        setDisputesByBooking((prev) => ({ ...prev, [bookingId]: null }));
      } else if (showError) {
        notify(`Dispute load error: ${err.message}`, "bad");
      }
    }
  }

  async function loadPayment(bookingId, showError = true) {
    try {
      const payment = await apiFetch(`/payments/booking/${bookingId}`, { onAuthError });
      setPaymentsByBooking((prev) => ({ ...prev, [bookingId]: payment }));
    } catch (err) {
      if (String(err?.message || "").includes("No payment")) {
        setPaymentsByBooking((prev) => ({ ...prev, [bookingId]: null }));
      } else if (showError) {
        notify(`Payment load error: ${err.message}`, "bad");
      }
    }
  }

  async function releaseEscrow(bookingId) {
    setBusyPaymentAction(bookingId);
    try {
      await apiFetch(`/payments/booking/${bookingId}/release`, {
        method: "POST",
        onAuthError,
      });
      notify(`Escrow released for booking #${bookingId}`, "ok");
      await loadPayment(bookingId);
    } catch (err) {
      notify(`Escrow release error: ${err.message}`, "bad");
    } finally {
      setBusyPaymentAction(null);
    }
  }

  async function openDispute(bookingId) {
    const reason = window.prompt("Dispute reason (short title):", "Renter issue");
    if (!reason || !reason.trim()) return;
    const details = window.prompt("Dispute details:", "Describe what happened.");

    setBusyDispute(bookingId);
    try {
      await apiFetch(`/disputes/booking/${bookingId}`, {
        method: "POST",
        onAuthError,
        body: JSON.stringify({ reason: reason.trim(), details: (details || "").trim() || null }),
      });
      notify(`Dispute opened for booking #${bookingId}`, "ok");
      await loadDispute(bookingId);
    } catch (err) {
      notify(`Open dispute error: ${err.message}`, "bad");
    } finally {
      setBusyDispute(null);
    }
  }

  async function loadThread(bookingId) {
    setBusyThreadLoad(bookingId);
    try {
      const data = await apiFetch(`/messages/booking/${bookingId}`, { onAuthError });
      setMessagesByBooking((prev) => ({
        ...prev,
        [bookingId]: Array.isArray(data) ? data : [],
      }));
    } catch (err) {
      notify(`Message load error: ${err.message}`, "bad");
    } finally {
      setBusyThreadLoad(null);
    }
  }

  async function toggleThread(bookingId) {
    if (openThreadId === bookingId) {
      setOpenThreadId(null);
      return;
    }
    setOpenThreadId(bookingId);
    await loadThread(bookingId);
  }

  function setMessageDraft(bookingId, content) {
    setMessageDrafts((prev) => ({ ...prev, [bookingId]: content }));
  }

  async function sendMessage(bookingId) {
    const raw = messageDrafts[bookingId] || "";
    const content = raw.trim();
    if (!content) return;

    setBusyThreadSend(bookingId);
    try {
      await apiFetch(`/messages/booking/${bookingId}`, {
        method: "POST",
        onAuthError,
        body: JSON.stringify({ content }),
      });
      setMessageDrafts((prev) => ({ ...prev, [bookingId]: "" }));
      await loadThread(bookingId);
    } catch (err) {
      notify(`Message send error: ${err.message}`, "bad");
    } finally {
      setBusyThreadSend(null);
    }
  }

  return (
    <Card
      title="Incoming Booking Requests"
      subtitle="Owners can approve/reject requests, message renters, and open disputes."
    >
      {!isAuthed ? (
        <p className="muted">Login to view incoming bookings.</p>
      ) : busy && incoming.length === 0 ? (
        <p className="muted">Loading...</p>
      ) : incoming.length === 0 ? (
        <p className="muted">No incoming bookings.</p>
      ) : (
        <div className="stack">
          {incoming.map((b) => {
            const thread = messagesByBooking[b.id] || [];
            const threadOpen = openThreadId === b.id;
            const dispute = disputesByBooking[b.id];
            const payment = paymentsByBooking[b.id];

            return (
              <div className="rowCard" key={b.id}>
                <div className="rowCardMain">
                  <div className="rowCardTitle">
                    Booking #{b.id}{" "}
                    <span className="muted">- car #{b.car_id} - renter #{b.renter_id}</span>
                  </div>
                  <div className="rowCardSub">
                    Dates: <span className="mono">{b.start_date}</span> to <span className="mono">{b.end_date}</span>
                  </div>
                  <div className="rowCardSub">
                    Status: <Badge tone={bookingStatusTone(b.status)}>{b.status}</Badge>
                    {dispute ? (
                      <span style={{ marginLeft: 8 }}>
                        <Badge tone={disputeTone(dispute.status)}>Dispute: {dispute.status}</Badge>
                      </span>
                    ) : null}
                    {payment ? (
                      <span style={{ marginLeft: 8 }}>
                        <Badge tone={paymentTone(payment.status)}>Payment: {payment.status}</Badge>
                      </span>
                    ) : null}
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

                  <Button
                    variant="secondary"
                    onClick={() => toggleThread(b.id)}
                    loading={busyThreadLoad === b.id}
                  >
                    {threadOpen ? "Hide Messages" : "Messages"}
                  </Button>

                  {!dispute ? (
                    <Button
                      variant="secondary"
                      onClick={() => openDispute(b.id)}
                      loading={busyDispute === b.id}
                      disabled={b.status === "PENDING"}
                    >
                      Open Dispute
                    </Button>
                  ) : null}

                  {payment?.status === "HELD_IN_ESCROW" ? (
                    <Button
                      variant="secondary"
                      onClick={() => releaseEscrow(b.id)}
                      loading={busyPaymentAction === b.id}
                    >
                      Release Escrow
                    </Button>
                  ) : null}
                </div>

                {threadOpen ? (
                  <div style={{ width: "100%", marginTop: 12 }}>
                    <div className="tiny muted" style={{ marginBottom: 6 }}>
                      Booking chat
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        maxHeight: 180,
                        overflowY: "auto",
                        padding: 8,
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                      }}
                    >
                      {thread.length === 0 ? (
                        <span className="tiny muted">No messages yet.</span>
                      ) : (
                        thread.map((m) => (
                          <div
                            key={m.id}
                            style={{
                              alignSelf: m.sender_id === profile?.id ? "flex-end" : "flex-start",
                              background: m.sender_id === profile?.id ? "var(--acc-weak)" : "var(--panel)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              padding: "6px 8px",
                              maxWidth: "75%",
                            }}
                          >
                            <div className="tiny muted">user #{m.sender_id}</div>
                            <div>{m.content}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="row" style={{ marginTop: 8 }}>
                      <input
                        className="input"
                        value={messageDrafts[b.id] || ""}
                        onChange={(e) => setMessageDraft(b.id, e.target.value)}
                        placeholder="Write a message"
                      />
                      <Button onClick={() => sendMessage(b.id)} loading={busyThreadSend === b.id}>
                        Send
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
