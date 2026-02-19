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
  const [verificationToken, setVerificationToken] = useState("");
  const [busyAuth, setBusyAuth] = useState(false);
  const [busyVerify, setBusyVerify] = useState(false);

  async function handleAuth(e) {
    e.preventDefault();
    setBusyAuth(true);
    try {
      if (authMode === "register") {
        const data = await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            full_name: fullName,
            date_of_birth: dob,
          }),
        });
        if (data?.verification_token) setVerificationToken(data.verification_token);
        notify("Registered successfully. Verify your email using the token below.", "ok");
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

  async function handleVerifyEmail() {
    setBusyVerify(true);
    try {
      await apiFetch(`/auth/verify-email/${verificationToken}`, { method: "POST" });
      notify("Email verified. You can now login.", "ok");
      setAuthMode("login");
      setVerificationToken("");
    } catch (err) {
      notify(`Verify error: ${err.message}`, "bad");
    } finally {
      setBusyVerify(false);
    }
  }

  async function handleLoginAfterVerify() {
    setBusyAuth(true);
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      notify("Logged in successfully.", "ok");
      await onLoginSuccess();
    } catch (err) {
      notify(`Login error: ${err.message}`, "bad");
    } finally {
      setBusyAuth(false);
    }
  }

  return (
    <div className="twoCol">
      <Card title="Register / Login" subtitle="Cookie auth with CSRF and refresh tokens.">
        <div className="segmented">
          <button
            className={authMode === "register" ? "segBtn segBtnActive" : "segBtn"}
            onClick={() => setAuthMode("register")}
            type="button"
          >
            Register
          </button>
          <button
            className={authMode === "login" ? "segBtn segBtnActive" : "segBtn"}
            onClick={() => setAuthMode("login")}
            type="button"
          >
            Login
          </button>
        </div>

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
          {authMode === "register" ? (
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
          ) : null}
          <Button type="submit" loading={busyAuth}>
            {authMode === "register" ? "Create account" : "Login"}
          </Button>
        </form>

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

      <Card
        title="Email Verification"
        subtitle="Register returns a verification token (simulated email)."
      >
        <div className="form">
          <Field
            label="Verification token"
            value={verificationToken}
            onChange={(e) => setVerificationToken(e.target.value)}
            placeholder="paste token here"
          />
          <div className="row">
            <Button
              onClick={handleVerifyEmail}
              loading={busyVerify}
              disabled={!verificationToken}
            >
              Verify Email
            </Button>
            <Button
              variant="secondary"
              onClick={handleLoginAfterVerify}
              loading={busyAuth}
              disabled={!verificationToken}
            >
              Login after verify
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
