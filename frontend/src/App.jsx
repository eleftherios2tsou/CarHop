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
    "Content-Type": "application/json",
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg =
      (data && data.detail && (Array.isArray(data.detail) ? JSON.stringify(data.detail) : data.detail)) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export default function App() {
  const [token, setTokenState] = useState(getToken());
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("test@carhop.com");
  const [password, setPassword] = useState("password123");

  const [rides, setRides] = useState([]);
  const [origin, setOrigin] = useState("Bristol");
  const [destination, setDestination] = useState("London");
  const [seats, setSeats] = useState(3);

  const [message, setMessage] = useState("");

  const isAuthed = useMemo(() => !!token, [token]);

  async function refreshRides() {
    const data = await apiFetch("/rides");
    setRides(data || []);
  }

  useEffect(() => {
    refreshRides().catch(() => {});
  }, []);

  async function handleAuth(e) {
    e.preventDefault();
    setMessage("");
    const path = mode === "login" ? "/auth/login" : "/auth/register";
    try {
      const data = await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(data.access_token);
      setTokenState(data.access_token);
      setMessage(`${mode} success ✅`);
    } catch (err) {
      setMessage(`Auth error: ${err.message}`);
    }
  }

  async function handleCreateRide(e) {
    e.preventDefault();
    setMessage("");
    try {
      await apiFetch("/rides", {
        method: "POST",
        token,
        body: JSON.stringify({
          origin,
          destination,
          seats_available: Number(seats),
        }),
      });
      setMessage("Ride created ✅");
      await refreshRides();
    } catch (err) {
      setMessage(`Create ride error: ${err.message}`);
    }
  }

  async function handleRequestRide(rideId) {
    setMessage("");
    try {
      const data = await apiFetch(`/rides/${rideId}/requests`, {
        method: "POST",
        token,
      });
      setMessage(`Requested ride ✅ (request_id: ${data.id})`);
    } catch (err) {
      setMessage(`Request error: ${err.message}`);
    }
  }

  function logout() {
    clearToken();
    setTokenState("");
    setMessage("Logged out.");
  }

  return (
    <div style={{ maxWidth: 900, margin: "32px auto", fontFamily: "system-ui, Arial" }}>
      <h1>CarHop MVP</h1>
      <p style={{ color: "#555" }}>
        Minimal demo UI: auth → rides → requests.
      </p>

      {message && (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 16 }}>
          {message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h2>Auth</h2>
          <form onSubmit={handleAuth} style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setMode("login")} disabled={mode === "login"}>
                Login
              </button>
              <button type="button" onClick={() => setMode("register")} disabled={mode === "register"}>
                Register
              </button>
            </div>

            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
            <button type="submit">{mode === "login" ? "Login" : "Register"}</button>
          </form>

          <div style={{ marginTop: 12 }}>
            <div><b>Auth:</b> {isAuthed ? "✅ token saved" : "❌ not logged in"}</div>
            {isAuthed && <button onClick={logout} style={{ marginTop: 8 }}>Logout</button>}
          </div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h2>Create Ride (Driver)</h2>
          <form onSubmit={handleCreateRide} style={{ display: "grid", gap: 8 }}>
            <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="origin" />
            <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="destination" />
            <input value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="seats_available" type="number" min="1" max="8" />
            <button type="submit" disabled={!isAuthed}>Create Ride</button>
          </form>
          {!isAuthed && <p style={{ color: "#999" }}>Login/register first to create rides.</p>}
        </div>
      </div>

      <div style={{ marginTop: 20, border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Rides</h2>
          <button onClick={() => refreshRides().catch((e) => setMessage(e.message))}>Refresh</button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {rides.length === 0 ? (
            <p style={{ color: "#999" }}>No rides yet.</p>
          ) : (
            rides.map((r) => (
              <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div><b>#{r.id}</b> {r.origin} → {r.destination}</div>
                    <div style={{ color: "#666" }}>
                      seats: {r.seats_available} | driver_id: {r.driver_id} {r.status ? `| status: ${r.status}` : ""}
                    </div>
                  </div>
                  <button onClick={() => handleRequestRide(r.id)} disabled={!isAuthed}>
                    Request
                  </button>
                </div>
                {!isAuthed && <div style={{ color: "#999", marginTop: 6 }}>Login to request rides.</div>}
              </div>
            ))
          )}
        </div>
      </div>

      <p style={{ marginTop: 18, color: "#777" }}>
        Backend: http://localhost:8000 | Docs: /docs
      </p>
    </div>
  );
}
