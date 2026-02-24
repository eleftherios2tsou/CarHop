import { useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { Field, SelectField, TextAreaField } from "../components/ui/Field";
import { apiFetch, apiFetchForm } from "../lib/api";
import { filesToPreviews } from "../lib/photos";

export default function ListCarPage({ gates, notify, onAuthError, onCarCreated }) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [dailyPrice, setDailyPrice] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [transmission, setTransmission] = useState("AUTOMATIC");
  const [fuelType, setFuelType] = useState("PETROL");
  const [seats, setSeats] = useState(5);
  const [doors, setDoors] = useState(5);
  const [mileage, setMileage] = useState("");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState({
    ac: false,
    bluetooth: false,
    carplay: false,
    gps: false,
    heatedSeats: false,
  });
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [busy, setBusy] = useState(false);

  async function onPickPhotos(e) {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type?.startsWith("image/")
    );
    if (files.length === 0) {
      e.target.value = "";
      return;
    }
    const room = Math.max(0, 8 - photoFiles.length);
    const take = files.slice(0, room);
    const previews = await filesToPreviews(take);
    setPhotoFiles((prev) => [...prev, ...take].slice(0, 8));
    setPhotoPreviews((prev) => [...prev, ...previews].slice(0, 8));
    e.target.value = "";
  }

  function removePhotoByIndex(idx) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  async function createCar(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        make,
        model,
        year: Number(year),
        daily_price: Number(dailyPrice),
        availability_units: 1,
        city,
        postcode,
        transmission,
        fuel_type: fuelType,
        seats: seats === "" || seats === null ? null : Number(seats),
        doors: doors === "" || doors === null ? null : Number(doors),
        mileage: mileage === "" || mileage === null ? null : Number(mileage),
        color,
        features,
        description,
      };

      const created = await apiFetch("/cars/", {
        method: "POST",
        onAuthError,
        body: JSON.stringify(payload),
      });

      if (photoFiles.length > 0) {
        const fd = new FormData();
        for (const f of photoFiles) fd.append("files", f);
        await apiFetchForm(`/cars/${created.id}/photos`, fd, { onAuthError });
      }

      notify("Car listing created successfully.", "ok");
      onCarCreated();
    } catch (err) {
      notify(`Create car error: ${err.message}`, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="List a Car"
      subtitle="Owners can publish a listing. Requires email verification."
      right={
        <Badge tone={gates.canListCars ? "ok" : "warn"}>
          {gates.canListCars ? "Unlocked" : "Locked"}
        </Badge>
      }
    >
      <form className="form" onSubmit={createCar} style={{ maxWidth: 900 }}>
        <div className="sectionTitle">Basics</div>
        <div className="grid2">
          <SelectField
            label="Make"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            required
            options={[
              { value: "",               label: "Select a make…" },
              { value: "Abarth",         label: "Abarth" },
              { value: "Alfa Romeo",     label: "Alfa Romeo" },
              { value: "Aston Martin",   label: "Aston Martin" },
              { value: "Audi",           label: "Audi" },
              { value: "Bentley",        label: "Bentley" },
              { value: "BMW",            label: "BMW" },
              { value: "BYD",            label: "BYD" },
              { value: "Chevrolet",      label: "Chevrolet" },
              { value: "Chrysler",       label: "Chrysler" },
              { value: "Citroën",        label: "Citroën" },
              { value: "Cupra",          label: "Cupra" },
              { value: "Dacia",          label: "Dacia" },
              { value: "Dodge",          label: "Dodge" },
              { value: "DS",             label: "DS" },
              { value: "Ferrari",        label: "Ferrari" },
              { value: "Fiat",           label: "Fiat" },
              { value: "Ford",           label: "Ford" },
              { value: "Genesis",        label: "Genesis" },
              { value: "Honda",          label: "Honda" },
              { value: "Hyundai",        label: "Hyundai" },
              { value: "Infiniti",       label: "Infiniti" },
              { value: "Jaguar",         label: "Jaguar" },
              { value: "Jeep",           label: "Jeep" },
              { value: "Kia",            label: "Kia" },
              { value: "Lamborghini",    label: "Lamborghini" },
              { value: "Land Rover",     label: "Land Rover" },
              { value: "Lexus",          label: "Lexus" },
              { value: "Maserati",       label: "Maserati" },
              { value: "Mazda",          label: "Mazda" },
              { value: "McLaren",        label: "McLaren" },
              { value: "Mercedes-Benz",  label: "Mercedes-Benz" },
              { value: "MG",             label: "MG" },
              { value: "MINI",           label: "MINI" },
              { value: "Mitsubishi",     label: "Mitsubishi" },
              { value: "Nissan",         label: "Nissan" },
              { value: "Peugeot",        label: "Peugeot" },
              { value: "Polestar",       label: "Polestar" },
              { value: "Porsche",        label: "Porsche" },
              { value: "Renault",        label: "Renault" },
              { value: "Rolls-Royce",    label: "Rolls-Royce" },
              { value: "SEAT",           label: "SEAT" },
              { value: "Škoda",          label: "Škoda" },
              { value: "Smart",          label: "Smart" },
              { value: "Subaru",         label: "Subaru" },
              { value: "Suzuki",         label: "Suzuki" },
              { value: "Tesla",          label: "Tesla" },
              { value: "Toyota",         label: "Toyota" },
              { value: "Vauxhall",       label: "Vauxhall" },
              { value: "Volkswagen",     label: "Volkswagen" },
              { value: "Volvo",          label: "Volvo" },
            ]}
          />
          <Field
            label="Model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Corolla"
            required
          />
          <Field
            label="Year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2020"
            required
          />
          <Field
            label="Daily price (GBP)"
            type="number"
            value={dailyPrice}
            onChange={(e) => setDailyPrice(e.target.value)}
            placeholder="50"
            required
          />
        </div>

        <div className="sectionTitle">Location</div>
        <div className="grid2">
          <Field
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Bristol"
          />
          <Field
            label="Postcode"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="BS1"
          />
        </div>

        <div className="sectionTitle">Specs</div>
        <div className="grid3">
          <SelectField
            label="Transmission"
            value={transmission}
            onChange={(e) => setTransmission(e.target.value)}
            options={[
              { value: "AUTOMATIC", label: "Automatic" },
              { value: "MANUAL", label: "Manual" },
            ]}
          />
          <SelectField
            label="Fuel type"
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value)}
            options={[
              { value: "PETROL", label: "Petrol" },
              { value: "DIESEL", label: "Diesel" },
              { value: "HYBRID", label: "Hybrid" },
              { value: "ELECTRIC", label: "Electric" },
            ]}
          />
          <Field
            label="Color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="Grey"
          />
          <Field
            label="Seats"
            type="number"
            min="1"
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
          />
          <Field
            label="Doors"
            type="number"
            min="2"
            value={doors}
            onChange={(e) => setDoors(e.target.value)}
          />
          <Field
            label="Mileage"
            type="number"
            min="0"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            hint="Total miles (approx)"
          />
        </div>

        <div className="sectionTitle">Features</div>
        <div className="chipRow">
          {[
            ["ac", "A/C"],
            ["bluetooth", "Bluetooth"],
            ["carplay", "Apple CarPlay"],
            ["gps", "GPS"],
            ["heatedSeats", "Heated seats"],
          ].map(([key, label]) => {
            const on = !!features[key];
            return (
              <button
                key={key}
                type="button"
                className={on ? "chip chipOn" : "chip"}
                onClick={() => setFeatures((f) => ({ ...f, [key]: !f[key] }))}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="sectionTitle">Photos</div>
        <div className="photoBox">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="tiny muted">Real upload. Max 8 photos.</div>
            <label
              className="btn btnSecondary"
              style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
            >
              <span>Upload</span>
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={onPickPhotos}
              />
            </label>
          </div>

          {photoPreviews.length === 0 ? (
            <div className="photoEmpty">
              No photos yet. Add at least 1 for a realistic listing.
            </div>
          ) : (
            <div className="photoGrid">
              {photoPreviews.map((p, idx) => (
                <div className="photoTile" key={p.id}>
                  <img src={p.dataUrl} alt={p.name} className="photoImg" />
                  <button
                    type="button"
                    className="photoX"
                    onClick={() => removePhotoByIndex(idx)}
                    aria-label="remove photo"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <TextAreaField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />

        <Button type="submit" disabled={!gates.canListCars} loading={busy}>
          Publish Listing
        </Button>

        {!gates.canListCars ? (
          <div className="tiny muted">Unlock: login + verify email.</div>
        ) : null}
      </form>
    </Card>
  );
}
