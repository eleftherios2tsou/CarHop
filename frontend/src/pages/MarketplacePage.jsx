import { useState, useEffect, useMemo, useRef } from "react";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import StateNotice from "../components/ui/StateNotice";
import SafetyInfoModal from "../components/SafetyInfoModal";
import { apiFetch } from "../lib/api";

function isValidDateRange(s, e) {
  if (!s || !e) return false;
  const sd = new Date(s);
  const ed = new Date(e);
  if (Number.isNaN(sd.getTime()) || Number.isNaN(ed.getTime())) return false;
  return ed >= sd;
}

function plusDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const EMPTY_FILTERS = {
  city: "",
  make: "",
  minPrice: "",
  maxPrice: "",
  transmission: "",
  fuelType: "",
  minSeats: "",
};

const CAR_MAKES = [
  "Abarth","Alfa Romeo","Aston Martin","Audi","Bentley","BMW","BYD",
  "Chevrolet","Chrysler","Citroën","Cupra","Dacia","Dodge","DS",
  "Ferrari","Fiat","Ford","Genesis","Honda","Hyundai","Infiniti",
  "Jaguar","Jeep","Kia","Lamborghini","Land Rover","Lexus","Maserati",
  "Mazda","McLaren","Mercedes-Benz","MG","MINI","Mitsubishi","Nissan",
  "Peugeot","Polestar","Porsche","Renault","Rolls-Royce","SEAT","Škoda",
  "Smart","Subaru","Suzuki","Tesla","Toyota","Vauxhall","Volkswagen","Volvo",
];

const PAGE_SIZE = 20;

// ── Sparkle SVG icon ────────────────────────────────────────────────────────
function SparkleIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2l1.8 5.4L19.2 9l-5.4 1.8L12 16.2l-1.8-5.4L4.8 9l5.4-1.8L12 2z" />
      <path d="M19 15l.9 2.7 2.7.9-2.7.9L19 22l-.9-2.7-2.7-.9 2.7-.9L19 15z" opacity="0.7" />
      <path d="M5 2l.6 1.8 1.8.6-1.8.6L5 7l-.6-1.8L2.6 4.4l1.8-.6L5 2z" opacity="0.5" />
    </svg>
  );
}

