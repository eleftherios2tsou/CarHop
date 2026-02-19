import { useState, useEffect, useMemo } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import StateNotice from "../components/ui/StateNotice";
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
  minPrice: "",
  maxPrice: "",
  transmission: "",
  fuelType: "",
  minSeats: "",
};

const PAGE_SIZE = 20;

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

  const datesOk = isValidDateRange(startDate, endDate);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => v !== "").length,
    [filters]
  );

  function buildQueryString(targetPage = page) {
    const params = new URLSearchParams();
    if (datesOk) {
      params.set("from", startDate);
      params.set("to", endDate);
    }
    if (filters.city) params.set("city", filters.city);
    if (filters.minPrice) params.set("min_price", filters.minPrice);
    if (filters.maxPrice) params.set("max_price", filters.maxPrice);
    if (filters.transmission) params.set("transmission", filters.transmission);
    if (filters.fuelType) params.set("fuel_type", filters.fuelType);
    if (filters.minSeats) params.set("min_seats", filters.minSeats);
    params.set("page", String(targetPage));
    params.set("page_size", String(PAGE_SIZE));
    return `?${params.toString()}`;
  }

  async function fetchCars(targetPage = page) {
    setBusyCars(true);
    try {
      const data = await apiFetch(`/cars/${buildQueryString(targetPage)}`);
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
      onBookingMade();
    } catch (err) {
      notify(`Booking error: ${err.message}`, "bad");
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

  return (
    <Card
      title="Marketplace"
      subtitle="Find available cars by date, location, price, and features."
      right={
        <Badge tone={gates.canBook ? "ok" : "warn"}>
          {gates.canBook ? "Can book" : "Booking locked"}
        </Badge>
      }
    >
      <div className="row" style={{ marginBottom: 8 }}>
        <label className="field" style={{ flex: 2 }}>
          <span className="fieldLabel">City or location</span>
          <input
            className="input"
            type="text"
            placeholder="e.g. Bristol"
            value={filters.city}
            onChange={(e) => setFilter("city", e.target.value)}
          />
        </label>
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
        <div className="row" style={{ alignItems: "flex-end", gap: 8 }}>
          <Button variant="secondary" onClick={() => setFiltersOpen((o) => !o)}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
          <Button onClick={() => { setPage(1); fetchCars(1); }} loading={busyCars} disabled={!datesOk}>
            Search
          </Button>
        </div>
      </div>

      {!datesOk ? (
        <StateNotice
          tone="warn"
          title="Date range is invalid"
          detail="End date must be on or after start date."
        />
      ) : null}

      {filtersOpen ? (
        <div className="filterPanel" style={{ marginTop: 10 }}>
          <div className="grid3" style={{ marginBottom: 8 }}>
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
            {activeFilterCount > 0 ? (
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
            <Button onClick={() => { setPage(1); fetchCars(1); }} loading={busyCars}>
              Apply filters
            </Button>
          </div>
        </div>
      ) : null}

      {activeFilterCount > 0 && !filtersOpen ? (
        <div className="row" style={{ margin: "10px 0", flexWrap: "wrap", gap: 6 }}>
          {filters.city ? <span className="chip chipOn">City: {filters.city}</span> : null}
          {filters.minPrice ? <span className="chip chipOn">Min {filters.minPrice} GBP</span> : null}
          {filters.maxPrice ? <span className="chip chipOn">Max {filters.maxPrice} GBP</span> : null}
          {filters.transmission ? <span className="chip chipOn">{filters.transmission}</span> : null}
          {filters.fuelType ? <span className="chip chipOn">{filters.fuelType}</span> : null}
          {filters.minSeats ? <span className="chip chipOn">{filters.minSeats}+ seats</span> : null}
          <button className="chip" onClick={clearFilters}>
            Clear all x
          </button>
        </div>
      ) : null}

      {busyCars ? (
        <StateNotice title="Searching listings..." detail="Checking availability and filters." />
      ) : cars.length === 0 ? (
        <StateNotice
          title="No cars found"
          detail="Try widening the date range or removing one or more filters."
        />
      ) : (
        <>
          <div className="tiny muted" style={{ marginBottom: 10 }}>
            {total} car{total !== 1 ? "s" : ""} found
          </div>
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
                    <Badge tone={c.status === "AVAILABLE" ? "ok" : "warn"}>{c.status}</Badge>
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
                      onClick={() => requestBooking(c.id)}
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

          {Math.ceil(total / PAGE_SIZE) > 1 ? (
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
          ) : null}
        </>
      )}
    </Card>
  );
}
