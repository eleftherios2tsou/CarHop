import { useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { Field } from "../components/ui/Field";
import { apiFetch } from "../lib/api";

export default function AuthPage({ isAuthed, notify, onLoginSuccess }) {
  const [authMode, setAuthMode] = useState("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [registered, setRegistered] = useState(false);
  const [busyAuth, setBusyAuth] = useState(false);

  async function handleAuth(e) {
    e.preventDefault();
    setBusyAuth(true);
    try {
      if (authMode === "register") {
        await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            full_name: fullName,
            date_of_birth: dob,
          }),
        });
        setRegistered(true);
        notify("Account created! Check your inbox for a verification email.", "ok");
      } else {
        await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        notify("Logged in successfully.", "ok");
        await onLoginSuccess();
      }
    } catch (err) {
      notify(`Auth error: ${err.message}`, "bad");
    } finally {
      setBusyAuth(false);
    }
  }

  return (
    <div>
      <Card title="Register / Login">
        <div className="segmented">
          <button
            className={authMode === "register" ? "segBtn segBtnActive" : "segBtn"}
            onClick={() => { setAuthMode("register"); setRegistered(false); }}
            type="button"
          >
            Register
          </button>
          <button
            className={authMode === "login" ? "segBtn segBtnActive" : "segBtn"}
            onClick={() => { setAuthMode("login"); setRegistered(false); }}
            type="button"
          >
            Login
          </button>
        </div>

        {registered ? (
          <div style={{
            marginTop: 16,
            padding: "16px",
            background: "var(--ok-bg)",
            border: "1px solid var(--ok-line)",
            borderRadius: 8,
            color: "var(--ok-text)",
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Check your inbox</div>
            <div className="tiny">
              A verification link has been sent to <strong>{email}</strong>.<br />
              Click the link in the email to activate your account, then log in here.
            </div>
            <button
              className="tiny"
              style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer", color: "var(--ok-text)", textDecoration: "underline", padding: 0 }}
              onClick={() => { setAuthMode("login"); setRegistered(false); }}
            >
              Go to login
            </button>
          </div>
        ) : (
          <form className="form" onSubmit={handleAuth}>
            <Field
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@carhop.com"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
            />
            {authMode === "register" && (
              <>
                <Field
                  label="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <Field
                  label="Date of birth"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </>
            )}
            <Button type="submit" loading={busyAuth}>
              {authMode === "register" ? "Create account" : "Login"}
            </Button>
          </form>
        )}

        <div className="divider" />
        <div className="inline">
          <span className="muted">Status:</span>{" "}
          {isAuthed ? (
            <Badge tone="ok">Logged in</Badge>
          ) : (
            <Badge tone="bad">Not logged in</Badge>
          )}
        </div>
      </Card>
    </div>
  );
}
