// frontend/src/App.jsx
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "/api";

/* -----------------------------
   Cookie helpers (for CSRF)
------------------------------ */
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

/* -----------------------------
   Fetch helper (cookie auth)
   - Always sends cookies (HttpOnly access_token)
   - Sends CSRF header for unsafe methods (double-submit cookie)
   - onAuthError() hook for 401/403
------------------------------ */
async function apiFetch(path, { onAuthError, ...opts } = {}) {
  const headers = {
    ...(opts.headers || {}),
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
  };

  const method = (opts.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = getCookie("csrf_token");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers,
    credentials: "include", // ✅ send cookies
  });

  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  // 🔒 auth handling
  if (res.status === 401 || res.status === 403) {
    if (onAuthError) onAuthError();
    const msg =
      (data &&
        data.detail &&
        (Array.isArray(data.detail) ? JSON.stringify(data.detail) : data.detail)) ||
      `Unauthorized (${res.status})`;
    throw new Error(msg);
  }

  if (!res.ok) {
    const msg =
      (data &&
        data.detail &&
        (Array.isArray(data.detail) ? JSON.stringify(data.detail) : data.detail)) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

/* -----------------------------
   Small UI primitives
------------------------------ */
function Card({ title, subtitle, right, children }) {
  return (
    <section className="card">
      <header className="cardHeader">
        <div>
          <h2 className="cardTitle">{title}</h2>
          {subtitle ? <p className="cardSubtitle">{subtitle}</p> : null}
        </div>
        {right ? <div className="cardRight">{right}</div> : null}
      </header>
      <div className="cardBody">{children}</div>
    </section>
  );
}

function Field({ label, hint, ...props }) {
  return (
    <label className="field">
      <span className="fieldLabel">{label}</span>
      <input className="input" {...props} />
      {hint ? <span className="fieldHint">{hint}</span> : null}
    </label>
  );
}

function Button({ variant = "primary", loading, ...props }) {
  const cls =
    variant === "ghost"
      ? "btn btnGhost"
      : variant === "danger"
      ? "btn btnDanger"
      : variant === "secondary"
      ? "btn btnSecondary"
      : "btn btnPrimary";

  return (
    <button className={cls} {...props} disabled={props.disabled || loading}>
      {loading ? "Working…" : props.children}
    </button>
  );
}

function Badge({ tone = "neutral", children }) {
  const cls =
    tone === "ok"
      ? "badge badgeOk"
      : tone === "warn"
      ? "badge badgeWarn"
      : tone === "bad"
      ? "badge badgeBad"
      : "badge";
  return <span className={cls}>{children}</span>;
}

function Toast({ tone = "info", message, onClose }) {
  if (!message) return null;
  const cls =
    tone === "ok"
      ? "toast toastOk"
      : tone === "bad"
      ? "toast toastBad"
      : "toast";
  return (
    <div className={cls} role="status">
      <div className="toastMsg">{message}</div>
      <button className="toastX" onClick={onClose} aria-label="close">
        ×
      </button>
    </div>
  );
}

/* -----------------------------
   App
------------------------------ */
export default function App() {
  // auth form
  const [authMode, setAuthMode] = useState("register"); // register | login
  const [email, setEmail] = useState("host@carhop.com");
  const [password, setPassword] = useState("password123");
  const [fullName, setFullName] = useState("Host User");
  const [dob, setDob] = useState("2000-01-01");

  // verification
  const [verificationToken, setVerificationToken] = useState("");

  // profile / license
  const [profile, setProfile] = useState(null);
  const [licenseNumber, setLicenseNumber] = useState("UK-1234567");
  const [issuingCountry, setIssuingCountry] = useState("UK");
  const [expiryDate, setExpiryDate] = useState("2030-01-01");
  const [adminVerifyUserId, setAdminVerifyUserId] = useState("1");

  // cars
  const [cars, setCars] = useState([]);
  const [make, setMake] = useState("Toyota");
  const [model, setModel] = useState("Corolla");
  const [year, setYear] = useState(2020);
  const [dailyPrice, setDailyPrice] = useState(50);

  // bookings
  const [incoming, setIncoming] = useState([]);
  const [mine, setMine] = useState([]);

  // marketplace date filter + booking request
  const [startDate, setStartDate] = useState("2026-02-20");
  const [endDate, setEndDate] = useState("2026-02-22");

  // UI
  const [active, setActive] = useState("Marketplace");
  const [toast, setToast] = useState({ tone: "info", msg: "" });
  const [busy, setBusy] = useState({
    auth: false,
    verify: false,
    profile: false,
    license: false,
    admin: false,
    car: false,
    cars: false,
    incoming: false,
    mine: false,
    booking: null, // carId
    decision: null, // bookingId
    cancel: null, // bookingId
    logout: false,
  });

  const isAuthed = useMemo(() => !!profile, [profile]);
  const isAdmin = useMemo(() => profile?.role === "ADMIN", [profile]);

  function notify(msg, tone = "info") {
    setToast({ msg, tone });
  }

  // shared auth error handler
  const onAuthError = () => {
    setProfile(null);
    setIncoming([]);
    setMine([]);
    notify("Session expired. Please login again.", "warn");
    setActive("Auth");
  };

  function isValidDateRange(s, e) {
    if (!s || !e) return false;
    const sd = new Date(s);
    const ed = new Date(e);
    if (Number.isNaN(sd.getTime()) || Number.isNaN(ed.getTime())) return false;
    return ed >= sd;
  }

  /* -----------------------------
     Data refresh
  ------------------------------ */
  async function refreshCars() {
    setBusy((b) => ({ ...b, cars: true }));
    try {
      const datesOk = isValidDateRange(startDate, endDate);
      const qs = datesOk
        ? `?from=${encodeURIComponent(startDate)}&to=${encodeURIComponent(endDate)}`
        : "";
      const data = await apiFetch(`/cars/${qs}`);
      setCars(Array.isArray(data) ? data : []);
    } catch (e) {
      notify(e.message, "bad");
    } finally {
      setBusy((b) => ({ ...b, cars: false }));
    }
  }

  async function refreshProfile() {
    setBusy((b) => ({ ...b, profile: true }));
    try {
      const data = await apiFetch("/profile/me", { onAuthError });
      setProfile(data);
    } catch (e) {
      // If not logged in, /profile/me will 401 -> onAuthError already ran
      // but we don't want to show a scary toast every page load.
      setProfile(null);
    } finally {
      setBusy((b) => ({ ...b, profile: false }));
    }
  }

  async function refreshIncoming() {
    if (!isAuthed) {
      setIncoming([]);
      return;
    }
    setBusy((b) => ({ ...b, incoming: true }));
    try {
      const data = await apiFetch("/bookings/incoming", { onAuthError });
      setIncoming(Array.isArray(data) ? data : []);
    } finally {
      setBusy((b) => ({ ...b, incoming: false }));
    }
  }

  async function refreshMine() {
    if (!isAuthed) {
      setMine([]);
      return;
    }
    setBusy((b) => ({ ...b, mine: true }));
    try {
      const data = await apiFetch("/bookings/mine", { onAuthError });
      setMine(Array.isArray(data) ? data : []);
    } catch (e) {
      notify(e.message, "bad");
    } finally {
      setBusy((b) => ({ ...b, mine: false }));
    }
  }

  // initial
  useEffect(() => {
    refreshCars().catch(() => {});
    refreshProfile().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // after auth is established (profile loaded)
  useEffect(() => {
    if (!isAuthed) return;
    refreshIncoming().catch(() => {});
    refreshMine().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  /* -----------------------------
     Actions
  ------------------------------ */
  async function handleAuth(e) {
    e.preventDefault();
    setBusy((b) => ({ ...b, auth: true }));
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
        notify("Registered ✅ Now verify your email using the token.", "ok");
        setActive("Verify Email");
      } else {
        await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        notify("Logged in ✅ (cookie session)", "ok");
        await refreshProfile();
        await refreshIncoming();
        await refreshMine();
        setActive("Profile");
      }
      await refreshCars();
    } catch (err) {
      notify(`Auth error: ${err.message}`, "bad");
    } finally {
      setBusy((b) => ({ ...b, auth: false }));
    }
  }

  async function handleVerifyEmail() {
    setBusy((b) => ({ ...b, verify: true }));
    try {
      await apiFetch(`/auth/verify-email/${verificationToken}`, { method: "POST" });
      notify("Email verified ✅ You can now login.", "ok");
      setAuthMode("login");
      setActive("Auth");
    } catch (err) {
      notify(`Verify error: ${err.message}`, "bad");
    } finally {
      setBusy((b) => ({ ...b, verify: false }));
    }
  }

  async function handleLoginAfterVerify() {
    setBusy((b) => ({ ...b, auth: true }));
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      notify("Logged in ✅", "ok");
      await refreshProfile();
      await refreshIncoming();
      await refreshMine();
      setActive("Profile");
    } catch (err) {
      notify(`Login error: ${err.message}`, "bad");
    } finally {
      setBusy((b) => ({ ...b, auth: false }));
    }
  }

  async function logout() {
    setBusy((b) => ({ ...b, logout: true }));
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // even if logout fails, clear local state
    } finally {
      setProfile(null);
      setIncoming([]);
      setMine([]);
      notify("Logged out.", "info");
      setActive("Marketplace");
      setBusy((b) => ({ ...b, logout: false }));
    }
  }

  async function submitLicense(e) {
    e.preventDefault();
    setBusy((b) => ({ ...b, license: true }));
    try {
      await apiFetch("/profile/license", {
        method: "POST",
        onAuthError,
        body: JSON.stringify({
          license_number: licenseNumber,
          issuing_country: issuingCountry,
          expiry_date: expiryDate,
        }),
      });
      notify("License submitted ✅ (awaiting verification)", "ok");
      await refreshProfile();
      setActive("Profile");
    } catch (err) {
      notify(`License error: ${err.message}`, "bad");
    } finally {
      setBusy((b) => ({ ...b, license: false }));
    }
  }

  async function adminVerifyLicense() {
    setBusy((b) => ({ ...b, admin: true }));
    try {
      const userId = Number(adminVerifyUserId);
      await apiFetch(`/profile/license/${userId}/verify`, {
        method: "POST",
        onAuthError,
      });
      notify(`Admin: verified license for user ${userId} ✅`, "ok");
      await refreshProfile();
    } catch (err) {
      notify(`Admin verify error: ${err.message}`, "bad");
    } finally {
      setBusy((b) => ({ ...b, admin: false }));
    }
  }

  async function createCar(e) {
    e.preventDefault();
    setBusy((b) => ({ ...b, car: true }));
    try {
      await apiFetch("/cars/", {
        method: "POST",
        onAuthError,
        body: JSON.stringify({
          make,
          model,
          year: Number(year),
          daily_price: Number(dailyPrice),
          availability_units: 1,
        }),
      });
      notify("Car listing created ✅", "ok");
      await refreshCars();
      setActive("Marketplace");
    } catch (err) {
      notify(`Create car error: ${err.message}`, "bad");
    } finally {
      setBusy((b) => ({ ...b, car: false }));
    }
  }

  async function requestBooking(carId) {
    setBusy((b) => ({ ...b, booking: carId }));
    try {
      const datesOk = isValidDateRange(startDate, endDate);
      if (!datesOk) throw new Error("Please select a valid date range first.");

      const data = await apiFetch(`/bookings/${carId}`, {
        method: "POST",
        onAuthError,
        body: JSON.stringify({ start_date: startDate, end_date: endDate }),
      });

      notify(`Booking requested ✅ (booking_id: ${data.id})`, "ok");
      await refreshIncoming();
      await refreshMine();
      setActive("My Bookings");
    } catch (err) {
      notify(`Booking error: ${err.message}`, "bad");
    } finally {
      setBusy((b) => ({ ...b, booking: null }));
    }
  }

  async function approveBooking(bookingId) {
    setBusy((b) => ({ ...b, decision: bookingId }));
    try {
      const data = await apiFetch(`/bookings/${bookingId}/approve`, {
        method: "POST",
        onAuthError,
      });
      notify(`Approved booking ✅ (${data.id})`, "ok");
      await refreshCars();
      await refreshIncoming();
      await refreshMine();
    } catch (err) {
      notify(`Approve error: ${err.message}`, "bad");
    } finally {
      setBusy((b) => ({ ...b, decision: null }));
    }
  }

  async function rejectBooking(bookingId) {
    setBusy((b) => ({ ...b, decision: bookingId }));
    try {
      const data = await apiFetch(`/bookings/${bookingId}/reject`, {
        method: "POST",
        onAuthError,
      });
      notify(`Rejected booking ✅ (${data.id})`, "ok");
      await refreshIncoming();
      await refreshMine();
    } catch (err) {
      notify(`Reject error: ${err.message}`, "bad");
    } finally {
      setBusy((b) => ({ ...b, decision: null }));
    }
  }

  async function cancelBooking(bookingId) {
    setBusy((b) => ({ ...b, cancel: bookingId }));
    try {
      const data = await apiFetch(`/bookings/${bookingId}/cancel`, {
        method: "POST",
        onAuthError,
      });
      notify(`Cancelled booking ✅ (${data.id})`, "ok");
      await refreshCars();
      await refreshIncoming();
      await refreshMine();
    } catch (err) {
      notify(`Cancel error: ${err.message}`, "bad");
    } finally {
      setBusy((b) => ({ ...b, cancel: null }));
    }
  }

  /* -----------------------------
     Derived status (nice UI)
  ------------------------------ */
  const gates = useMemo(() => {
    const emailVerified = !!profile?.email_verified;
    const hasLicense = !!profile?.has_license;
    const licenseVerified = !!profile?.license_verified;

    return {
      emailVerified,
      hasLicense,
      licenseVerified,
      canListCars: isAuthed && emailVerified,
      canBook: isAuthed && emailVerified && licenseVerified,
    };
  }, [profile, isAuthed]);

  const navItems = useMemo(() => {
    const items = [{ key: "Marketplace", label: "Marketplace" }];

    if (!isAuthed) {
      items.push({ key: "Auth", label: "Auth" });
      return items;
    }

    items.push({ key: "Profile", label: "Profile" });

    if (!profile?.email_verified) {
      items.push({ key: "Verify Email", label: "Verify Email" });
    }

    items.push({ key: "License", label: "Driver License" });

    if (profile?.email_verified) {
      items.push({ key: "List Car", label: "List Car" });
      items.push({ key: "Incoming", label: "Incoming Bookings" });
      items.push({ key: "My Bookings", label: "My Bookings" });
    }

    if (isAdmin) {
      items.push({ key: "Admin", label: "Admin" });
    }

    return items;
  }, [isAuthed, profile?.email_verified, isAdmin]);

  useEffect(() => {
    const allowed = new Set(navItems.map((n) => n.key));
    if (!allowed.has(active)) {
      setActive(navItems[0]?.key || "Marketplace");
    }
  }, [navItems, active]);

  /* -----------------------------
     Render
  ------------------------------ */
  const datesOk = isValidDateRange(startDate, endDate);

  return (
    <div className="appShell">
      <Toast
        tone={toast.tone}
        message={toast.msg}
        onClose={() => setToast({ tone: "info", msg: "" })}
      />

      <aside className="sidebar">
        <div className="brand">
          <div className="logo">CH</div>
          <div>
            <div className="brandName">CarHop</div>
            <div className="brandSub">P2P Car Rental</div>
          </div>
        </div>

        <div className="statusStrip">
          <div className="statusRow">
            <span>Auth</span>
            {isAuthed ? <Badge tone="ok">Cookie session</Badge> : <Badge tone="bad">Logged out</Badge>}
          </div>

          <div className="statusRow">
            <span>Email</span>
            {profile?.email_verified ? <Badge tone="ok">Verified</Badge> : <Badge tone="warn">Pending</Badge>}
          </div>

          <div className="statusRow">
            <span>Licence</span>
            {!profile?.has_license ? (
              <Badge tone="bad">Not submitted</Badge>
            ) : profile?.license_verified ? (
              <Badge tone="ok">Verified</Badge>
            ) : (
              <Badge tone="warn">Pending</Badge>
            )}
          </div>

          {isAdmin ? (
            <div className="statusRow">
              <span>Role</span>
              <Badge tone="ok">Admin</Badge>
            </div>
          ) : null}
        </div>

        <nav className="nav">
          {navItems.map((it) => (
            <button
              key={it.key}
              className={active === it.key ? "navItem navItemActive" : "navItem"}
              onClick={() => setActive(it.key)}
            >
              {it.label}
            </button>
          ))}
        </nav>

        <div className="sidebarFooter">
          <div className="tiny">
            Backend: <span className="mono">http://localhost:8000</span>
          </div>
          <div className="tiny">
            Docs: <span className="mono">/docs</span>
          </div>

          {isAuthed ? (
            <Button variant="danger" onClick={logout} loading={busy.logout}>
              Logout
            </Button>
          ) : (
            <div className="tiny">Tip: register → verify → login</div>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1 className="pageTitle">{active}</h1>
            <p className="pageSub">The new Era of commuting</p>
          </div>

          <div className="topbarRight">
            <Button variant="secondary" onClick={refreshCars} loading={busy.cars}>
              Refresh Cars
            </Button>
            <Button
              variant="secondary"
              onClick={() => refreshProfile().catch((e) => notify(e.message, "bad"))}
              loading={busy.profile}
            >
              Refresh Profile
            </Button>
            <Button
              variant="secondary"
              onClick={() => refreshIncoming().catch((e) => notify(e.message, "bad"))}
              disabled={!isAuthed}
              loading={busy.incoming}
            >
              Refresh Incoming
            </Button>
            <Button
              variant="secondary"
              onClick={() => refreshMine().catch((e) => notify(e.message, "bad"))}
              disabled={!isAuthed}
              loading={busy.mine}
            >
              Refresh My Bookings
            </Button>
          </div>
        </header>

        {/* MARKETPLACE */}
        {active === "Marketplace" && (
          <Card
            title="Marketplace"
            subtitle="Pick dates to see only cars available for those dates. Booking requires email + licence verification."
            right={
              <div className="gates">
                <Badge tone={gates.canBook ? "ok" : "warn"}>
                  {gates.canBook ? "Can book" : "Booking locked"}
                </Badge>
              </div>
            }
          >
            <div className="row" style={{ marginBottom: 12 }}>
              <label className="field" style={{ flex: 1 }}>
                <span className="fieldLabel">From</span>
                <input
                  className="input"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span className="fieldLabel">To</span>
                <input
                  className="input"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>

              <Button variant="secondary" onClick={refreshCars} disabled={!datesOk} loading={busy.cars}>
                Search availability
              </Button>
            </div>

            {!datesOk ? (
              <div className="tiny muted" style={{ marginBottom: 10 }}>
                End date must be on/after start date.
              </div>
            ) : null}

            {cars.length === 0 ? (
              <p className="muted">No cars available for the selected dates.</p>
            ) : (
              <div className="grid">
                {cars.map((c) => {
                  const canRequest = gates.canBook && datesOk;

                  return (
                    <div className="tile" key={c.id}>
                      <div className="tileTop">
                        <div className="tileTitle">
                          #{c.id} · {c.make} {c.model}
                        </div>
                        <Badge tone={c.status === "AVAILABLE" ? "ok" : "warn"}>{c.status}</Badge>
                      </div>

                      <div className="tileMeta">
                        <div className="mono">{c.year}</div>
                        <div className="mono">£{c.daily_price}/day</div>
                        <div className="mono">owner #{c.owner_id}</div>
                      </div>

                      <div className="tileActions">
                        <Button
                          onClick={() => requestBooking(c.id)}
                          disabled={!canRequest}
                          loading={busy.booking === c.id}
                        >
                          Request Booking
                        </Button>

                        {!gates.canBook ? (
                          <div className="tiny muted">Unlock: verify email + admin-verified licence.</div>
                        ) : !datesOk ? (
                          <div className="tiny muted">Pick a valid date range first.</div>
                        ) : (
                          <div className="tiny muted">
                            Requested dates: <span className="mono">{startDate}</span> →{" "}
                            <span className="mono">{endDate}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* AUTH */}
        {active === "Auth" && (
          <div className="twoCol">
            <Card title="Register / Login" subtitle="Cookie auth (HttpOnly JWT) + CSRF protection.">
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
                  placeholder="••••••••"
                />

                {authMode === "register" ? (
                  <>
                    <Field label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    <Field label="Date of birth" value={dob} onChange={(e) => setDob(e.target.value)} placeholder="YYYY-MM-DD" />
                  </>
                ) : null}

                <Button type="submit" loading={busy.auth}>
                  {authMode === "register" ? "Create account" : "Login"}
                </Button>
              </form>

              <div className="divider" />
              <div className="inline">
                <span className="muted">Status:</span>{" "}
                {isAuthed ? <Badge tone="ok">Logged in</Badge> : <Badge tone="bad">Logged out</Badge>}
              </div>
            </Card>

            <Card title="Email Verification" subtitle="MVP mode: register returns a verification token (simulated email).">
              <div className="form">
                <Field
                  label="Verification token"
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value)}
                  placeholder="paste token here"
                />
                <div className="row">
                  <Button onClick={handleVerifyEmail} loading={busy.verify} disabled={!verificationToken}>
                    Verify Email
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleLoginAfterVerify}
                    loading={busy.auth}
                    disabled={!verificationToken}
                  >
                    Login after verify
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* VERIFY EMAIL */}
        {active === "Verify Email" && (
          <Card title="Verify Email" subtitle="Paste the token returned on registration.">
            <div className="form" style={{ maxWidth: 520 }}>
              <Field
                label="Verification token"
                value={verificationToken}
                onChange={(e) => setVerificationToken(e.target.value)}
                placeholder="paste token here"
              />
              <div className="row">
                <Button onClick={handleVerifyEmail} loading={busy.verify} disabled={!verificationToken}>
                  Verify
                </Button>
                <Button variant="secondary" onClick={() => setActive("Auth")}>
                  Back to Auth
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* PROFILE */}
        {active === "Profile" && (
          <Card
            title="Profile"
            subtitle="Shows your onboarding status and platform gates."
            right={
              <div className="gates">
                <Badge tone={gates.canListCars ? "ok" : "warn"}>
                  {gates.canListCars ? "Can list cars" : "Listing locked"}
                </Badge>
                <Badge tone={gates.canBook ? "ok" : "warn"}>
                  {gates.canBook ? "Can book" : "Booking locked"}
                </Badge>
              </div>
            }
          >
            {!isAuthed ? (
              <p className="muted">Login to see your profile.</p>
            ) : !profile ? (
              <p className="muted">Loading…</p>
            ) : (
              <div className="profileGrid">
                <div className="kv">
                  <div className="k">User ID</div>
                  <div className="v mono">{profile.id}</div>
                </div>
                <div className="kv">
                  <div className="k">Email</div>
                  <div className="v">{profile.email}</div>
                </div>
                <div className="kv">
                  <div className="k">Name</div>
                  <div className="v">{profile.full_name}</div>
                </div>
                <div className="kv">
                  <div className="k">DoB</div>
                  <div className="v mono">{profile.date_of_birth}</div>
                </div>

                <div className="kv">
                  <div className="k">Role</div>
                  <div className="v">
                    <Badge tone={profile.role === "ADMIN" ? "ok" : "neutral"}>{profile.role}</Badge>
                  </div>
                </div>

                <div className="kv">
                  <div className="k">Email verified</div>
                  <div className="v">{profile.email_verified ? <Badge tone="ok">Yes</Badge> : <Badge tone="warn">No</Badge>}</div>
                </div>

                <div className="kv">
                  <div className="k">Licence submitted</div>
                  <div className="v">{profile.has_license ? <Badge tone="ok">Yes</Badge> : <Badge tone="warn">No</Badge>}</div>
                </div>

                <div className="kv">
                  <div className="k">Licence verified</div>
                  <div className="v">{profile.license_verified ? <Badge tone="ok">Yes</Badge> : <Badge tone="warn">No</Badge>}</div>
                </div>

                <div className="kv">
                  <div className="k">Profile complete</div>
                  <div className="v">{profile.profile_complete ? <Badge tone="ok">Yes</Badge> : <Badge tone="warn">No</Badge>}</div>
                </div>
              </div>
            )}

            {isAuthed ? (
              <div className="hintBox">
                <div className="hintTitle">Next steps</div>
                <ul className="hintList">
                  <li>If email isn’t verified: go to <b>Verify Email</b>.</li>
                  <li>
                    If licence isn’t verified: submit it in <b>Driver License</b> then verify as admin.
                  </li>
                </ul>
              </div>
            ) : null}
          </Card>
        )}

        {/* LICENSE */}
        {active === "License" && (
          <div className="twoCol">
            <Card title="Driver License" subtitle="Submit or update licence details (admin verification required).">
              <form className="form" onSubmit={submitLicense}>
                <Field
                  label="Licence number"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="UK-1234567"
                />
                <Field
                  label="Issuing country"
                  value={issuingCountry}
                  onChange={(e) => setIssuingCountry(e.target.value)}
                  placeholder="UK"
                />
                <Field
                  label="Expiry date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
                <Button type="submit" disabled={!isAuthed} loading={busy.license}>
                  Submit / Update
                </Button>
                {!isAuthed ? <div className="tiny muted">Login first.</div> : null}
              </form>
            </Card>

            <Card title="Admin: Verify Licence" subtitle="Now role-based (ADMIN).">
              <div className="form">
                <Field
                  label="User ID to verify"
                  type="number"
                  min="1"
                  value={adminVerifyUserId}
                  onChange={(e) => setAdminVerifyUserId(e.target.value)}
                />
                <Button onClick={adminVerifyLicense} disabled={!isAuthed || !isAdmin} loading={busy.admin}>
                  Verify Licence
                </Button>
                {!isAdmin ? <div className="tiny muted">Login as an ADMIN user to verify.</div> : null}
              </div>
            </Card>
          </div>
        )}

        {/* LIST CAR */}
        {active === "List Car" && (
          <Card
            title="List a Car"
            subtitle="Owners can publish a listing. Requires email verification."
            right={<Badge tone={gates.canListCars ? "ok" : "warn"}>{gates.canListCars ? "Unlocked" : "Locked"}</Badge>}
          >
            <form className="form" onSubmit={createCar} style={{ maxWidth: 720 }}>
              <div className="grid2">
                <Field label="Make" value={make} onChange={(e) => setMake(e.target.value)} placeholder="Toyota" />
                <Field label="Model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Corolla" />
                <Field label="Year" type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2020" />
                <Field
                  label="Daily price (£)"
                  type="number"
                  value={dailyPrice}
                  onChange={(e) => setDailyPrice(e.target.value)}
                  placeholder="50"
                />
              </div>

              <Button type="submit" disabled={!gates.canListCars} loading={busy.car}>
                Publish Listing
              </Button>

              {!gates.canListCars ? <div className="tiny muted">Unlock: login + verify email.</div> : null}
            </form>
          </Card>
        )}

        {/* INCOMING */}
        {active === "Incoming" && (
          <Card title="Incoming Booking Requests" subtitle="Owners can approve or reject pending requests.">
            {!isAuthed ? (
              <p className="muted">Login to view incoming bookings.</p>
            ) : incoming.length === 0 ? (
              <p className="muted">No incoming bookings.</p>
            ) : (
              <div className="stack">
                {incoming.map((b) => (
                  <div className="rowCard" key={b.id}>
                    <div className="rowCardMain">
                      <div className="rowCardTitle">
                        Booking #{b.id} <span className="muted">· car #{b.car_id} · renter #{b.renter_id}</span>
                      </div>

                      <div className="rowCardSub">
                        Dates: <span className="mono">{b.start_date}</span> → <span className="mono">{b.end_date}</span>
                      </div>

                      <div className="rowCardSub">
                        Status:{" "}
                        <Badge
                          tone={
                            b.status === "PENDING"
                              ? "warn"
                              : b.status === "APPROVED"
                              ? "ok"
                              : b.status === "REJECTED"
                              ? "bad"
                              : "warn"
                          }
                        >
                          {b.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="rowCardActions">
                      {b.status === "PENDING" ? (
                        <>
                          <Button
                            onClick={() => approveBooking(b.id)}
                            loading={busy.decision === b.id}
                            disabled={busy.decision !== null && busy.decision !== b.id}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => rejectBooking(b.id)}
                            loading={busy.decision === b.id}
                            disabled={busy.decision !== null && busy.decision !== b.id}
                          >
                            Reject
                          </Button>
                        </>
                      ) : (
                        <span className="tiny muted">No action</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* MY BOOKINGS */}
        {active === "My Bookings" && (
          <Card title="My Bookings" subtitle="Your booking requests (renter view).">
            {!isAuthed ? (
              <p className="muted">Login to view your bookings.</p>
            ) : mine.length === 0 ? (
              <p className="muted">No bookings yet.</p>
            ) : (
              <div className="stack">
                {mine.map((b) => {
                  const canCancel =
                    b.status === "PENDING" ||
                    (b.status === "APPROVED" && new Date(b.start_date).getTime() > Date.now());

                  return (
                    <div className="rowCard" key={b.id}>
                      <div className="rowCardMain">
                        <div className="rowCardTitle">
                          Booking #{b.id} <span className="muted">· car #{b.car_id}</span>
                        </div>

                        <div className="rowCardSub">
                          Dates: <span className="mono">{b.start_date}</span> → <span className="mono">{b.end_date}</span>
                        </div>

                        <div className="rowCardSub">
                          Status:{" "}
                          <Badge
                            tone={
                              b.status === "PENDING"
                                ? "warn"
                                : b.status === "APPROVED"
                                ? "ok"
                                : b.status === "REJECTED"
                                ? "bad"
                                : "warn"
                            }
                          >
                            {b.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="rowCardActions">
                        <Button
                          variant="danger"
                          onClick={() => cancelBooking(b.id)}
                          disabled={!canCancel}
                          loading={busy.cancel === b.id}
                        >
                          Cancel
                        </Button>
                        {!canCancel ? <span className="tiny muted">Cannot cancel</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* ADMIN */}
        {active === "Admin" && isAdmin && (
          <Card title="Admin Panel" subtitle="Minimal admin surface for demo.">
            <div className="hintBox">
              <div className="hintTitle">What this demonstrates</div>
              <ul className="hintList">
                <li>Role-gated endpoint usage (ADMIN only).</li>
                <li>Manual verification workflow (licence).</li>
                <li>Unlocking customer capabilities after trust checks.</li>
              </ul>
            </div>

            <div className="form" style={{ maxWidth: 520 }}>
              <Field
                label="User ID to verify licence"
                type="number"
                min="1"
                value={adminVerifyUserId}
                onChange={(e) => setAdminVerifyUserId(e.target.value)}
              />
              <Button onClick={adminVerifyLicense} loading={busy.admin}>
                Verify Licence
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
