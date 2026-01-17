import { useEffect, useState } from "react";
const API = "/api";

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {})
    }
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [cars, setCars] = useState([]);
  const [incoming, setIncoming] = useState([]);

  const [form, setForm] = useState({
    make: "", model: "", year: 2020, daily_price: 50
  });

  useEffect(() => {
    api("/cars").then(setCars);
    if (token) api("/bookings/incoming", { token }).then(setIncoming);
  }, [token]);

  async function createCar() {
    await api("/cars", {
      method: "POST",
      token,
      body: JSON.stringify(form)
    });
    api("/cars").then(setCars);
  }

  async function bookCar(id) {
    await api(`/bookings/${id}`, { method: "POST", token });
    alert("Booking requested");
  }

  async function approve(id) {
    await api(`/bookings/${id}/approve`, { method: "POST", token });
    api("/bookings/incoming", { token }).then(setIncoming);
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>CarHop – P2P Car Rental</h1>

      {!token ? (
        <p>Login via Swagger to get token</p>
      ) : (
        <>
          <h2>List Your Car</h2>
          <input placeholder="Make" onChange={e => setForm({ ...form, make: e.target.value })} />
          <input placeholder="Model" onChange={e => setForm({ ...form, model: e.target.value })} />
          <button onClick={createCar}>Publish</button>
        </>
      )}

      <h2>Available Cars</h2>
      {cars.map(c => (
        <div key={c.id}>
          {c.make} {c.model} – £{c.daily_price}/day
          {token && <button onClick={() => bookCar(c.id)}>Request Booking</button>}
        </div>
      ))}

      <h2>Incoming Booking Requests (Owners)</h2>
      {incoming.map(b => (
        <div key={b.id}>
          Booking #{b.id} – {b.status}
          {b.status === "PENDING" && <button onClick={() => approve(b.id)}>Approve</button>}
        </div>
      ))}
    </div>
  );
}
