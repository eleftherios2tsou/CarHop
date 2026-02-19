import { useState, useEffect } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { Field } from "../components/ui/Field";
import { apiFetch } from "../lib/api";

export default function ProfilePage({
  profile,
  isAuthed,
  isAdmin,
  gates,
  notify,
  onAuthError,
  onProfileUpdated,
}) {
  const [licenseNumber, setLicenseNumber] = useState("");
  const [issuingCountry, setIssuingCountry] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [adminVerifyUserId, setAdminVerifyUserId] = useState("1");
  const [busyLicense, setBusyLicense] = useState(false);
  const [busyAdmin, setBusyAdmin] = useState(false);
  const [busyPayoutConnect, setBusyPayoutConnect] = useState(false);
  const [busyPayoutRefresh, setBusyPayoutRefresh] = useState(false);

  // Pre-fill license fields from profile
  useEffect(() => {
    if (profile?.license) {
      if (profile.license.license_number) setLicenseNumber(profile.license.license_number);
      if (profile.license.issuing_country) setIssuingCountry(profile.license.issuing_country);
      if (profile.license.expiry_date) setExpiryDate(profile.license.expiry_date);
    }
  }, [profile?.license]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connect = params.get("connect");
    if (!connect || !isAuthed) return;

    if (connect === "return" || connect === "refresh") {
      refreshPayoutStatus(false);
    }

    params.delete("connect");
    const q = params.toString();
    const nextUrl = `${window.location.pathname}${q ? `?${q}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  async function submitLicense(e) {
    e.preventDefault();
    setBusyLicense(true);
    try {
      await apiFetch("/profile/license", {
        method: "POST",
        onAuthError,
        body: JSON.stringify({
          license_number: licenseNumber,
          issuing_country: issuingCountry,
          expiry_date: expiryDate,
        }),
      });
      notify("License submitted ✅ (awaiting verification)", "ok");
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
      notify(`Admin: verified license for user ${userId} ✅`, "ok");
      await onProfileUpdated();
    } catch (err) {
      notify(`Admin verify error: ${err.message}`, "bad");
    } finally {
      setBusyAdmin(false);
    }
  }

  async function startPayoutOnboarding() {
    setBusyPayoutConnect(true);
    try {
      const data = await apiFetch("/profile/payout/onboard", { method: "POST", onAuthError });
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
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
          data?.payout_connected ? "Payout account connected ✅" : "Payout account not fully onboarded yet",
          data?.payout_connected ? "ok" : "warn"
        );
      }
    } catch (err) {
      notify(`Payout status error: ${err.message}`, "bad");
    } finally {
      setBusyPayoutRefresh(false);
    }
  }

  return (
    <div className="twoCol">
      <Card
        title="Profile"
        subtitle="Shows your onboarding status and platform gates."
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
                {profile.email_verified ? (
                  <Badge tone="ok">Yes</Badge>
                ) : (
                  <Badge tone="warn">No</Badge>
                )}
              </div>
            </div>
            <div className="kv">
              <div className="k">Licence submitted</div>
              <div className="v">
                {profile.has_license ? (
                  <Badge tone="ok">Yes</Badge>
                ) : (
                  <Badge tone="warn">No</Badge>
                )}
              </div>
            </div>
            <div className="kv">
              <div className="k">Licence verified</div>
              <div className="v">
                {profile.license_verified ? (
                  <Badge tone="ok">Yes</Badge>
                ) : (
                  <Badge tone="warn">No</Badge>
                )}
              </div>
            </div>
            <div className="kv">
              <div className="k">Profile complete</div>
              <div className="v">
                {profile.profile_complete ? (
                  <Badge tone="ok">Yes</Badge>
                ) : (
                  <Badge tone="warn">No</Badge>
                )}
              </div>
            </div>
            <div className="kv">
              <div className="k">Payout account</div>
              <div className="v">
                {profile.payout_connected ? (
                  <Badge tone="ok">Connected</Badge>
                ) : (
                  <Badge tone="warn">Not connected</Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Driver License"
        subtitle="Submit or update licence details (admin verification required)."
      >
        <form className="form" onSubmit={submitLicense}>
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
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            placeholder="YYYY-MM-DD"
          />
          <Button type="submit" disabled={!isAuthed} loading={busyLicense}>
            Submit / Update
          </Button>
        </form>

        {isAdmin ? (
          <>
            <div className="divider" />
            <div className="form">
              <div className="tiny muted" style={{ marginBottom: 8 }}>
                Admin-only: verify a user's licence
              </div>
              <Field
                label="User ID to verify"
                type="number"
                min="1"
                value={adminVerifyUserId}
                onChange={(e) => setAdminVerifyUserId(e.target.value)}
              />
              <Button onClick={adminVerifyLicense} loading={busyAdmin}>
                Verify Licence
              </Button>
            </div>
          </>
        ) : (
          <div className="tiny muted" style={{ marginTop: 10 }}>
            Verification is done by an admin.
          </div>
        )}

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
