import { useState, useEffect, useRef } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { Field } from "../components/ui/Field";
import { apiFetch, apiFetchForm } from "../lib/api";

// ─── helpers ────────────────────────────────────────────────────────────────

function LicenseStatusBadge({ status, rejectionReason }) {
  if (!status) return null;
  const map = {
    pending:       { tone: "warn",    label: "Not submitted" },
    processing:    { tone: "warn",    label: "Verifying…" },
    approved:      { tone: "ok",      label: "Verified" },
    manual_review: { tone: "warn",    label: "Under review" },
    rejected:      { tone: "bad",     label: "Rejected" },
  };
  const { tone, label } = map[status] ?? { tone: "warn", label: status };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {status === "processing" && (
        <span className="spinner" style={{ width: 12, height: 12 }} />
      )}
      <Badge tone={tone}>{label}</Badge>
      {status === "rejected" && rejectionReason && (
        <span className="tiny muted" style={{ marginLeft: 4 }}>{rejectionReason}</span>
      )}
    </span>
  );
}

function PhotoUploadField({ label, preview, onFile }) {
  const inputRef = useRef(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label className="fieldLabel" style={{ fontSize: 13, fontWeight: 500 }}>{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: "2px dashed var(--border, #ccc)",
          borderRadius: 8,
          padding: "12px",
          cursor: "pointer",
          textAlign: "center",
          background: preview ? "transparent" : "var(--surface, #fafafa)",
          minHeight: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt={label}
            style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 4, objectFit: "contain" }}
          />
        ) : (
          <span className="tiny muted">Click to upload image</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          onFile(file);
        }}
      />
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function ProfilePage({
  profile,
  isAuthed,
  isAdmin,
  gates,
  notify,
  onAuthError,
  onProfileUpdated,
}) {
  const [licenseNumber, setLicenseNumber]     = useState("");
  const [issuingCountry, setIssuingCountry]   = useState("");
  const [expiryDate, setExpiryDate]           = useState("");
  const [licensePhoto, setLicensePhoto]       = useState(null);
  const [selfie, setSelfie]                   = useState(null);
  const [licensePhotoPreview, setLicensePhotoPreview] = useState(null);
  const [selfiePreview, setSelfiePreview]     = useState(null);

  const [adminVerifyUserId, setAdminVerifyUserId] = useState("1");
  const [adminRejectReason, setAdminRejectReason] = useState("");
  const [busyLicense, setBusyLicense]         = useState(false);
  const [busyAdmin, setBusyAdmin]             = useState(false);
  const [busyPayoutConnect, setBusyPayoutConnect] = useState(false);
  const [busyPayoutRefresh, setBusyPayoutRefresh] = useState(false);

  // Poll every 3 s while the pipeline is processing
  useEffect(() => {
    if (profile?.license_status !== "processing") return;
    const id = setInterval(() => onProfileUpdated(), 3000);
    return () => clearInterval(id);
  }, [profile?.license_status, onProfileUpdated]);

  // Stripe connect return / refresh query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connect = params.get("connect");
    if (!connect || !isAuthed) return;
    if (connect === "return" || connect === "refresh") refreshPayoutStatus(false);
    params.delete("connect");
    const q = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  function handleLicensePhotoChange(file) {
    setLicensePhoto(file);
    setLicensePhotoPreview(URL.createObjectURL(file));
  }

  function handleSelfieChange(file) {
    setSelfie(file);
    setSelfiePreview(URL.createObjectURL(file));
  }

  async function submitLicense(e) {
    e.preventDefault();
    if (!licensePhoto || !selfie) {
      notify("Please upload both a licence photo and a selfie.", "bad");
      return;
    }
    setBusyLicense(true);
    try {
      const fd = new FormData();
      fd.append("license_number", licenseNumber);
      fd.append("issuing_country", issuingCountry);
      fd.append("expiry_date", expiryDate);
      fd.append("license_photo", licensePhoto);
      fd.append("selfie", selfie);
      await apiFetchForm("/profile/license", fd, { onAuthError });
      notify("Documents submitted — verifying now…", "ok");
      await onProfileUpdated();
    } catch (err) {
      notify(`License error: ${err.message}`, "bad");
    } finally {
      setBusyLicense(false);
    }
  }

  async function adminVerifyLicense() {
    setBusyAdmin(true);
    try {
      const userId = Number(adminVerifyUserId);
      await apiFetch(`/profile/license/${userId}/verify`, { method: "POST", onAuthError });
      notify(`Admin: approved licence for user ${userId}`, "ok");
      await onProfileUpdated();
    } catch (err) {
      notify(`Admin verify error: ${err.message}`, "bad");
    } finally {
      setBusyAdmin(false);
    }
  }

  async function adminRejectLicense() {
    setBusyAdmin(true);
    try {
      const userId = Number(adminVerifyUserId);
      await apiFetch(`/profile/license/${userId}/reject`, {
        method: "POST",
        onAuthError,
        body: JSON.stringify({ reason: adminRejectReason || null }),
      });
      notify(`Admin: rejected licence for user ${userId}`, "ok");
      setAdminRejectReason("");
      await onProfileUpdated();
    } catch (err) {
      notify(`Admin reject error: ${err.message}`, "bad");
    } finally {
      setBusyAdmin(false);
    }
  }

  async function startPayoutOnboarding() {
    setBusyPayoutConnect(true);
    try {
      const data = await apiFetch("/profile/payout/onboard", { method: "POST", onAuthError });
      if (data?.url) { window.location.assign(data.url); return; }
      notify("Payout onboarding link not returned", "bad");
    } catch (err) {
      notify(`Payout connect error: ${err.message}`, "bad");
    } finally {
      setBusyPayoutConnect(false);
    }
  }

  async function refreshPayoutStatus(showToast = true) {
    setBusyPayoutRefresh(true);
    try {
      const data = await apiFetch("/profile/payout/refresh", { method: "POST", onAuthError });
      await onProfileUpdated();
      if (showToast) {
        notify(
          data?.payout_connected ? "Payout account connected" : "Payout account not fully onboarded yet",
          data?.payout_connected ? "ok" : "warn"
        );
      }
    } catch (err) {
      notify(`Payout status error: ${err.message}`, "bad");
    } finally {
      setBusyPayoutRefresh(false);
    }
  }

  const licStatus = profile?.license_status ?? null;

  return (
    <div className="twoCol">
      {/* ── Profile overview ─────────────────────────────────────────── */}
      <Card
        title="Profile"
        right={
          <div className="gates">
            <Badge tone={gates.canListCars ? "ok" : "warn"}>
              {gates.canListCars ? "Can list cars" : "Listing locked"}
            </Badge>
            <Badge tone={gates.canBook ? "ok" : "warn"}>
              {gates.canBook ? "Can book" : "Booking locked"}
            </Badge>
          </div>
        }
      >
        {!isAuthed ? (
          <p className="muted">Login to see your profile.</p>
        ) : (
          <div className="profileGrid">
            <div className="kv">
              <div className="k">User ID</div>
              <div className="v mono">{profile.id}</div>
            </div>
            <div className="kv">
              <div className="k">Email</div>
              <div className="v">{profile.email}</div>
            </div>
            <div className="kv">
              <div className="k">Name</div>
              <div className="v">{profile.full_name}</div>
            </div>
            <div className="kv">
              <div className="k">DoB</div>
              <div className="v mono">{profile.date_of_birth}</div>
            </div>
            {isAdmin && (
              <div className="kv">
                <div className="k">Role</div>
                <div className="v mono">{profile.role || "USER"}</div>
              </div>
            )}
            <div className="kv">
              <div className="k">Email verified</div>
              <div className="v">
                {profile.email_verified ? <Badge tone="ok">Yes</Badge> : <Badge tone="warn">No</Badge>}
              </div>
            </div>
            <div className="kv">
              <div className="k">Licence status</div>
              <div className="v">
                {licStatus ? (
                  <LicenseStatusBadge
                    status={licStatus}
                    rejectionReason={profile.license?.rejection_reason}
                  />
                ) : (
                  <Badge tone="warn">Not submitted</Badge>
                )}
              </div>
            </div>
            <div className="kv">
              <div className="k">Profile complete</div>
              <div className="v">
                {profile.profile_complete ? <Badge tone="ok">Yes</Badge> : <Badge tone="warn">No</Badge>}
              </div>
            </div>
            <div className="kv">
              <div className="k">Payout account</div>
              <div className="v">
                {profile.payout_connected
                  ? <Badge tone="ok">Connected</Badge>
                  : <Badge tone="warn">Not connected</Badge>}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Driver licence ────────────────────────────────────────────── */}
      <Card
        title="Driver Licence"
        subtitle="Upload your licence photo and a selfie for automated verification."
      >
        {/* Status banner */}
        {licStatus && licStatus !== "pending" && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 8,
              background:
                licStatus === "approved"      ? "var(--ok-bg, #f0fdf4)"  :
                licStatus === "rejected"      ? "var(--bad-bg, #fef2f2)" :
                licStatus === "processing"    ? "var(--warn-bg, #fffbeb)" :
                "var(--warn-bg, #fffbeb)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {licStatus === "processing" && (
              <span className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />
            )}
            <span className="tiny">
              {licStatus === "processing"    && "Verifying your documents — this takes about 10 seconds…"}
              {licStatus === "approved"      && "Your licence has been verified."}
              {licStatus === "manual_review" && "Your documents are under review by our team."}
              {licStatus === "rejected"      && (
                <>Verification failed. {profile.license?.rejection_reason && <em>{profile.license.rejection_reason}</em>} Please re-submit.</>
              )}
            </span>
          </div>
        )}

        <form className="form" onSubmit={submitLicense}>
          <PhotoUploadField
            label="Driving licence photo"
            preview={licensePhotoPreview}
            onFile={handleLicensePhotoChange}
          />
          <PhotoUploadField
            label="Selfie (face clearly visible)"
            preview={selfiePreview}
            onFile={handleSelfieChange}
          />
          <Field
            label="Licence number"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            placeholder="UK-1234567"
          />
          <Field
            label="Issuing country"
            value={issuingCountry}
            onChange={(e) => setIssuingCountry(e.target.value)}
            placeholder="UK"
          />
          <Field
            label="Expiry date"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
          <Button
            type="submit"
            disabled={!isAuthed || licStatus === "processing"}
            loading={busyLicense}
          >
            {licStatus ? "Re-submit Documents" : "Submit Documents"}
          </Button>
        </form>

        {/* Admin panel */}
        {isAdmin && (
          <>
            <div className="divider" />
            <div className="form">
              <div className="tiny muted" style={{ marginBottom: 8 }}>
                Admin: manually approve or reject a user's licence
              </div>
              <Field
                label="User ID"
                type="number"
                min="1"
                value={adminVerifyUserId}
                onChange={(e) => setAdminVerifyUserId(e.target.value)}
              />
              <Field
                label="Rejection reason (optional)"
                value={adminRejectReason}
                onChange={(e) => setAdminRejectReason(e.target.value)}
                placeholder="e.g. Photo too blurry"
              />
              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={adminVerifyLicense} loading={busyAdmin}>
                  Approve
                </Button>
                <Button variant="secondary" onClick={adminRejectLicense} loading={busyAdmin}>
                  Reject
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Payout section */}
        <div className="divider" />
        <div className="form">
          <div className="tiny muted" style={{ marginBottom: 8 }}>
            Owner payouts: connect Stripe account to receive released escrow funds.
          </div>
          <Button onClick={startPayoutOnboarding} disabled={!isAuthed} loading={busyPayoutConnect}>
            Connect Payout Account
          </Button>
          <Button
            variant="secondary"
            onClick={() => refreshPayoutStatus(true)}
            disabled={!isAuthed}
            loading={busyPayoutRefresh}
          >
            Refresh Payout Status
          </Button>
          {profile?.payout_account_id ? (
            <div className="tiny muted">Account: {profile.payout_account_id}</div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
