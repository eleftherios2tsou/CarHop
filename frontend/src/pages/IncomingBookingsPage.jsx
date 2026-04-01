import { useState, useEffect, useRef } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import StateNotice from "../components/ui/StateNotice";
import DisputeCreateModal from "../components/disputes/DisputeCreateModal";
import DamageReportModal from "../components/DamageReportModal";
import { apiFetch, apiFetchForm } from "../lib/api";

// platform-wide check-in / check-out policy
const CHECK_IN_TIME  = "2:00 PM";
const CHECK_OUT_TIME = "10:00 AM";

// formats "2025-01-12" → "12 Jan 2025"
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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

const PAGE_SIZE = 20;

export default function IncomingBookingsPage({ profile, isAuthed, notify, onAuthError }) {
  const [incoming, setIncoming] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
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
  const [disputeModalBookingId, setDisputeModalBookingId] = useState(null);
  const [damageReportsByBooking, setDamageReportsByBooking] = useState({});
  const [damageModalBookingId, setDamageModalBookingId] = useState(null);
  const [busyDamageReport, setBusyDamageReport] = useState(null);
  const [ownerReviews, setOwnerReviews] = useState([]);
  const [renterReviewDrafts, setRenterReviewDrafts] = useState({});
  const [busyRenterReview, setBusyRenterReview] = useState(null);
  const [renterRatings, setRenterRatings] = useState({}); // renter_id -> { avg, count }
  const pollRef = useRef(null);

  // ── Unread message tracking ──────────────────────────────────────────────
  function getSeenId(bookingId) {
    return Number(localStorage.getItem(`ch_msg_seen_${bookingId}`) ?? 0);
  }
  function markSeen(bookingId, messages) {
    const maxId = Math.max(0, ...messages.map((m) => m.id));
    if (maxId > 0) localStorage.setItem(`ch_msg_seen_${bookingId}`, String(maxId));
  }
  function hasUnread(bookingId) {
    const msgs = messagesByBooking[bookingId];
    if (!msgs || msgs.length === 0) return false;
    const latestId = Math.max(...msgs.map((m) => m.id));
    return latestId > getSeenId(bookingId);
  }

  async function fetchIncoming(targetPage = page) {
    setBusy(true);
    try {
      const data = await apiFetch(`/bookings/incoming?page=${targetPage}&page_size=${PAGE_SIZE}`, { onAuthError });
      const list = Array.isArray(data?.items) ? data.items : [];
      setIncoming(list);
      setTotal(data?.total ?? 0);
      await Promise.all(list.map((b) => loadDispute(b.id, false)));
      await Promise.all(list.map((b) => loadPayment(b.id, false)));
      await Promise.all(
        list.filter((b) => b.status === "COMPLETED").map((b) => loadDamageReport(b.id, false))
      );
      const reviews = await apiFetch("/reviews/mine", { onAuthError }).catch(() => []);
      setOwnerReviews(Array.isArray(reviews) ? reviews : []);

      // Batch-fetch renter ratings (deduplicated)
      const renterIds = [...new Set(list.map((b) => b.renter_id))];
      const ratingEntries = await Promise.all(
        renterIds.map(async (rid) => {
          try {
            const rreviews = await apiFetch(`/reviews/user/${rid}`, { onAuthError });
            const renterOnly = (Array.isArray(rreviews) ? rreviews : []).filter(
              (r) => r.review_type === "RENTER_REVIEW"
            );
            if (renterOnly.length === 0) return [rid, null];
            const avg = renterOnly.reduce((sum, r) => sum + r.rating, 0) / renterOnly.length;
            return [rid, { avg: Math.round(avg * 10) / 10, count: renterOnly.length }];
          } catch {
            return [rid, null];
          }
        })
      );
      setRenterRatings(Object.fromEntries(ratingEntries));
    } catch {
      setIncoming([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (isAuthed) fetchIncoming(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, page]);

  // Poll the open thread every 5s (silently, no loading flicker)
  useEffect(() => {
    if (!openThreadId) return;
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch(`/messages/booking/${openThreadId}`, { onAuthError });
        const msgs = Array.isArray(data) ? data : [];
        setMessagesByBooking((prev) => ({ ...prev, [openThreadId]: msgs }));
        markSeen(openThreadId, msgs); // thread is open, so mark as read
      } catch {
        // ignore polling errors silently
      }
    }, 5000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openThreadId]);

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

  async function loadDamageReport(bookingId, showError = true) {
    try {
      const report = await apiFetch(`/damage-reports/booking/${bookingId}`, { onAuthError });
      setDamageReportsByBooking((prev) => ({ ...prev, [bookingId]: report }));
    } catch (err) {
      if (String(err?.message || "").includes("No damage report")) {
        setDamageReportsByBooking((prev) => ({ ...prev, [bookingId]: null }));
      } else if (showError) {
        notify(`Damage report load error: ${err.message}`, "bad");
      }
    }
  }

  async function fileDamageReport({ bookingId, formData }) {
    setBusyDamageReport(bookingId);
    try {
      await apiFetchForm(`/damage-reports/booking/${bookingId}`, formData, { onAuthError });
      notify(`Damage report filed for booking #${bookingId}`, "ok");
      await loadDamageReport(bookingId);
      setDamageModalBookingId(null);
    } catch (err) {
      notify(`Damage report error: ${err.message}`, "bad");
    } finally {
      setBusyDamageReport(null);
    }
  }

  function setRenterReviewDraft(bookingId, patch) {
    setRenterReviewDrafts((prev) => ({
      ...prev,
      [bookingId]: {
        rating: prev[bookingId]?.rating || 5,
        comment: prev[bookingId]?.comment || "",
        ...patch,
      },
    }));
  }

  async function submitRenterReview(bookingId) {
    const draft = renterReviewDrafts[bookingId] || { rating: 5, comment: "" };
    setBusyRenterReview(bookingId);
    try {
      await apiFetch(`/reviews/${bookingId}/renter`, {
        method: "POST",
        onAuthError,
        body: JSON.stringify({
          rating: Number(draft.rating || 5),
          comment: draft.comment?.trim() || null,
        }),
      });
      notify(`Renter review submitted for booking #${bookingId}`, "ok");
      const reviews = await apiFetch("/reviews/mine", { onAuthError }).catch(() => []);
      setOwnerReviews(Array.isArray(reviews) ? reviews : []);
    } catch (err) {
      notify(`Renter review error: ${err.message}`, "bad");
    } finally {
      setBusyRenterReview(null);
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

  async function loadThread(bookingId, markAsRead = false) {
    setBusyThreadLoad(bookingId);
    try {
      const data = await apiFetch(`/messages/booking/${bookingId}`, { onAuthError });
      const msgs = Array.isArray(data) ? data : [];
      setMessagesByBooking((prev) => ({ ...prev, [bookingId]: msgs }));
      if (markAsRead) markSeen(bookingId, msgs);
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
    await loadThread(bookingId, true); // mark as read on open
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Card
        title="Incoming Booking Requests"
        subtitle="Owners can approve/reject requests, message renters, and open disputes."
      >
      {!isAuthed ? (
        <StateNotice title="Login required" detail="Sign in to manage incoming bookings." />
      ) : busy && incoming.length === 0 ? (
        <StateNotice title="Loading incoming bookings..." detail="Checking current renter requests." />
      ) : incoming.length === 0 ? (
        <StateNotice title="No incoming bookings" detail="New booking requests will appear here." />
      ) : (
        <>
          <div className="stack">
            {incoming.map((b) => {
              const thread = messagesByBooking[b.id] || [];
              const threadOpen = openThreadId === b.id;
              const dispute = disputesByBooking[b.id];
              const payment = paymentsByBooking[b.id];
              const damageReport = damageReportsByBooking[b.id];
              const renterReviewedIds = new Set(
                ownerReviews
                  .filter((r) => r.review_type === "RENTER_REVIEW")
                  .map((r) => r.booking_id)
              );
              const canReviewRenter =
                b.status === "COMPLETED" &&
                !renterReviewedIds.has(b.id) &&
                new Date(`${b.end_date}T23:59:59`) < new Date();
              const renterReviewDraft = renterReviewDrafts[b.id] || { rating: 5, comment: "" };

              return (
                <div className="rowCard" key={b.id}>
                  <div className="rowCardMain">
                    <div className="rowCardTitle">
                      Booking #{b.id}{" "}
                      <span className="muted">- car #{b.car_id}</span>
                      {" "}
                      <span className="muted">
                        - renter #{b.renter_id}
                        {renterRatings[b.renter_id] ? (
                          <span style={{ marginLeft: 6 }}>
                            <Badge tone="ok">
                              ★{renterRatings[b.renter_id].avg.toFixed(1)} ({renterRatings[b.renter_id].count})
                            </Badge>
                          </span>
                        ) : renterRatings[b.renter_id] === null ? (
                          <span className="tiny muted" style={{ marginLeft: 6 }}>no reviews</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="rowCardSub" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span>🔑 Check-in: <strong>{fmtDate(b.start_date)}</strong> at {CHECK_IN_TIME}</span>
                      <span>·</span>
                      <span>🚗 Check-out: <strong>{fmtDate(b.end_date)}</strong> at {CHECK_OUT_TIME}</span>
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
                      {b.status === "COMPLETED" && damageReport ? (
                        <span style={{ marginLeft: 8 }}>
                          <Badge tone={damageReport.status === "OPEN" || damageReport.status === "UNDER_REVIEW" ? "warn" : "ok"}>
                            Damage report: {damageReport.status}
                          </Badge>
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
                      {threadOpen ? "Hide Messages" : (
                        <>
                          Messages
                          {hasUnread(b.id) && (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              marginLeft: 6,
                              minWidth: 16,
                              height: 16,
                              borderRadius: 8,
                              background: "var(--brand, #2563eb)",
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "0 4px",
                            }}>
                              !
                            </span>
                          )}
                        </>
                      )}
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

                    {payment?.status === "HELD_IN_ESCROW" ? (
                      <Button
                        variant="secondary"
                        onClick={() => releaseEscrow(b.id)}
                        loading={busyPaymentAction === b.id}
                      >
                        Release Escrow
                      </Button>
                    ) : null}

                    {b.status === "COMPLETED" && damageReport === null ? (
                      <Button
                        variant="secondary"
                        onClick={() => setDamageModalBookingId(b.id)}
                        loading={busyDamageReport === b.id}
                      >
                        File Damage Report
                      </Button>
                    ) : null}

                    {canReviewRenter ? (
                      <>
                        <label className="field">
                          <span className="fieldLabel">Renter rating</span>
                          <select
                            className="input"
                            value={renterReviewDraft.rating}
                            onChange={(e) => setRenterReviewDraft(b.id, { rating: Number(e.target.value) })}
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
                            value={renterReviewDraft.comment}
                            onChange={(e) => setRenterReviewDraft(b.id, { comment: e.target.value })}
                            placeholder="How was the renter?"
                            maxLength={1000}
                          />
                        </label>
                        <Button
                          onClick={() => submitRenterReview(b.id)}
                          loading={busyRenterReview === b.id}
                        >
                          Review Renter
                        </Button>
                      </>
                    ) : null}
                    {b.status === "COMPLETED" && renterReviewedIds.has(b.id) ? (
                      <span className="tiny muted">Renter reviewed</span>
                    ) : null}
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
        defaultReason="Renter issue"
        busy={busyDispute === disputeModalBookingId}
        onClose={() => setDisputeModalBookingId(null)}
        onSubmit={openDispute}
      />
      <DamageReportModal
        open={damageModalBookingId !== null}
        bookingId={damageModalBookingId}
        busy={busyDamageReport === damageModalBookingId}
        onClose={() => setDamageModalBookingId(null)}
        onSubmit={fileDamageReport}
      />
    </>
  );
}
