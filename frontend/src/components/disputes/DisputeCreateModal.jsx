import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Field, TextAreaField } from "../ui/Field";

export default function DisputeCreateModal({
  open,
  bookingId,
  busy,
  onClose,
  onSubmit,
  defaultReason = "",
}) {
  const [reason, setReason] = useState(defaultReason);
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason(defaultReason || "");
    setDetails("");
  }, [open, defaultReason, bookingId]);

  async function handleSubmit(e) {
    e.preventDefault();
    const r = reason.trim();
    if (r.length < 3) return;
    await onSubmit({ bookingId, reason: r, details: details.trim() || null });
  }

  return (
    <Modal open={open} title={bookingId ? `Open Dispute for Booking #${bookingId}` : "Open Dispute"} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <Field
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Vehicle issue"
          required
        />
        <TextAreaField
          label="Details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          placeholder="Describe what happened."
        />
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={reason.trim().length < 3}>
            Submit Dispute
          </Button>
        </div>
      </form>
    </Modal>
  );
}
