import { useEffect, useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { SelectField, TextAreaField } from "./ui/Field";

export default function DamageReportResolveModal({
  open,
  reportId,
  bookingId,
  busy,
  onClose,
  onSubmit,
}) {
  const [status, setStatus] = useState("RESOLVED");
  const [depositDecision, setDepositDecision] = useState("release_to_renter");
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setStatus("RESOLVED");
    setDepositDecision("release_to_renter");
    setAdminNote("");
  }, [open, reportId]);

  async function handleSubmit(e) {
    e.preventDefault();
    await onSubmit({
      reportId,
      status,
      deposit_decision: depositDecision,
      admin_note: adminNote.trim() || null,
    });
  }

  return (
    <Modal
      open={open}
      title={reportId ? `Resolve Damage Report #${reportId}` : "Resolve Damage Report"}
      onClose={onClose}
    >
      <form className="form" onSubmit={handleSubmit}>
        {bookingId && (
          <div className="tiny muted" style={{ marginBottom: 8 }}>
            Booking #{bookingId}
          </div>
        )}

        <SelectField
          label="Outcome"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: "RESOLVED", label: "Resolved" },
            { value: "DISMISSED", label: "Dismissed (no damage found)" },
          ]}
        />

        <div className="field">
          <span className="fieldLabel">Deposit decision</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <input
              type="radio"
              name="depositDecision"
              value="release_to_renter"
              checked={depositDecision === "release_to_renter"}
              onChange={() => setDepositDecision("release_to_renter")}
            />
            Release to renter (no damage or dismissed)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <input
              type="radio"
              name="depositDecision"
              value="forfeit_to_owner"
              checked={depositDecision === "forfeit_to_owner"}
              onChange={() => setDepositDecision("forfeit_to_owner")}
            />
            Forfeit to owner (damage confirmed)
          </label>
        </div>

        <TextAreaField
          label="Admin note (optional)"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={3}
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
