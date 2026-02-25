import { useState, useEffect } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import StateNotice from "../components/ui/StateNotice";
import EditListingModal from "../components/EditListingModal";
import { apiFetch, apiFetchForm } from "../lib/api";

export default function MyListingsPage({ isAuthed, notify, onAuthError }) {
  const [myCars, setMyCars] = useState([]);
  const [expandedCarId, setExpandedCarId] = useState(null);
  const [carDetails, setCarDetails] = useState({});
  const [busyCars, setBusyCars] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCarId, setEditCarId] = useState(null);
  const [busySaving, setBusySaving] = useState(false);
  const [busyUpload, setBusyUpload] = useState(false);

  // availability blocks
  const [availabilityByCarId, setAvailabilityByCarId] = useState({});
  const [blockDraftByCar, setBlockDraftByCar] = useState({});
  const [busyBlock, setBusyBlock] = useState(null);
  const [openAvailCarId, setOpenAvailCarId] = useState(null);

  async function fetchMyCars() {
    setBusyCars(true);
    try {
      const data = await apiFetch("/cars/mine", { onAuthError });
      setMyCars(Array.isArray(data) ? data : []);
    } catch {
      setMyCars([]);
    } finally {
      setBusyCars(false);
    }
  }

  async function loadCarDetail(carId) {
    try {
      const data = await apiFetch(`/cars/${carId}`, { onAuthError });
      setCarDetails((m) => ({ ...m, [carId]: data }));
      return data;
    } catch (e) {
      notify(e.message, "bad");
      return null;
    }
  }

  useEffect(() => {
    if (isAuthed) fetchMyCars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  async function openEditModal(carId) {
    setEditCarId(carId);
    const detail = await loadCarDetail(carId);
    if (!detail) return;
    setEditOpen(true);
  }

  function closeEditModal() {
    setEditOpen(false);
    setEditCarId(null);
  }

  async function handleSave(patch) {
    if (!editCarId) return;
    setBusySaving(true);
    try {
      await apiFetch(`/cars/${editCarId}`, {
        method: "PATCH",
        onAuthError,
        body: JSON.stringify(patch),
      });
      notify(`Listing #${editCarId} updated`, "ok");
      await loadCarDetail(editCarId);
      await fetchMyCars();
      closeEditModal();
    } catch (e) {
      notify(`Update error: ${e.message}`, "bad");
    } finally {
      setBusySaving(false);
    }
  }

  async function handleDelete() {
    if (!editCarId) return;
    if (!window.confirm("Delete this listing permanently?")) return;
    setBusyCars(true);
    try {
      await apiFetch(`/cars/${editCarId}`, { method: "DELETE", onAuthError });
      notify(`Listing #${editCarId} deleted`, "ok");
      closeEditModal();
      await fetchMyCars();
    } catch (err) {
      notify(`Delete error: ${err.message}`, "bad");
    } finally {
      setBusyCars(false);
    }
  }

  async function handleUploadPhotos(files) {
    if (!editCarId || files.length === 0) return;
    setBusyUpload(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      await apiFetchForm(`/cars/${editCarId}/photos`, fd, { onAuthError });
      notify("Photos uploaded", "ok");
      await loadCarDetail(editCarId);
      await fetchMyCars();
    } catch (e) {
      notify(`Upload error: ${e.message}`, "bad");
    } finally {
      setBusyUpload(false);
    }
  }

  async function handleDeletePhoto(photoId) {
    if (!editCarId) return;
    if (!window.confirm("Delete this photo?")) return;
    try {
      await apiFetch(`/cars/${editCarId}/photos/${photoId}`, {
        method: "DELETE",
        onAuthError,
      });
      notify("Photo deleted", "ok");
      await loadCarDetail(editCarId);
      await fetchMyCars();
    } catch (e) {
      notify(`Delete photo error: ${e.message}`, "bad");
    }
  }

  async function deleteListingDirectly(carId) {
    if (!window.confirm("Delete this listing permanently?")) return;
    setBusyCars(true);
    try {
      await apiFetch(`/cars/${carId}`, { method: "DELETE", onAuthError });
      notify(`Listing #${carId} deleted`, "ok");
      setMyCars((prev) => prev.filter((c) => c.id !== carId));
    } catch (err) {
      notify(`Delete error: ${err.message}`, "bad");
    } finally {
      setBusyCars(false);
    }
  }

  async function toggleInstantBook(carId, enabled) {
    try {
      await apiFetch(`/cars/${carId}/instant-book`, {
        method: "PATCH",
        onAuthError,
        body: JSON.stringify({ enabled }),
      });
      notify(enabled ? "Instant Book enabled" : "Instant Book disabled", "ok");
      await fetchMyCars();
    } catch (e) {
      notify(e.message, "bad");
    }
  }

  async function loadAvailability(carId) {
    try {
      const data = await apiFetch(`/cars/${carId}/availability`, { onAuthError });
      setAvailabilityByCarId((m) => ({ ...m, [carId]: Array.isArray(data) ? data : [] }));
    } catch (e) {
      notify(`Could not load availability: ${e.message}`, "bad");
    }
  }

  function setBlockDraft(carId, patch) {
    setBlockDraftByCar((m) => ({ ...m, [carId]: { ...(m[carId] || {}), ...patch } }));
  }

  async function addBlock(carId) {
    const draft = blockDraftByCar[carId] || {};
    if (!draft.start_date || !draft.end_date) {
      notify("Please provide both start and end dates", "warn");
      return;
    }
    setBusyBlock(carId);
    try {
      await apiFetch(`/cars/${carId}/availability/block`, {
        method: "POST",
        onAuthError,
        body: JSON.stringify({
          start_date: draft.start_date,
          end_date: draft.end_date,
          reason: draft.reason || null,
        }),
      });
      setBlockDraftByCar((m) => ({ ...m, [carId]: {} }));
      await loadAvailability(carId);
      notify("Dates blocked", "ok");
    } catch (e) {
      notify(`Block error: ${e.message}`, "bad");
    } finally {
      setBusyBlock(null);
    }
  }

  async function removeBlock(carId, blockId) {
    setBusyBlock(blockId);
    try {
      await apiFetch(`/cars/${carId}/availability/blocks/${blockId}`, {
        method: "DELETE",
        onAuthError,
      });
      await loadAvailability(carId);
      notify("Block removed", "ok");
    } catch (e) {
      notify(`Remove error: ${e.message}`, "bad");
    } finally {
      setBusyBlock(null);
    }
  }

  function carCoverUrl(c) {
    return c?.photo_urls?.[0] || "";
  }

  return (
    <>
      <EditListingModal
        open={editOpen}
        carDetail={editCarId ? carDetails[editCarId] : null}
        onClose={closeEditModal}
        onSave={handleSave}
        onDelete={handleDelete}
        onUploadPhotos={handleUploadPhotos}
        onDeletePhoto={handleDeletePhoto}
        busy={{ saving: busySaving, editUpload: busyUpload }}
      />

      <Card title="My Listings" subtitle="Manage your listings: edit details and manage photos.">
        {!isAuthed ? (
          <StateNotice title="Login required" detail="Sign in to manage your own listings." />
        ) : busyCars && myCars.length === 0 ? (
          <StateNotice title="Loading listings..." detail="Fetching your published cars." />
        ) : myCars.length === 0 ? (
          <StateNotice title="No listings yet" detail="Create your first listing from the List Car tab." />
        ) : (
          <div className="stack">
            {myCars.map((c) => {
              const open = expandedCarId === c.id;
              const detail = carDetails[c.id];
              const cover = carCoverUrl(c);

              const availOpen = openAvailCarId === c.id;
              const blocks = availabilityByCarId[c.id] || [];
              const blockDraft = blockDraftByCar[c.id] || {};

              return (
                <div className="rowCard" key={c.id} style={{ alignItems: "flex-start" }}>
                  <div className="rowCardMain" style={{ flex: 1 }}>
                    <div className="rowCardTitle">
                      #{c.id} - {c.make} {c.model} <span className="muted">- {c.year}</span>
                    </div>

                    <div className="rowCardSub">
                      GBP <span className="mono">{c.daily_price}</span>/day - <span className="mono">{c.city || "-"}</span>
                    </div>

                    {cover ? (
                      <div style={{ marginTop: 10 }}>
                        <img
                          src={cover}
                          alt="cover"
                          style={{ width: "100%", maxWidth: 360, borderRadius: 12 }}
                        />
                      </div>
                    ) : null}

                    <div className="row" style={{ marginTop: 10 }}>
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          if (!open) await loadCarDetail(c.id);
                          setExpandedCarId(open ? null : c.id);
                        }}
                      >
                        {open ? "Collapse" : "Details"}
                      </Button>

                      <Button onClick={() => openEditModal(c.id)}>Edit</Button>

                      <Button
                        variant="secondary"
                        onClick={async () => {
                          if (!availOpen) await loadAvailability(c.id);
                          setOpenAvailCarId(availOpen ? null : c.id);
                        }}
                      >
                        {availOpen ? "Hide Availability" : "Manage Availability"}
                      </Button>

                      <Button
                        variant="danger"
                        onClick={() => deleteListingDirectly(c.id)}
                        disabled={busyCars}
                      >
                        Delete
                      </Button>
                    </div>

                    <div className="row" style={{ marginTop: 8, alignItems: "center", gap: 10 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={c.instant_book_enabled || false}
                          onChange={(e) => toggleInstantBook(c.id, e.target.checked)}
                        />
                        <span className="tiny">⚡ Instant Book</span>
                      </label>
                      <span className="tiny muted">(requires 5+ reviews avg ≥ 4.5★)</span>
                    </div>

                    {open ? (
                      <div style={{ marginTop: 12 }}>
                        <div className="divider" />
                        <div className="tiny muted" style={{ marginBottom: 10 }}>
                          Listing details (read-only). Use <span className="mono">Edit</span> to change fields.
                        </div>
                        {!detail ? (
                          <div className="tiny muted">Loading...</div>
                        ) : (
                          <div className="grid2">
                            <div className="kv">
                              <div className="k">Status</div>
                              <div className="v">
                                <Badge tone={detail.status === "AVAILABLE" ? "ok" : "warn"}>{detail.status}</Badge>
                              </div>
                            </div>
                            <div className="kv">
                              <div className="k">Postcode</div>
                              <div className="v mono">{detail.postcode || "-"}</div>
                            </div>
                            <div className="kv">
                              <div className="k">Transmission</div>
                              <div className="v mono">{detail.transmission || "-"}</div>
                            </div>
                            <div className="kv">
                              <div className="k">Fuel</div>
                              <div className="v mono">{detail.fuel_type || "-"}</div>
                            </div>
                            <div className="kv">
                              <div className="k">Seats</div>
                              <div className="v mono">{detail.seats ?? "-"}</div>
                            </div>
                            <div className="kv">
                              <div className="k">Doors</div>
                              <div className="v mono">{detail.doors ?? "-"}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {availOpen ? (
                      <div style={{ marginTop: 12 }}>
                        <div className="divider" />
                        <div className="rowCardTitle" style={{ fontSize: 14, marginBottom: 8 }}>
                          Availability Blocks
                        </div>

                        {blocks.length === 0 ? (
                          <div className="tiny muted" style={{ marginBottom: 10 }}>No blocked dates yet.</div>
                        ) : (
                          <div className="stack" style={{ marginBottom: 10, gap: 6 }}>
                            {blocks.map((blk) => (
                              <div key={blk.id} className="row" style={{ alignItems: "center", gap: 8 }}>
                                <span className="mono tiny">
                                  {blk.start_date} → {blk.end_date}
                                </span>
                                {blk.reason ? (
                                  <span className="tiny muted">({blk.reason})</span>
                                ) : null}
                                <Button
                                  variant="danger"
                                  onClick={() => removeBlock(c.id, blk.id)}
                                  disabled={busyBlock === blk.id}
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="tiny muted" style={{ marginBottom: 6 }}>Add a new block:</div>
                        <div className="row" style={{ flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
                          <div>
                            <div className="tiny muted" style={{ marginBottom: 2 }}>From</div>
                            <input
                              type="date"
                              value={blockDraft.start_date || ""}
                              onChange={(e) => setBlockDraft(c.id, { start_date: e.target.value })}
                              className="input"
                            />
                          </div>
                          <div>
                            <div className="tiny muted" style={{ marginBottom: 2 }}>To</div>
                            <input
                              type="date"
                              value={blockDraft.end_date || ""}
                              onChange={(e) => setBlockDraft(c.id, { end_date: e.target.value })}
                              className="input"
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 120 }}>
                            <div className="tiny muted" style={{ marginBottom: 2 }}>Reason (optional)</div>
                            <input
                              type="text"
                              value={blockDraft.reason || ""}
                              onChange={(e) => setBlockDraft(c.id, { reason: e.target.value })}
                              placeholder="e.g. Maintenance"
                              className="input"
                            />
                          </div>
                          <Button
                            onClick={() => addBlock(c.id)}
                            disabled={busyBlock === c.id}
                          >
                            {busyBlock === c.id ? "Blocking..." : "Block Dates"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