export default function MarketplacePage({ profile, gates, notify, onAuthError, onBookingMade }) {
  const [cars, setCars] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState(plusDaysIso(2));
  const [endDate, setEndDate] = useState(plusDaysIso(4));
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [busyCars, setBusyCars] = useState(false);
  const [busyBooking, setBusyBooking] = useState(null);
  const [busyDelete, setBusyDelete] = useState(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [pendingCarId, setPendingCarId] = useState(null);

  // AI search state
  const [aiQuery, setAiQuery] = useState("");
  const [busyAI, setBusyAI] = useState(false);
  const [aiGlow, setAiGlow] = useState(false);     // triggers pulse on heroBar after fill
  const listingsRef = useRef(null);

  const datesOk = isValidDateRange(startDate, endDate);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => v !== "").length,
    [filters]
  );

  // ── buildQueryString accepts optional value overrides so we can call it
  //    immediately after setting state (React state updates are async).
  function buildQueryString(targetPage = page, overrides = {}) {
    const f = overrides.filters ?? filters;
    const s = overrides.startDate ?? startDate;
    const e = overrides.endDate ?? endDate;
    const dOk = isValidDateRange(s, e);

    const params = new URLSearchParams();
    if (dOk) {
      params.set("from", s);
      params.set("to", e);
    }
    if (f.city) params.set("city", f.city);
    if (f.make) params.set("make", f.make);
    if (f.minPrice) params.set("min_price", f.minPrice);
    if (f.maxPrice) params.set("max_price", f.maxPrice);
    if (f.transmission) params.set("transmission", f.transmission);
    if (f.fuelType) params.set("fuel_type", f.fuelType);
    if (f.minSeats) params.set("min_seats", f.minSeats);
    params.set("page", String(targetPage));
    params.set("page_size", String(PAGE_SIZE));
    return `?${params.toString()}`;
  }

  async function fetchCars(targetPage = page, overrides = {}) {
    setBusyCars(true);
    try {
      const data = await apiFetch(`/cars/${buildQueryString(targetPage, overrides)}`);
      setCars(Array.isArray(data?.items) ? data.items : []);
      setTotal(data?.total ?? 0);
    } catch (e) {
      notify(e.message, "bad");
    } finally {
      setBusyCars(false);
    }
  }

  useEffect(() => {
    fetchCars(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  // ── AI natural language search ───────────────────────────────────────────
  async function parseWithAI() {
    const q = aiQuery.trim();
    if (!q) return;

    setBusyAI(true);
    try {
      const data = await apiFetch("/search/parse", {
        method: "POST",
        body: JSON.stringify({ query: q }),
      });

      // Build the complete new state from AI response
      const newFilters = { ...filters };
      let newStart = startDate;
      let newEnd = endDate;

      if (data.city) newFilters.city = data.city;
      if (data.make) newFilters.make = data.make;
      if (data.minPrice != null) newFilters.minPrice = String(data.minPrice);
      if (data.maxPrice != null) newFilters.maxPrice = String(data.maxPrice);
      if (data.transmission) newFilters.transmission = data.transmission;
      if (data.fuelType) newFilters.fuelType = data.fuelType;
      if (data.minSeats != null) newFilters.minSeats = String(data.minSeats);
      if (data.startDate) newStart = data.startDate;
      if (data.endDate) newEnd = data.endDate;

      // Apply all state updates at once
      setFilters(newFilters);
      setStartDate(newStart);
      setEndDate(newEnd);
      setPage(1);

      // Flash the search bar green to signal fields were populated
      setAiGlow(true);
      setTimeout(() => setAiGlow(false), 1400);

      // Fetch immediately using the new values directly (bypasses stale state)
      await fetchCars(1, { filters: newFilters, startDate: newStart, endDate: newEnd });

      // Scroll down to listings smoothly
      setTimeout(() => {
        listingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);

    } catch (err) {
      notify(`AI search: ${err.message}`, "bad");
    } finally {
      setBusyAI(false);
    }
  }

  // ── Booking / delete ─────────────────────────────────────────────────────
  function openSafety(carId) {
    setPendingCarId(carId);
    setSafetyOpen(true);
  }

  async function requestBooking(carId) {
    setBusyBooking(carId);
    try {
      if (!datesOk) throw new Error("Please select a valid date range first.");
      const data = await apiFetch(`/bookings/${carId}`, {
        method: "POST",
        onAuthError,
        body: JSON.stringify({ start_date: startDate, end_date: endDate }),
      });
      notify(`Booking requested (booking_id: ${data.id})`, "ok");
      setSafetyOpen(false);
      onBookingMade();
    } catch (err) {
      notify(`Booking error: ${err.message}`, "bad");
      setSafetyOpen(false);
    } finally {
      setBusyBooking(null);
    }
  }

  async function deleteCarListing(carId) {
    if (!window.confirm("Delete this listing permanently?")) return;
    setBusyDelete(carId);
    try {
      await apiFetch(`/cars/${carId}`, { method: "DELETE", onAuthError });
      notify(`Listing #${carId} deleted`, "ok");
      setCars((prev) => prev.filter((c) => c.id !== carId));
    } catch (err) {
      notify(`Delete error: ${err.message}`, "bad");
    } finally {
      setBusyDelete(null);
    }
  }

  function canDeleteCar(c) {
    if (!profile) return false;
    return profile.role === "ADMIN" || profile.id === c.owner_id;
  }

  function carCoverUrl(c) {
    return c?.photo_urls?.[0] || "";
  }

  function handleSearchKey(e) {
    if (e.key === "Enter" && datesOk && !busyCars) {
      setPage(1);
      fetchCars(1);
    }
  }

  return (
    <div className="marketplacePage">
      {/* ── Hero ── */}
      <div className="hero">
        <div className="heroInner">
          <h1 className="heroTitle">Find your perfect car</h1>
          <p className="heroSubtitle">Rent from local owners — verified and ready to drive.</p>

          {/* ── AI search bar ── */}
          <div className={`aiBar${busyAI ? " aiBarBusy" : ""}`}>
            <span className="aiBarIcon">
              <SparkleIcon size={17} />
            </span>
            <input
              className="aiBarInput"
              type="text"
              placeholder='Try: "automatic diesel near Bristol this weekend under £60"'
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busyAI && parseWithAI()}
              disabled={busyAI}
            />
            <button
              className="aiBarBtn"
              onClick={parseWithAI}
              disabled={busyAI || !aiQuery.trim()}
              aria-label="AI search"
            >
              {busyAI ? (
                <>
                  <span
                    className="spinner"
                    style={{
                      borderTopColor: "#fff",
                      borderColor: "rgba(255,255,255,0.3)",
                      width: 13,
                      height: 13,
                    }}
                  />
                  <span>Thinking…</span>
                </>
              ) : (
                <>
                  <SparkleIcon size={14} />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>

          {/* ── "or" divider ── */}
          <div className="aiSep">
            <div className="aiSepLine" />
            <span className="aiSepText">or search manually</span>
            <div className="aiSepLine" />
          </div>

          {/* ── Structured search bar ── */}
          <div className={`heroBar${aiGlow ? " heroBarAiFilled" : ""}`}>
            <label className="heroBarField heroCityField">
              <span className="heroBarLabel">Where</span>
              <input
                className="heroBarInput"
                type="text"
                placeholder="City, address or postcode"
                value={filters.city}
                onChange={(e) => setFilter("city", e.target.value)}
                onKeyDown={handleSearchKey}
              />
            </label>

            <div className="heroBarSep" />

            <label className="heroBarField">
              <span className="heroBarLabel">From</span>
              <input
                className="heroBarInput"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            <div className="heroBarSep" />

            <label className="heroBarField">
              <span className="heroBarLabel">Until</span>
              <input
                className="heroBarInput"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>

            <button
              className="heroBarBtn"
              onClick={() => { setPage(1); fetchCars(1); }}
              disabled={!datesOk || busyCars}
              aria-label="Search"
            >
              {busyCars ? (
                <span
                  className="spinner"
                  style={{ borderTopColor: "#fff", borderColor: "rgba(255,255,255,0.3)" }}
                />
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Listings ── */}
      <div className="marketplaceContent" ref={listingsRef}>
        {!datesOk && (
          <StateNotice
            tone="warn"
            title="Date range is invalid"
            detail="End date must be on or after start date."
          />
        )}

        <div className="marketplaceBar">
          <div className="row" style={{ gap: 8 }}>
            <Button variant="secondary" onClick={() => setFiltersOpen((o) => !o)}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
            {!busyCars && total > 0 && (
              <span className="tiny muted">
                {total} car{total !== 1 ? "s" : ""} found
              </span>
            )}
          </div>
          <Badge tone={gates.canBook ? "ok" : "warn"}>
            {gates.canBook ? "Can book" : "Booking locked"}
          </Badge>
        </div>

        {filtersOpen && (
          <div className="filterPanel" style={{ marginBottom: 16 }}>
            <div className="grid3" style={{ marginBottom: 8 }}>
              <label className="field">
                <span className="fieldLabel">Make</span>
                <select
                  className="input"
                  value={filters.make}
                  onChange={(e) => setFilter("make", e.target.value)}
                >
                  <option value="">Any make</option>
                  {CAR_MAKES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="fieldLabel">Min price (GBP/day)</span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  placeholder="e.g. 20"
                  value={filters.minPrice}
                  onChange={(e) => setFilter("minPrice", e.target.value)}
                />
              </label>

              <label className="field">
                <span className="fieldLabel">Max price (GBP/day)</span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  placeholder="e.g. 100"
                  value={filters.maxPrice}
                  onChange={(e) => setFilter("maxPrice", e.target.value)}
                />
              </label>

              <label className="field">
                <span className="fieldLabel">Transmission</span>
                <select
                  className="input"
                  value={filters.transmission}
                  onChange={(e) => setFilter("transmission", e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="AUTOMATIC">Automatic</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </label>

              <label className="field">
                <span className="fieldLabel">Fuel type</span>
                <select
                  className="input"
                  value={filters.fuelType}
                  onChange={(e) => setFilter("fuelType", e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="PETROL">Petrol</option>
                  <option value="DIESEL">Diesel</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="ELECTRIC">Electric</option>
                </select>
              </label>

              <label className="field">
                <span className="fieldLabel">Min seats</span>
                <select
                  className="input"
                  value={filters.minSeats}
                  onChange={(e) => setFilter("minSeats", e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="2">2+</option>
                  <option value="4">4+</option>
                  <option value="5">5+</option>
                  <option value="7">7+</option>
                </select>
              </label>
            </div>

            <div className="row" style={{ justifyContent: "flex-end" }}>
              {activeFilterCount > 0 && (
                <Button variant="ghost" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
              <Button onClick={() => { setPage(1); fetchCars(1); }} loading={busyCars}>
                Apply filters
              </Button>
            </div>
          </div>
        )}

        {activeFilterCount > 0 && !filtersOpen && (
          <div className="row" style={{ margin: "0 0 16px", flexWrap: "wrap", gap: 6 }}>
            {filters.city ? <span className="chip chipOn">City: {filters.city}</span> : null}
            {filters.make ? <span className="chip chipOn">{filters.make}</span> : null}
            {filters.minPrice ? <span className="chip chipOn">Min {filters.minPrice} GBP</span> : null}
            {filters.maxPrice ? <span className="chip chipOn">Max {filters.maxPrice} GBP</span> : null}
            {filters.transmission ? <span className="chip chipOn">{filters.transmission}</span> : null}
            {filters.fuelType ? <span className="chip chipOn">{filters.fuelType}</span> : null}
            {filters.minSeats ? <span className="chip chipOn">{filters.minSeats}+ seats</span> : null}
            <button className="chip" onClick={clearFilters}>
              Clear all x
            </button>
          </div>
        )}

        {busyCars ? (
          <StateNotice title="Searching listings..." detail="Checking availability and filters." />
        ) : cars.length === 0 ? (
          <StateNotice
            title="No cars found"
            detail="Try widening the date range or removing one or more filters."
          />
        ) : (
          <>
            <div className="grid">
              {cars.map((c) => {
                const canRequest = gates.canBook && datesOk;
                const cover = carCoverUrl(c);

                return (
                  <div className="tile" key={c.id}>
                    <div className="tileTop">
                      <div className="tileTitle">
                        {c.make} {c.model}
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                        <Badge tone={c.status === "AVAILABLE" ? "ok" : "warn"}>{c.status}</Badge>
                        {c.instant_book_enabled ? <Badge tone="ok">⚡ Instant</Badge> : null}
                      </div>
                    </div>

                    <div className="tileMedia">
                      {cover ? (
                        <img className="tileImg" src={cover} alt={`${c.make} ${c.model}`} />
                      ) : (
                        <div className="tileImgPlaceholder">No photo</div>
                      )}
                    </div>

                    <div className="tileMeta">
                      <div className="mono">{c.year}</div>
                      <div className="mono">{c.daily_price} GBP/day</div>
                      <div className="mono">{c.city || "-"}</div>
                      {c.cancellation_policy ? (
                        <div className="tiny muted">
                          {c.cancellation_policy === "FLEXIBLE" ? "Flexible cancellation" :
                           c.cancellation_policy === "MODERATE" ? "Moderate cancellation" :
                           "Strict cancellation"}
                        </div>
                      ) : null}
                    </div>

                    <div className="tileDetails">
                      <div className="detail">
                        <span className="muted">Transmission</span>
                        <span className="mono">{c.transmission || "-"}</span>
                      </div>
                      <div className="detail">
                        <span className="muted">Fuel</span>
                        <span className="mono">{c.fuel_type || "-"}</span>
                      </div>
                      <div className="detail">
                        <span className="muted">Seats</span>
                        <span className="mono">{c.seats ?? "-"}</span>
                      </div>
                      <div className="detail">
                        <span className="muted">Color</span>
                        <span className="mono">{c.color || "-"}</span>
                      </div>
                    </div>

                    {c.owner ? (
                      <div className="tileOwner">
                        <span>By</span>
                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{c.owner.full_name}</span>
                        {c.owner.member_since ? (
                          <span>- since {new Date(c.owner.member_since).getFullYear()}</span>
                        ) : null}
                        <span>- {c.owner.listing_count} listing{c.owner.listing_count !== 1 ? "s" : ""}</span>
                        <span>- {c.owner.avg_rating ? c.owner.avg_rating.toFixed(1) : "No"} rating</span>
                        <span>
                          ({c.owner.review_count || 0} review{c.owner.review_count === 1 ? "" : "s"})
                        </span>
                      </div>
                    ) : null}

                    <div className="tileActions">
                      <Button
                        onClick={() => openSafety(c.id)}
                        disabled={!canRequest}
                        loading={busyBooking === c.id}
                      >
                        Request Booking
                      </Button>

                      {canDeleteCar(c) ? (
                        <Button
                          variant="danger"
                          onClick={() => deleteCarListing(c.id)}
                          loading={busyDelete === c.id}
                        >
                          Delete
                        </Button>
                      ) : null}

                      {!gates.canBook ? (
                        <div className="tiny muted">Unlock booking: verify email and get license approved.</div>
                      ) : !datesOk ? (
                        <div className="tiny muted">Pick a valid date range first.</div>
                      ) : (
                        <div className="tiny muted">
                          {startDate} to {endDate}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {Math.ceil(total / PAGE_SIZE) > 1 && (
              <div className="row" style={{ justifyContent: "center", marginTop: 16, gap: 8 }}>
                <Button
                  variant="secondary"
                  onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchCars(p); }}
                  disabled={page <= 1 || busyCars}
                >
                  Previous
                </Button>
                <span className="tiny muted" style={{ alignSelf: "center" }}>
                  Page {page} of {Math.ceil(total / PAGE_SIZE)}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => { const p = Math.min(Math.ceil(total / PAGE_SIZE), page + 1); setPage(p); fetchCars(p); }}
                  disabled={page >= Math.ceil(total / PAGE_SIZE) || busyCars}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <SafetyInfoModal
        open={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        onConfirm={() => requestBooking(pendingCarId)}
        busy={busyBooking === pendingCarId}
      />
    </div>
  );
}
