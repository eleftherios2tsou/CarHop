import { useEffect, useMemo, useState } from "react";

const API = "/api";

function getToken() {
  return localStorage.getItem("token") || "";
}
function setToken(t) {
  localStorage.setItem("token", t);
}
function clearToken() {
  localStorage.removeItem("token");
}

async function apiFetch(path, { token, ...opts } = {}) {
  const headers = {
    ...(opts.headers || {}),
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
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

export default function App() {
  // auth
  const [token, setTokenState] = useState(getToken());
  const [mode, setMode] = useState("register"); // register | login
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

  // cars (listings)
  const [cars, setCars] = useState([]);
  const [make, setMake] = useState("Toyota");
  const [model, setModel] = useState("Corolla");
  const [year, setYear] = useState(2020);
  const [dailyPrice, setDailyPrice] = useState(50);

  // bookings
  const [incoming, setIncoming] = useState([]);

  const [message, setMessage] = useState("");

  const isAuthed = useMemo(() => !!token, [token]);
  const isAdmin = useMemo(() => profile?.id === 1, [profile]);

  async function refreshCars() {
    const data = await apiFetch("/cars");
    setCars(Array.isArray(data) ? data : []);
  }

  async function refreshProfile() {
    if (!token) {
      setProfile(null);
      return;
    }
    const data = await apiFetch("/profile/me", { token });
    setProfile(data);
  }

  async function refreshIncoming() {
    if (!token) {
      setIncoming([]);
      return;
    }
    const data = await apiFetch("/bookings/incoming", { token });
    setIncoming(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    refreshCars().catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    refreshProfile().catch(() => {});
    refreshIncoming().catch(() => {});
  }, [token]);

  async function handleAuth(e) {
    e.preventDefault();
    setMessage("");

    try {
      if (mode === "register") {
        const data = await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            full_name: fullName,
            date_of_birth: dob,
          }),
        });

        // backend returns verification token for MVP (simulate email)
        if (data?.verification_token) setVerificationToken(data.verification_token);
        setMessage("Registered ✅ Now verify your email using the token.");
      } else {
        const data = await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });

        setToken(data.access_token);
        setTokenState(data.access_token);
        setMessage("Logged in ✅");
      }

      await refreshCars();
    } catch (err) {
      setMessage(`Auth error: ${err.message}`);
    }
  }

  async function handleVerifyEmail() {
    setMessage("");
    try {
      await apiFetch(`/auth/verify-email/${verificationToken}`, { method: "POST" });
      setMessage("Email verified ✅ You can now login.");
    } catch (err) {
      setMessage(`Verify error: ${err.message}`);
    }
  }

  async function handleLoginAfterVerify() {
    setMessage("");
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(data.access_token);
      setTokenState(data.access_token);
      setMessage("Logged in ✅");
      await refreshProfile();
      await refreshIncoming();
    } catch (err) {
      setMessage(`Login error: ${err.message}`);
    }
  }

  function logout() {
    clearToken();
    setTokenState("");
    setProfile(null);
    setIncoming([]);
    setMessage("Logged out.");
  }

  async function submitLicense(e) {
    e.preventDefault();
    setMessage("");

    try {
      await apiFetch("/profile/license", {
        method: "POST",
        token,
        body: JSON.stringify({
          license_number: licenseNumber,
          issuing_country: issuingCountry,
          expiry_date: expiryDate,
        }),
      });

      setMessage("License submitted ✅ (awaiting verification)");
      await refreshProfile();
    } catch (err) {
      setMessage(`License error: ${err.message}`);
    }
  }

  async function adminVerifyLicense() {
    setMessage("");
    try {
      const userId = Number(adminVerifyUserId);
      await apiFetch(`/profile/license/${userId}/verify`, {
        method: "POST",
        token,
      });
      setMessage(`Admin: verified license for user ${userId} ✅`);
      await refreshProfile();
    } catch (err) {
      setMessage(`Admin verify error: ${err.message}`);
    }
  }

  async function createCar(e) {
    e.preventDefault();
    setMessage("");

    try {
      await apiFetch("/cars", {
        method: "POST",
        token,
        body: JSON.stringify({
          make,
          model,
          year: Number(year),
          daily_price: Number(dailyPrice),
          availability_units: 1,
        }),
      });

      setMessage("Car listing created ✅");
      await refreshCars();
    } catch (err) {
      setMessage(`Create car error: ${err.message}`);
    }
  }

  async function requestBooking(carId) {
    setMessage("");
    try {
      const data = await apiFetch(`/bookings/${carId}`, {
        method: "POST",
        token,
      });
      setMessage(`Booking requested ✅ (booking_id: ${data.id})`);
      await refreshIncoming();
    } catch (err) {
      setMessage(`Booking error: ${err.message}`);
    }
  }

  async function approveBooking(bookingId) {
    setMessage("");
    try {
      const data = await apiFetch(`/bookings/${bookingId}/approve`, {
        method: "POST",
        token,
      });
      setMessage(`Approved booking ✅ (${data.id})`);
      await refreshCars();
      await refreshIncoming();
    } catch (err) {
      setMessage(`Approve error: ${err.message}`);
    }
  }

  async function rejectBooking(bookingId) {
    setMessage("");
    try {
      const data = await apiFetch(`/bookings/${bookingId}/reject`, {
        method: "POST",
        token,
      });
      setMessage(`Rejected booking ✅ (${data.id})`);
      await refreshIncoming();
    } catch (err) {
      setMessage(`Reject error: ${err.message}`);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "32px auto", fontFamily: "system-ui, Arial" }}>
      <h1>CarHop – P2P Car Rental MVP</h1>
      <p style={{ color: "#555" }}>
        Demo UI: Register → Verify Email → Login → Submit License → (Admin Verify) → List Car → Request Booking
      </p>

      {message && (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {/* AUTH + VERIFY */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h2>Register / Login</h2>

          <form onSubmit={handleAuth} style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setMode("register")} disabled={mode === "register"}>
                Register
              </button>
              <button type="button" onClick={() => setMode("login")} disabled={mode === "login"}>
                Login
              </button>
            </div>

            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              type="password"
            />

            {mode === "register" && (
              <>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="full name" />
                <input value={dob} onChange={(e) => setDob(e.target.value)} placeholder="YYYY-MM-DD" />
              </>
            )}

            <button type="submit">{mode === "register" ? "Register" : "Login"}</button>
          </form>

          <div style={{ marginTop: 12 }}>
            <div>
              <b>Auth:</b> {isAuthed ? "✅ token saved" : "❌ not logged in"}
            </div>
            {isAuthed && (
              <button onClick={logout} style={{ marginTop: 8 }}>
                Logout
              </button>
            )}
          </div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h2>Email Verification</h2>

          <p style={{ color: "#666", marginTop: 0 }}>
            MVP mode: after register, backend returns a verification token (simulating email).
          </p>

          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={verificationToken}
              onChange={(e) => setVerificationToken(e.target.value)}
              placeholder="verification token"
            />
            <button onClick={handleVerifyEmail}>Verify Email</button>
            <button onClick={handleLoginAfterVerify}>Login After Verify</button>
          </div>
        </div>
      </div>

      {/* PROFILE + LICENSE */}
      <div style={{ marginTop: 20, border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Profile Status</h2>
          <button onClick={() => refreshProfile().catch((e) => setMessage(e.message))} disabled={!isAuthed}>
            Refresh
          </button>
        </div>

        {!isAuthed ? (
          <p style={{ color: "#999" }}>Login to see your profile.</p>
        ) : !profile ? (
          <p style={{ color: "#999" }}>Loading…</p>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
            <div><b>User ID:</b> {profile.id}</div>
            <div><b>Email:</b> {profile.email}</div>
            <div><b>Name:</b> {profile.full_name}</div>
            <div><b>DoB:</b> {profile.date_of_birth}</div>
            <div><b>Email Verified:</b> {profile.email_verified ? "✅" : "❌"}</div>
            <div><b>License Submitted:</b> {profile.has_license ? "✅" : "❌"}</div>
            <div><b>License Verified:</b> {profile.license_verified ? "✅" : "❌"}</div>
            <div><b>Profile Complete:</b> {profile.profile_complete ? "✅" : "❌"}</div>
            {isAdmin && (
              <div style={{ marginTop: 8, color: "#666" }}>
                <b>Admin Mode:</b> enabled (user #1)
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h2>Submit Driver License</h2>

          <form onSubmit={submitLicense} style={{ display: "grid", gap: 8 }}>
            <input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="license number"
            />
            <input
              value={issuingCountry}
              onChange={(e) => setIssuingCountry(e.target.value)}
              placeholder="issuing country"
            />
            <input
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              placeholder="expiry date YYYY-MM-DD"
            />
            <button type="submit" disabled={!isAuthed}>
              Submit / Update License
            </button>
          </form>

          {!isAuthed && <p style={{ color: "#999" }}>Login first.</p>}
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h2>Admin: Verify License</h2>

          <p style={{ color: "#666", marginTop: 0 }}>
            MVP rule: only user #1 can verify licenses.
          </p>

          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={adminVerifyUserId}
              onChange={(e) => setAdminVerifyUserId(e.target.value)}
              placeholder="user_id to verify"
              type="number"
              min="1"
            />
            <button onClick={adminVerifyLicense} disabled={!isAuthed || !isAdmin}>
              Verify License
            </button>
          </div>

          {!isAdmin && <p style={{ color: "#999" }}>Login as user #1 to use admin verify.</p>}
        </div>
      </div>

      {/* CARS */}
      <div style={{ marginTop: 20, border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <h2>List Your Car (Owner)</h2>

        <form onSubmit={createCar} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="make" />
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="model" />
          <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="year" type="number" />
          <input
            value={dailyPrice}
            onChange={(e) => setDailyPrice(e.target.value)}
            placeholder="daily price"
            type="number"
          />
          <button type="submit" disabled={!isAuthed} style={{ gridColumn: "1 / -1" }}>
            Publish Listing
          </button>
        </form>

        {!isAuthed && <p style={{ color: "#999" }}>Login first. (Email must be verified)</p>}
      </div>

      {/* MARKETPLACE */}
      <div style={{ marginTop: 20, border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Marketplace (Cars)</h2>
          <button onClick={() => refreshCars().catch((e) => setMessage(e.message))}>Refresh</button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {cars.length === 0 ? (
            <p style={{ color: "#999" }}>No cars listed yet.</p>
          ) : (
            cars.map((c) => (
              <div key={c.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div>
                      <b>#{c.id}</b> {c.make} {c.model} ({c.year})
                    </div>
                    <div style={{ color: "#666" }}>
                      £{c.daily_price}/day | owner_id: {c.owner_id} | status: {c.status}
                    </div>
                  </div>

                  <button onClick={() => requestBooking(c.id)} disabled={!isAuthed}>
                    Request Booking
                  </button>
                </div>

                {!isAuthed && <div style={{ color: "#999", marginTop: 6 }}>Login to request bookings.</div>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* INCOMING BOOKINGS */}
      <div style={{ marginTop: 20, border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Incoming Booking Requests (Owner)</h2>
          <button onClick={() => refreshIncoming().catch((e) => setMessage(e.message))} disabled={!isAuthed}>
            Refresh
          </button>
        </div>

        {!isAuthed ? (
          <p style={{ color: "#999" }}>Login to view incoming bookings.</p>
        ) : incoming.length === 0 ? (
          <p style={{ color: "#999", marginTop: 12 }}>No incoming bookings.</p>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {incoming.map((b) => (
              <div key={b.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div>
                      <b>Booking #{b.id}</b> — car_id: {b.car_id} — renter_id: {b.renter_id}
                    </div>
                    <div style={{ color: "#666" }}>status: {b.status}</div>
                  </div>

                  {b.status === "PENDING" ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => approveBooking(b.id)}>Approve</button>
                      <button onClick={() => rejectBooking(b.id)}>Reject</button>
                    </div>
                  ) : (
                    <div style={{ color: "#999" }}>No action</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ marginTop: 18, color: "#777" }}>
        Backend: http://localhost:8000 | Docs: /docs
      </p>
    </div>
  );
}
