import { useEffect, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { Field } from "../components/ui/Field";
import { apiFetch, validatePassword } from "../lib/api";

export default function AuthPage({ isAuthed, notify, onLoginSuccess, onNavigate, resetToken }) {
  const [authMode, setAuthMode] = useState("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [busyAuth, setBusyAuth] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [busyForgot, setBusyForgot] = useState(false);

  // Reset password state
  const [newPassword, setNewPassword] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [busyReset, setBusyReset] = useState(false);

  // Resend verification state
  const [busyResend, setBusyResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");

  // Confirm password state — used on registration only
  const [confirmPassword, setConfirmPassword] = useState("");

  // If a reset token arrives via URL param, switch to reset mode
  useEffect(() => {
    if (resetToken) {
      setAuthMode("reset");
    }
  }, [resetToken]);

  async function handleAuth(e) {
    e.preventDefault();
    setBusyAuth(true);
    try {
      if (authMode === "register") {
        if (!dob) {
          notify("Please enter your date of birth.", "bad");
          return;
        }
        const pwErr = validatePassword(password);
        if (pwErr) { notify(pwErr, "bad"); return; }
        if (password !== confirmPassword) {
          notify("Passwords do not match.", "bad");
          return;
        }
        await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            full_name: fullName,
            date_of_birth: dob,
            terms_accepted: termsAccepted,
          }),
        });
        setResendEmail(email);
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

  async function handleForgot(e) {
    e.preventDefault();
    setBusyForgot(true);
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotSent(true);
    } catch (err) {
      notify(`Error: ${err.message}`, "bad");
    } finally {
      setBusyForgot(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    const pwErr = validatePassword(newPassword);
    if (pwErr) { notify(pwErr, "bad"); return; }
    setBusyReset(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: resetToken, new_password: newPassword }),
      });
      setResetDone(true);
      notify("Password updated! You can now log in.", "ok");
    } catch (err) {
      notify(`Reset error: ${err.message}`, "bad");
    } finally {
      setBusyReset(false);
    }
  }

  async function handleResend() {
    setBusyResend(true);
    try {
      await apiFetch("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: resendEmail }),
      });
      notify("Verification email resent — check your inbox.", "ok");
    } catch (err) {
      notify(`Resend error: ${err.message}`, "bad");
    } finally {
      setBusyResend(false);
    }
  }

  return (
    <div>
      <Card title="Register / Login">
        {authMode !== "forgot" && authMode !== "reset" && (
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
        )}

        {/* ── Registration success ── */}
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
            <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                className="tiny"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ok-text)", textDecoration: "underline", padding: 0 }}
                onClick={() => { setAuthMode("login"); setRegistered(false); }}
              >
                Go to login
              </button>
              <button
                className="tiny"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ok-text)", textDecoration: "underline", padding: 0 }}
                onClick={handleResend}
                disabled={busyResend}
              >
                {busyResend ? "Resending…" : "Resend verification email"}
              </button>
            </div>
          </div>
        ) : authMode === "forgot" ? (
          /* ── Forgot password form ── */
          forgotSent ? (
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
                If an account with that email exists, a reset link has been sent.<br />
                The link expires in 1 hour.
              </div>
              <button
                className="tiny"
                style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer", color: "var(--ok-text)", textDecoration: "underline", padding: 0 }}
                onClick={() => { setAuthMode("login"); setForgotSent(false); setForgotEmail(""); }}
              >
                Back to login
              </button>
            </div>
          ) : (
            <form className="form" onSubmit={handleForgot} style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Reset your password</div>
              <Field
                label="Email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@carhop.com"
              />
              <Button type="submit" loading={busyForgot} disabled={busyForgot || !forgotEmail}>
                Send Reset Link
              </Button>
              <button
                type="button"
                className="linkBtn tiny"
                style={{ marginTop: 8 }}
                onClick={() => { setAuthMode("login"); setForgotSent(false); }}
              >
                Back to login
              </button>
            </form>
          )
        ) : authMode === "reset" ? (
          /* ── Reset password form ── */
          resetDone ? (
            <div style={{
              marginTop: 16,
              padding: "16px",
              background: "var(--ok-bg)",
              border: "1px solid var(--ok-line)",
              borderRadius: 8,
              color: "var(--ok-text)",
            }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Password updated!</div>
              <div className="tiny">You can now log in with your new password.</div>
              <button
                className="tiny"
                style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer", color: "var(--ok-text)", textDecoration: "underline", padding: 0 }}
                onClick={() => { setAuthMode("login"); setResetDone(false); }}
              >
                Go to login
              </button>
            </div>
          ) : (
            <form className="form" onSubmit={handleReset} style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Set a new password</div>
              <Field
                label="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="new password"
              />
              <Button type="submit" loading={busyReset} disabled={busyReset || !newPassword}>
                Set New Password
              </Button>
            </form>
          )
        ) : (
          /* ── Login / Register form ── */
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
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="repeat password"
                />
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
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    id="terms"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    style={{ marginTop: 3, flexShrink: 0 }}
                  />
                  <label htmlFor="terms" className="tiny">
                    I agree to the{" "}
                    <button type="button" className="linkBtn" onClick={() => onNavigate?.("Terms")}>
                      Terms of Service
                    </button>
                    {" "}and{" "}
                    <button type="button" className="linkBtn" onClick={() => onNavigate?.("Privacy")}>
                      Privacy Policy
                    </button>
                  </label>
                </div>
              </>
            )}
            <Button type="submit" loading={busyAuth} disabled={busyAuth || (authMode === "register" && !termsAccepted)}>
              {authMode === "register" ? "Create account" : "Login"}
            </Button>
            {authMode === "login" && (
              <button
                type="button"
                className="linkBtn tiny"
                style={{ marginTop: 4, textAlign: "left" }}
                onClick={() => setAuthMode("forgot")}
              >
                Forgot password?
              </button>
            )}
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
