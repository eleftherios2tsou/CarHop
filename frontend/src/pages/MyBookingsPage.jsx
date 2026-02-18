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

function canLeaveReview(booking, reviewedIds) {
  if (booking.status !== "APPROVED") return false;
  if (reviewedIds.has(booking.id)) return false;
  const now = new Date();
  const endOfBookingDay = new Date(`${booking.end_date}T23:59:59`);
  return endOfBookingDay < now;
}

export default function MyBookingsPage({ profile, isAuthed, notify, onAuthError }) {
  const [mine, setMine] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [messagesByBooking, setMessagesByBooking] = useState({});
  const [messageDrafts, setMessageDrafts] = useState({});
  const [openThreadId, setOpenThreadId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyCancel, setBusyCancel] = useState(null);
  const [busyReview, setBusyReview] = useState(null);
  const [busyThreadLoad, setBusyThreadLoad] = useState(null);
  const [busyThreadSend, setBusyThreadSend] = useState(null);

  async function fetchMine() {
    setBusy(true);
    try {
      const [bookings, reviews] = await Promise.all([
        apiFetch("/bookings/mine", { onAuthError }),
        apiFetch("/reviews/mine", { onAuthError }),
      ]);
      setMine(Array.isArray(bookings) ? bookings : []);
      setMyReviews(Array.isArray(reviews) ? reviews : []);
    } catch {
      setMine([]);
      setMyReviews([]);
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
      await apiFetch(`/reviews/${bookingId}`, {
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

  return (
    <Card title="My Bookings" subtitle="Your booking requests (renter view).">
      {!isAuthed ? (
        <p className="muted">Login to view your bookings.</p>
      ) : busy && mine.length === 0 ? (
        <p className="muted">Loading...</p>
      ) : mine.length === 0 ? (
        <p className="muted">No bookings yet.</p>
      ) : (
        <div className="stack">
          {mine.map((b) => {
            const canCancel =
              b.status === "PENDING" ||
              (b.status === "APPROVED" && new Date(b.start_date).getTime() > Date.now());
            const canReview = canLeaveReview(b, reviewedIds);
            const reviewDraft = reviewDrafts[b.id] || { rating: 5, comment: "" };
            const thread = messagesByBooking[b.id] || [];
            const threadOpen = openThreadId === b.id;

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

                  <Button
                    variant="secondary"
                    onClick={() => toggleThread(b.id)}
                    loading={busyThreadLoad === b.id}
                  >
                    {threadOpen ? "Hide Messages" : "Messages"}
                  </Button>

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
                      <Button
                        onClick={() => sendMessage(b.id)}
                        loading={busyThreadSend === b.id}
                      >
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
