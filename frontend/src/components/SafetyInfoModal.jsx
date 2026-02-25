import { useState, useEffect } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";

export default function SafetyInfoModal({ open, onClose, onConfirm, busy, carName, days, dailyPrice, startDate, endDate }) {
  const [acknowledged, setAcknowledged] = useState(false);

  // Reset checkbox each time the modal opens
  useEffect(() => {
    if (open) setAcknowledged(false);
  }, [open]);

  return (
    <Modal open={open} title="Before you book — important information" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 0" }}>

        {carName && days > 0 ? (
          <div style={{
            background: "var(--surface-alt)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
          }}>
            <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Booking summary</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <tbody>
                <tr>
                  <td style={{ color: "var(--text-soft)", paddingBottom: 4, width: "40%" }}>Car</td>
                  <td style={{ fontWeight: 600 }}>{carName}</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-soft)", paddingBottom: 4 }}>Dates</td>
                  <td style={{ fontWeight: 600 }}>{startDate} → {endDate}</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-soft)", paddingBottom: 4 }}>Duration</td>
                  <td style={{ fontWeight: 600 }}>{days} day{days !== 1 ? "s" : ""}</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-soft)", paddingBottom: 4 }}>Daily rate</td>
                  <td style={{ fontWeight: 600 }}>£{dailyPrice}/day</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-soft)", fontWeight: 700 }}>Trip total</td>
                  <td style={{ fontWeight: 700, fontSize: 16, color: "var(--brand)" }}>£{days * dailyPrice}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          <div style={{
            background: "var(--warn-bg)",
            border: "1px solid var(--warn-line)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
          }}>
            <div style={{ fontWeight: 700, color: "var(--warn-text)", marginBottom: 4 }}>
              Insurance — you must arrange your own cover
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--warn-text)", lineHeight: 1.55 }}>
              CarHop does not provide insurance. Before your trip begins you must hold a{" "}
              <strong>fully comprehensive policy</strong> that covers driving third-party vehicles,
              or arrange specific short-term cover for the rental period. Driving without valid
              insurance is a criminal offence.
            </p>
          </div>

          <div style={{
            background: "var(--surface-alt)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
          }}>
            <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
              Condition photos — required for both parties
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-soft)", lineHeight: 1.55 }}>
              Both the owner and renter must photograph the vehicle immediately before and after
              the rental — all four sides, the interior, and the odometer reading. These photos
              are your evidence in any dispute. Failure to document the condition may affect the
              outcome of a damage claim.
            </p>
          </div>

          <div style={{
            background: "var(--surface-alt)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
          }}>
            <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
              £250 refundable security deposit
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-soft)", lineHeight: 1.55 }}>
              A <strong>£250 deposit</strong> is held alongside your rental payment and is
              returned automatically after the trip concludes with no damage report filed.
              If a damage report is raised by the owner, the deposit is held until an
              administrator reviews and resolves the case.
            </p>
          </div>

        </div>

        <label style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          cursor: "pointer",
          padding: "10px 14px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--line)",
          background: acknowledged ? "var(--ok-bg)" : "var(--surface)",
          transition: "background 0.15s",
        }}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0, accentColor: "var(--brand)" }}
          />
          <span style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.5 }}>
            I have read and understood the insurance requirements, condition photo obligations,
            and the £250 security deposit terms.
          </span>
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!acknowledged}
            loading={busy}
          >
            Confirm Booking
          </Button>
        </div>

      </div>
    </Modal>
  );
}
