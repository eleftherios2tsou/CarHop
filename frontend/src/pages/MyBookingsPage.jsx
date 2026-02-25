import { useState, useEffect, useRef } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import StateNotice from "../components/ui/StateNotice";
import DisputeCreateModal from "../components/disputes/DisputeCreateModal";
import { apiFetch } from "../lib/api";

function cancelRefundLabel(policy, startDate) {
  const hours = (new Date(startDate) - Date.now()) / 3600000;
  const pct =
    policy === "FLEXIBLE"  ? (hours >= 24  ? 100 : 0) :
    policy === "MODERATE"  ? (hours >= 120 ? 100 : hours >= 24 ? 50 : 0) :
    policy === "STRICT"    ? (hours >= 168 ? 100 : hours >= 48 ? 50 : 0) : 100;
  return pct === 100
    ? `Per the ${policy} policy, you will receive a full refund.`
    : pct === 50
    ? `Per the ${policy} policy, you will receive a 50% refund.`
    : `Per the ${policy} policy, no refund applies at this stage.`;
}

function bookingStatusTone(status) {
  if (status === "PENDING") return "warn";
  if (status === "APPROVED") return "ok";
  if (status === "COMPLETED") return "ok";
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
  if (status === "PAYMENT_FAILED") return "bad";
  if (status === "REFUNDED") return "bad";
  return "warn";
}

function depositTone(status) {
  if (status === "HELD") return "warn";
  if (status === "RELEASED") return "ok";
  if (status === "FORFEITED") return "bad";
  return "warn";
}

function canLeaveReview(booking, reviewedIds) {
  if (booking.status !== "APPROVED" && booking.status !== "COMPLETED") return false;
  if (reviewedIds.has(booking.id)) return false;
  const now = new Date();
  const endOfBookingDay = new Date(`${booking.end_date}T23:59:59`);
  return endOfBookingDay < now;
}

const PAGE_SIZE = 20;

