import { useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { apiFetch } from "../lib/api";

export default function AdminPage({ notify, onAuthError }) {
  const [userId, setUserId] = useState("1");
  const [busy, setBusy] = useState(false);

  async function adminVerifyLicense() {
    setBusy(true);
    try {
      const id = Number(userId);
      await apiFetch(`/profile/license/${id}/verify`, { method: "POST", onAuthError });
      notify(`Admin: verified license for user ${id} ✅`, "ok");
    } catch (err) {
      notify(`Admin verify error: ${err.message}`, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Admin Panel" subtitle="Platform administration.">
      <div className="form" style={{ maxWidth: 520 }}>
        <div className="sectionTitle">License Verification</div>
        <Field
          label="User ID to verify licence"
          type="number"
          min="1"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <Button onClick={adminVerifyLicense} loading={busy}>
          Verify Licence
        </Button>
      </div>
    </Card>
  );
}
