import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { SelectField, TextAreaField } from "../ui/Field";

export default function DisputeResolveModal({
  open,
  disputeId,
  initialStatus = "RESOLVED",
  busy,
  onClose,
  onSubmit,
}) {
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setStatus(initialStatus);
    setNote("");
  }, [open, initialStatus, disputeId]);

  async function handleSubmit(e) {
    e.preventDefault();
    await onSubmit({
      disputeId,
      status,
      resolution_note: note.trim() || null,
    });
  }

  return (
    <Modal open={open} title={disputeId ? `Resolve Dispute #${disputeId}` : "Resolve Dispute"} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <SelectField
          label="Outcome"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: "RESOLVED", label: "Resolved" },
            { value: "REJECTED", label: "Rejected" },
          ]}
        />
        <TextAreaField
          label="Resolution note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Optional note for audit trail"
        />
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Apply Decision
          </Button>
        </div>
      </form>
    </Modal>
  );
}