export default function MyBookingsPage({ profile, isAuthed, notify, onAuthError }) {
  const [mine, setMine] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [myReviews, setMyReviews] = useState([]);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [messagesByBooking, setMessagesByBooking] = useState({});
  const [disputesByBooking, setDisputesByBooking] = useState({});
  const [paymentsByBooking, setPaymentsByBooking] = useState({});
  const [messageDrafts, setMessageDrafts] = useState({});
  const [openThreadId, setOpenThreadId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyCancel, setBusyCancel] = useState(null);
  const [busyReview, setBusyReview] = useState(null);
  const [busyThreadLoad, setBusyThreadLoad] = useState(null);
  const [busyThreadSend, setBusyThreadSend] = useState(null);
  const [busyDispute, setBusyDispute] = useState(null);
  const [busyPay, setBusyPay] = useState(null);
  const [disputeModalBookingId, setDisputeModalBookingId] = useState(null);
  const pollRef = useRef(null);

  async function fetchMine(targetPage = page) {
    setBusy(true);
    try {
      const [bookingsResp, reviews] = await Promise.all([
        apiFetch(`/bookings/mine?page=${targetPage}&page_size=${PAGE_SIZE}`, { onAuthError }),
        apiFetch("/reviews/mine", { onAuthError }),
      ]);
      const list = Array.isArray(bookingsResp?.items) ? bookingsResp.items : [];
      setMine(list);
      setTotal(bookingsResp?.total ?? 0);
      setMyReviews(Array.isArray(reviews) ? reviews : []);
      await Promise.all(list.map((b) => loadDispute(b.id, false)));
      await Promise.all(list.map((b) => loadPayment(b.id, false)));
    } catch {
      setMine([]);
      setMyReviews([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (isAuthed) fetchMine(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, page]);

  // Poll the open thread every 5s (silently, no loading flicker)
  useEffect(() => {
    if (!openThreadId) return;
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch(`/messages/booking/${openThreadId}`, { onAuthError });
        setMessagesByBooking((prev) => ({
          ...prev,
          [openThreadId]: Array.isArray(data) ? data : [],
        }));
      } catch {
        // ignore polling errors silently
      }
    }, 5000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openThreadId]);

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

  function setReviewDraft(bookingId, patch) {
    setReviewDrafts((prev) => ({
      ...prev,
      [bookingId]: {
        rating: prev[bookingId]?.rating || 5,
        comment: prev[bookingId]?.comment || "",
        ...patch,
      },
    }));
  }

  async function submitReview(bookingId) {
    const draft = reviewDrafts[bookingId] || { rating: 5, comment: "" };
    setBusyReview(bookingId);
    try {
      await apiFetch(`/reviews/${bookingId}/car`, {
        method: "POST",
        onAuthError,
        body: JSON.stringify({
          rating: Number(draft.rating || 5),
          comment: draft.comment?.trim() || null,
        }),
      });
      notify(`Review added for booking #${bookingId}`, "ok");
      await fetchMine();
    } catch (err) {
      notify(`Review error: ${err.message}`, "bad");
    } finally {
      setBusyReview(null);
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

  async function payEscrow(bookingId) {
    setBusyPay(bookingId);
    try {
      const data = await apiFetch(`/payments/booking/${bookingId}/pay`, { method: "POST", onAuthError });
      if (data?.checkout_url) {
        notify("Redirecting to Stripe Checkout...", "info");
        window.location.assign(data.checkout_url);
        return;
      }
      notify(`Escrow funded for booking #${bookingId}`, "ok");
      await loadPayment(bookingId);
    } catch (err) {
      notify(`Payment error: ${err.message}`, "bad");
    } finally {
      setBusyPay(null);
    }
  }

  async function openDispute({ bookingId, reason, details }) {
    setBusyDispute(bookingId);
    try {
      await apiFetch(`/disputes/booking/${bookingId}`, {
        method: "POST",
        onAuthError,
        body: JSON.stringify({ reason: reason.trim(), details: (details || "").trim() || null }),
      });
      notify(`Dispute opened for booking #${bookingId}`, "ok");
      await loadDispute(bookingId);
      setDisputeModalBookingId(null);
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

  const reviewedIds = new Set(myReviews.map((r) => r.booking_id));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Card title="My Bookings" subtitle="Your booking requests (renter view).">
      {!isAuthed ? (
        <StateNotice title="Login required" detail="Sign in to view your booking history." />
      ) : busy && mine.length === 0 ? (
        <StateNotice title="Loading bookings..." detail="Fetching your latest booking activity." />
      ) : mine.length === 0 ? (
        <StateNotice title="No bookings yet" detail="Request your first trip from the marketplace." />
      ) : (
        <>
          <div className="stack">
            {mine.map((b) => {
              const canCancel =
                b.status === "PENDING" ||
                (b.status === "APPROVED" && new Date(b.start_date).getTime() > Date.now());
              const canReview = canLeaveReview(b, reviewedIds);
              const reviewDraft = reviewDrafts[b.id] || { rating: 5, comment: "" };
              const thread = messagesByBooking[b.id] || [];
              const threadOpen = openThreadId === b.id;
              const dispute = disputesByBooking[b.id];
              const payment = paymentsByBooking[b.id];
              const canPayEscrow =
                (b.status === "APPROVED" || b.status === "COMPLETED") &&
                (!payment || payment.status === "PAYMENT_FAILED");

              return (
                <div className="rowCard" key={b.id}>
                  <div className="rowCardMain">
                    <div className="rowCardTitle">
                      Booking #{b.id} <span className="muted">- car #{b.car_id}</span>
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
                        <span style={{ marginLeft: 8, display: "inline-flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                          <Badge tone={paymentTone(payment.status)}>{payment.status}</Badge>
                          <span className="tiny muted">Rental: £{Number(payment.amount_total).toFixed(2)}</span>
                          <span className="tiny muted">Deposit: £{(payment.deposit_amount_pence / 100).toFixed(2)}</span>
                          <Badge tone={depositTone(payment.deposit_status)}>Deposit {payment.deposit_status}</Badge>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="rowCardActions">
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (b.status === "APPROVED") {
                          const msg = cancelRefundLabel(b.car_cancellation_policy || "FLEXIBLE", b.start_date);
                          if (!window.confirm(`${msg}\n\nProceed with cancellation?`)) return;
                        }
                        cancelBooking(b.id);
                      }}
                      disabled={!canCancel}
                      loading={busyCancel === b.id}
                    >
                      Cancel
                    </Button>

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
                        onClick={() => setDisputeModalBookingId(b.id)}
                        loading={busyDispute === b.id}
                        disabled={b.status === "PENDING"}
                      >
                        Open Dispute
                      </Button>
                    ) : null}

                    {canPayEscrow ? (
                      <Button
                        variant="secondary"
                        onClick={() => payEscrow(b.id)}
                        loading={busyPay === b.id}
                      >
                        Pay Escrow
                      </Button>
                    ) : null}

                    {canReview ? (
                      <>
                        <label className="field">
                          <span className="fieldLabel">Rating</span>
                          <select
                            className="input"
                            value={reviewDraft.rating}
                            onChange={(e) => setReviewDraft(b.id, { rating: Number(e.target.value) })}
                          >
                            <option value={5}>5</option>
                            <option value={4}>4</option>
                            <option value={3}>3</option>
                            <option value={2}>2</option>
                            <option value={1}>1</option>
                          </select>
                        </label>

                        <label className="field">
                          <span className="fieldLabel">Comment</span>
                          <input
                            className="input"
                            type="text"
                            value={reviewDraft.comment}
                            onChange={(e) => setReviewDraft(b.id, { comment: e.target.value })}
                            placeholder="How was the owner and car?"
                            maxLength={1000}
                          />
                        </label>

                        <Button onClick={() => submitReview(b.id)} loading={busyReview === b.id}>
                          Leave Review
                        </Button>
                      </>
                    ) : null}

                    {!canCancel ? <span className="tiny muted">Cannot cancel</span> : null}
                    {reviewedIds.has(b.id) ? <span className="tiny muted">Reviewed</span> : null}
                  </div>

                  {threadOpen ? (
                    <div style={{ width: "100%", marginTop: 12 }}>
                      <div className="tiny muted" style={{ marginBottom: 6 }}>
                        Booking chat — updates every 5 seconds
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          maxHeight: 180,
                          overflowY: "auto",
                          padding: 8,
                          border: "1px solid var(--line)",
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
                                background: m.sender_id === profile?.id ? "var(--brand-soft)" : "var(--surface-alt)",
                                border: "1px solid var(--line)",
                                borderRadius: 8,
                                padding: "6px 8px",
                                maxWidth: "75%",
                              }}
                            >
                              <div className="tiny muted">{m.sender_name}</div>
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

          {totalPages > 1 ? (
            <div className="row" style={{ justifyContent: "center", marginTop: 16, gap: 8 }}>
              <Button
                variant="secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || busy}
              >
                Previous
              </Button>
              <span className="tiny muted" style={{ alignSelf: "center" }}>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || busy}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
      </Card>
      <DisputeCreateModal
        open={disputeModalBookingId !== null}
        bookingId={disputeModalBookingId}
        defaultReason="Vehicle issue"
        busy={busyDispute === disputeModalBookingId}
        onClose={() => setDisputeModalBookingId(null)}
        onSubmit={openDispute}
      />
    </>
  );
}
