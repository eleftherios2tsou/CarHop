import { useState, useEffect } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
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
      notify(`Listing #${editCarId} updated ✅`, "ok");
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
      notify("Photos uploaded ✅", "ok");
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
      notify("Photo deleted ✅", "ok");
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

      <Card title="My Listings" subtitle="Manage your listings: edit details + manage photos.">
        {!isAuthed ? (
          <p className="muted">Login to view your listings.</p>
        ) : busyCars && myCars.length === 0 ? (
          <p className="muted">Loading…</p>
        ) : myCars.length === 0 ? (
          <p className="muted">You haven't listed any cars yet.</p>
        ) : (
          <div className="stack">
            {myCars.map((c) => {
              const open = expandedCarId === c.id;
              const detail = carDetails[c.id];
              const cover = carCoverUrl(c);

              return (
                <div className="rowCard" key={c.id} style={{ alignItems: "flex-start" }}>
                  <div className="rowCardMain" style={{ flex: 1 }}>
                    <div className="rowCardTitle">
                      #{c.id} · {c.make} {c.model}{" "}
                      <span className="muted">· {c.year}</span>
                    </div>

                    <div className="rowCardSub">
                      £<span className="mono">{c.daily_price}</span>/day ·{" "}
                      <span className="mono">{c.city || "—"}</span>
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
                        variant="danger"
                        onClick={() => deleteListingDirectly(c.id)}
                        disabled={busyCars}
                      >
                        Delete
                      </Button>
                    </div>

                    {open ? (
                      <div style={{ marginTop: 12 }}>
                        <div className="divider" />
                        <div className="tiny muted" style={{ marginBottom: 10 }}>
                          Listing details (read-only). Use{" "}
                          <span className="mono">Edit</span> to change fields.
                        </div>
                        {!detail ? (
                          <div className="tiny muted">Loading…</div>
                        ) : (
                          <div className="grid2">
                            <div className="kv">
                              <div className="k">Status</div>
                              <div className="v">
                                <Badge tone={detail.status === "AVAILABLE" ? "ok" : "warn"}>
                                  {detail.status}
                                </Badge>
                              </div>
                            </div>
                            <div className="kv">
                              <div className="k">Postcode</div>
                              <div className="v mono">{detail.postcode || "—"}</div>
                            </div>
                            <div className="kv">
                              <div className="k">Transmission</div>
                              <div className="v mono">{detail.transmission || "—"}</div>
                            </div>
                            <div className="kv">
                              <div className="k">Fuel</div>
                              <div className="v mono">{detail.fuel_type || "—"}</div>
                            </div>
                            <div className="kv">
                              <div className="k">Seats</div>
                              <div className="v mono">{detail.seats ?? "—"}</div>
                            </div>
                            <div className="kv">
                              <div className="k">Doors</div>
                              <div className="v mono">{detail.doors ?? "—"}</div>
                            </div>
                          </div>
                        )}
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
