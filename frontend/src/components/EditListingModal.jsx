import { useState, useEffect } from "react";
import Modal from "./ui/Modal";
import { Field, SelectField, TextAreaField } from "./ui/Field";
import Button from "./ui/Button";
import Badge from "./ui/Badge";
import { filesToPreviews } from "../lib/photos";

export default function EditListingModal({
  open,
  carDetail,
  onClose,
  onSave,
  onDelete,
  onUploadPhotos,
  onDeletePhoto,
  busy,
}) {
  const [form, setForm] = useState({
    daily_price: "",
    city: "",
    postcode: "",
    transmission: "",
    fuel_type: "",
    seats: "",
    doors: "",
    mileage: "",
    color: "",
    description: "",
    status: "AVAILABLE",
  });
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadPreviews, setUploadPreviews] = useState([]);

  // Reset form whenever a different car is opened
  useEffect(() => {
    if (!carDetail) return;
    setForm({
      daily_price: carDetail.daily_price ?? "",
      city: carDetail.city ?? "",
      postcode: carDetail.postcode ?? "",
      transmission: carDetail.transmission ?? "",
      fuel_type: carDetail.fuel_type ?? "",
      seats: carDetail.seats ?? "",
      doors: carDetail.doors ?? "",
      mileage: carDetail.mileage ?? "",
      color: carDetail.color ?? "",
      description: carDetail.description ?? "",
      status: carDetail.status ?? "AVAILABLE",
    });
    setUploadFiles([]);
    setUploadPreviews([]);
  }, [carDetail?.id]);

  async function onPickPhotos(e) {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type?.startsWith("image/")
    );
    if (files.length === 0) {
      e.target.value = "";
      return;
    }
    const previews = await filesToPreviews(files);
    setUploadFiles((prev) => [...prev, ...files]);
    setUploadPreviews((prev) => [...prev, ...previews]);
    e.target.value = "";
  }

  function removeUploadByIndex(idx) {
    setUploadFiles((prev) => prev.filter((_, i) => i !== idx));
    setUploadPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearUpload() {
    setUploadFiles([]);
    setUploadPreviews([]);
  }

  function handleSave() {
    const patch = {
      daily_price: form.daily_price === "" ? null : Number(form.daily_price),
      city: form.city || null,
      postcode: form.postcode || null,
      transmission: form.transmission || null,
      fuel_type: form.fuel_type || null,
      seats: form.seats === "" ? null : Number(form.seats),
      doors: form.doors === "" ? null : Number(form.doors),
      mileage: form.mileage === "" ? null : Number(form.mileage),
      color: form.color || null,
      description: form.description || null,
      status: form.status || null,
    };
    onSave(patch);
  }

  async function handleUpload() {
    await onUploadPhotos(uploadFiles);
    clearUpload();
  }

  const carId = carDetail?.id;

  return (
    <Modal
      open={open}
      title={carId ? `Edit Listing #${carId}` : "Edit Listing"}
      onClose={onClose}
    >
      {!carId ? (
        <div className="muted">No car selected.</div>
      ) : !carDetail ? (
        <div className="muted">Loading…</div>
      ) : (
        <div className="form" style={{ maxWidth: 860 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div className="tiny muted">
              {carDetail.make} {carDetail.model} · {carDetail.year}
            </div>
            <Badge tone={carDetail.status === "AVAILABLE" ? "ok" : "warn"}>
              {carDetail.status}
            </Badge>
          </div>

          <div className="divider" />

          <div className="sectionTitle">Pricing & Status</div>
          <div className="grid3">
            <Field
              label="Daily price (£)"
              type="number"
              value={form.daily_price}
              onChange={(e) => setForm((f) => ({ ...f, daily_price: e.target.value }))}
            />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              options={[
                { value: "AVAILABLE", label: "AVAILABLE" },
                { value: "UNAVAILABLE", label: "UNAVAILABLE" },
              ]}
            />
            <div />
          </div>

          <div className="sectionTitle">Location</div>
          <div className="grid2">
            <Field
              label="City"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
            <Field
              label="Postcode"
              value={form.postcode}
              onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
            />
          </div>

          <div className="sectionTitle">Specs</div>
          <div className="grid3">
            <SelectField
              label="Transmission"
              value={form.transmission}
              onChange={(e) => setForm((f) => ({ ...f, transmission: e.target.value }))}
              options={[
                { value: "", label: "—" },
                { value: "AUTOMATIC", label: "Automatic" },
                { value: "MANUAL", label: "Manual" },
              ]}
            />
            <SelectField
              label="Fuel type"
              value={form.fuel_type}
              onChange={(e) => setForm((f) => ({ ...f, fuel_type: e.target.value }))}
              options={[
                { value: "", label: "—" },
                { value: "PETROL", label: "Petrol" },
                { value: "DIESEL", label: "Diesel" },
                { value: "HYBRID", label: "Hybrid" },
                { value: "ELECTRIC", label: "Electric" },
              ]}
            />
            <Field
              label="Color"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
            <Field
              label="Seats"
              type="number"
              min="1"
              value={form.seats}
              onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value }))}
            />
            <Field
              label="Doors"
              type="number"
              min="2"
              value={form.doors}
              onChange={(e) => setForm((f) => ({ ...f, doors: e.target.value }))}
            />
            <Field
              label="Mileage"
              type="number"
              min="0"
              value={form.mileage}
              onChange={(e) => setForm((f) => ({ ...f, mileage: e.target.value }))}
            />
          </div>

          <TextAreaField
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
          />

          <div className="sectionTitle">Photos</div>
          {carDetail.photos?.length ? (
            <div className="photoGrid">
              {carDetail.photos.map((p) => (
                <div className="photoTile" key={p.id}>
                  <img src={p.url} alt="car" className="photoImg" />
                  <button
                    type="button"
                    className="photoX"
                    onClick={() => onDeletePhoto(p.id)}
                    aria-label="delete photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="tiny muted">No photos yet.</div>
          )}

          <div style={{ marginTop: 10 }} className="photoBox">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="tiny muted">
                Upload more photos (max 8 total enforced by backend).
              </div>
              <label
                className="btn btnSecondary"
                style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
              >
                <span>Add photos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={onPickPhotos}
                />
              </label>
            </div>

            {uploadPreviews.length ? (
              <>
                <div className="photoGrid" style={{ marginTop: 10 }}>
                  {uploadPreviews.map((p, idx) => (
                    <div className="photoTile" key={p.id}>
                      <img src={p.dataUrl} alt={p.name} className="photoImg" />
                      <button
                        type="button"
                        className="photoX"
                        onClick={() => removeUploadByIndex(idx)}
                        aria-label="remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <Button variant="secondary" onClick={handleUpload} loading={busy.editUpload}>
                    Upload selected
                  </Button>
                  <Button variant="ghost" onClick={clearUpload}>
                    Clear selection
                  </Button>
                </div>
              </>
            ) : (
              <div className="tiny muted" style={{ marginTop: 10 }}>
                No new photos selected.
              </div>
            )}
          </div>

          <div className="divider" />

          <div className="row" style={{ justifyContent: "space-between" }}>
            <Button
              variant="danger"
              onClick={onDelete}
              disabled={busy.saving || busy.editUpload}
            >
              Delete Listing
            </Button>
            <div className="row">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={busy.saving}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
