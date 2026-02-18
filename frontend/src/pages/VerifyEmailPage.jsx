import { useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { apiFetch } from "../lib/api";

export default function VerifyEmailPage({ notify, setActive }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleVerify() {
    setBusy(true);
    try {
      await apiFetch(`/auth/verify-email/${token}`, { method: "POST" });
      notify("Email verified ✅ You can now list cars and book.", "ok");
      setActive("Profile");
    } catch (err) {
      notify(`Verify error: ${err.message}`, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Verify Email" subtitle="Paste the token sent to your email.">
      <div className="form" style={{ maxWidth: 520 }}>
        <Field
          label="Verification token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="paste token here"
        />
        <div className="row">
          <Button onClick={handleVerify} loading={busy} disabled={!token}>
            Verify
          </Button>
          <Button variant="secondary" onClick={() => setActive("Profile")}>
            Back
          </Button>
        </div>
      </div>
    </Card>
  );
}
