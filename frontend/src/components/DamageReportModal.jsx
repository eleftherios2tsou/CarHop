import { useEffect, useRef, useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { Field, TextAreaField } from "./ui/Field";
import { filesToPreviews } from "../lib/photos";

const MAX_PHOTOS = 5;

export default function DamageReportModal({ open, bookingId, busy, onClose, onSubmit }) {
  const [description, setDescription] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setDescription("");
    setEstimatedCost("");
    setPhotoFiles([]);
    setPhotoPreviews([]);
  }, [open, bookingId]);

  async function onPickPhotos(e) {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type?.startsWith("image/")
    );
    if (!files.length) {
      e.target.value = "";
      return;
    }
    const remaining = MAX_PHOTOS - photoFiles.length;
    const sliced = files.slice(0, remaining);
    const previews = await filesToPreviews(sliced);
    setPhotoFiles((prev) => [...prev, ...sliced]);
    setPhotoPreviews((prev) => [...prev, ...previews]);
    e.target.value = "";
  }

  function removePhoto(idx) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const d = description.trim();
    if (d.length < 10) return;

    const fd = new FormData();
    fd.append("description", d);
    if (estimatedCost !== "" && Number(estimatedCost) > 0) {
      fd.append("estimated_cost", String(Number(estimatedCost)));
    }
    for (const f of photoFiles) {
      fd.append("photos", f);
    }

    await onSubmit({ bookingId, formData: fd });
  }

  const canSubmit = description.trim().length >= 10;

  return (
    <Modal
      open={open}
      title={bookingId ? `File Damage Report — Booking #${bookingId}` : "File Damage Report"}
      onClose={onClose}
    >
      <form className="form" onSubmit={handleSubmit}>
        <TextAreaField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe the damage in detail (minimum 10 characters)"
          required
        />

        <Field
          label="Estimated repair cost (£, optional)"
          type="number"
          min="0"
          step="0.01"
          value={estimatedCost}
          onChange={(e) => setEstimatedCost(e.target.value)}
          placeholder="e.g. 500"
        />

        <div>
          <div className="fieldLabel" style={{ marginBottom: 6 }}>
            Photos (optional, max {MAX_PHOTOS})
          </div>
          {photoPreviews.length > 0 && (
            <div className="photoGrid" style={{ marginBottom: 10 }}>
              {photoPreviews.map((p, idx) => (
                <div className="photoTile" key={p.id}>
                  <img src={p.dataUrl} alt={p.name} className="photoImg" />
                  <button
                    type="button"
                    className="photoX"
                    onClick={() => removePhoto(idx)}
                    aria-label="remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {photoFiles.length < MAX_PHOTOS && (
            <label
              className="btn btnSecondary"
              style={{ display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}
            >
              <span>Add photos</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={onPickPhotos}
              />
            </label>
          )}
        </div>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!canSubmit}>
            Submit Report
          </Button>
        </div>
      </form>
    </Modal>
  );
}
