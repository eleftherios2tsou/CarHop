import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { apiFetch } from "./lib/api";
import Toast from "./components/ui/Toast";
import Button from "./components/ui/Button";

import MarketplacePage from "./pages/MarketplacePage";
import AuthPage from "./pages/AuthPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ProfilePage from "./pages/ProfilePage";
import ListCarPage from "./pages/ListCarPage";
import MyListingsPage from "./pages/MyListingsPage";
import IncomingBookingsPage from "./pages/IncomingBookingsPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [active, setActive] = useState("Marketplace");
  const [toast, setToast] = useState({ tone: "info", msg: "" });
  const [busyLogout, setBusyLogout] = useState(false);

  const isAuthed = useMemo(() => !!profile, [profile]);
  const isAdmin = useMemo(() => profile?.role === "ADMIN", [profile]);

  const gates = useMemo(() => {
    const emailVerified = !!profile?.email_verified;
    const licenseVerified = !!profile?.license_verified;
    return {
      emailVerified,
      hasLicense: !!profile?.has_license,
      licenseVerified,
      canListCars: isAuthed && emailVerified,
      canBook: isAuthed && emailVerified && licenseVerified,
    };
  }, [profile, isAuthed]);

  const navItems = useMemo(() => {
    const items = [{ key: "Marketplace", label: "Marketplace" }];

    if (!isAuthed) {
      items.push({ key: "Auth", label: "Auth" });
      return items;
    }

    items.push({ key: "Profile", label: "Profile" });

    if (!profile?.email_verified) {
      items.push({ key: "Verify Email", label: "Verify Email" });
    }

    if (profile?.email_verified) {
      items.push({ key: "List Car", label: "List Car" });
      items.push({ key: "My Listings", label: "My Listings" });
      items.push({ key: "Incoming", label: "Incoming Bookings" });
      items.push({ key: "My Bookings", label: "My Bookings" });
    }

    if (isAdmin) items.push({ key: "Admin", label: "Admin" });
    return items;
  }, [isAuthed, profile?.email_verified, isAdmin]);

  function notify(msg, tone = "info") {
    setToast({ msg, tone });
  }

  const onAuthError = () => {
    setProfile(null);
    notify("Session expired. Please login again.", "warn");
    setActive("Auth");
  };

  async function fetchProfile() {
    try {
      const data = await apiFetch("/profile/me", { onAuthError });
      setProfile(data);
      return data;
    } catch {
      setProfile(null);
      return null;
    }
  }

  async function logout() {
    setBusyLogout(true);
    try {
      await apiFetch("/auth/logout", { method: "POST", onAuthError: () => {} });
      setProfile(null);
      notify("Logged out.", "info");
      setActive("Marketplace");
    } catch (e) {
      notify(`Logout error: ${e.message}`, "bad");
    } finally {
      setBusyLogout(false);
    }
  }

  // Restore session on mount
  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guard: admin tab only for admins
  useEffect(() => {
    if (active === "Admin" && !isAdmin) setActive("Marketplace");
  }, [active, isAdmin]);

  // Guard: if current tab is no longer in nav, go home
  useEffect(() => {
    const allowed = new Set(navItems.map((n) => n.key));
    if (!allowed.has(active)) setActive(navItems[0]?.key || "Marketplace");
  }, [navItems, active]);

  return (
    <div className="appShell">
      <Toast
        tone={toast.tone}
        message={toast.msg}
        onClose={() => setToast({ tone: "info", msg: "" })}
      />

      <aside className="sidebar">
        <div className="brand">
          <div className="logo">CH</div>
          <div>
            <div className="brandName">CarHop</div>
            <div className="brandSub">P2P Car Rental</div>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((it) => (
            <button
              key={it.key}
              className={active === it.key ? "navItem navItemActive" : "navItem"}
              onClick={() => setActive(it.key)}
            >
              {it.label}
            </button>
          ))}
        </nav>

        <div className="sidebarFooter">
          {isAuthed ? (
            <Button variant="danger" onClick={logout} loading={busyLogout}>
              Logout
            </Button>
          ) : (
            <div className="tiny">Tip: register → verify → login</div>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1 className="pageTitle">{active}</h1>
            <p className="pageSub">The new Era of commuting</p>
          </div>
        </header>

        {active === "Marketplace" && (
          <MarketplacePage
            profile={profile}
            gates={gates}
            notify={notify}
            onAuthError={onAuthError}
            onBookingMade={() => setActive("My Bookings")}
          />
        )}

        {active === "Auth" && (
          <AuthPage
            isAuthed={isAuthed}
            notify={notify}
            onLoginSuccess={async () => {
              await fetchProfile();
              setActive("Profile");
            }}
            setActive={setActive}
          />
        )}

        {active === "Verify Email" && (
          <VerifyEmailPage notify={notify} setActive={setActive} />
        )}

        {active === "Profile" && (
          <ProfilePage
            profile={profile}
            isAuthed={isAuthed}
            isAdmin={isAdmin}
            gates={gates}
            notify={notify}
            onAuthError={onAuthError}
            onProfileUpdated={fetchProfile}
          />
        )}

        {active === "List Car" && (
          <ListCarPage
            gates={gates}
            notify={notify}
            onAuthError={onAuthError}
            onCarCreated={() => setActive("Marketplace")}
          />
        )}

        {active === "My Listings" && (
          <MyListingsPage
            isAuthed={isAuthed}
            notify={notify}
            onAuthError={onAuthError}
          />
        )}

        {active === "Incoming" && (
          <IncomingBookingsPage
            isAuthed={isAuthed}
            notify={notify}
            onAuthError={onAuthError}
          />
        )}

        {active === "My Bookings" && (
          <MyBookingsPage
            isAuthed={isAuthed}
            notify={notify}
            onAuthError={onAuthError}
          />
        )}

        {active === "Admin" && isAdmin && (
          <AdminPage notify={notify} onAuthError={onAuthError} />
        )}
      </main>
    </div>
  );
}
