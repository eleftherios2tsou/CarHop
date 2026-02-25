import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import { apiFetch } from "./lib/api";
import Toast from "./components/ui/Toast";

import MarketplacePage from "./pages/MarketplacePage";
import AuthPage from "./pages/AuthPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ProfilePage from "./pages/ProfilePage";
import ListCarPage from "./pages/ListCarPage";
import MyListingsPage from "./pages/MyListingsPage";
import IncomingBookingsPage from "./pages/IncomingBookingsPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import AdminPage from "./pages/AdminPage";
import InformationPage from "./pages/InformationPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import CookieConsentBanner from "./components/CookieConsentBanner";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [active, setActive] = useState("Marketplace");
  const [toast, setToast] = useState({ tone: "info", msg: "" });
  const [busyLogout, setBusyLogout] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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
    items.push({ key: "Information", label: "Information" });
    items.push({ key: "Terms", label: "Terms of Service" });
    items.push({ key: "Privacy", label: "Privacy Policy" });

    if (!isAuthed) {
      items.push({ key: "Auth", label: "Login / Register" });
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

  // Restore session on mount + handle ?verify= email link
  useEffect(() => {
    fetchProfile();

    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify");
    if (verifyToken) {
      // Remove the param from the URL immediately so it doesn't persist on refresh
      params.delete("verify");
      const clean = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", clean);

      // Auto-call the verify endpoint
      apiFetch(`/auth/verify-email/${verifyToken}`, { method: "POST" })
        .then(() => {
          notify("Email verified! You can now log in.", "ok");
          setActive("Auth");
        })
        .catch((err) => {
          notify(`Email verification failed: ${err.message}`, "bad");
          setActive("Auth");
        });
    }
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

      <CookieConsentBanner onPrivacy={() => setActive("Privacy")} />

      <header className="topbar">
        <button
          className="topbarBrand"
          onClick={() => { setActive("Marketplace"); setMenuOpen(false); }}
        >
          <div className="logo">CH</div>
          <span className="brandName">CarHop</span>
        </button>

        <button
          className={active === "Marketplace" ? "topbarLink topbarLinkActive" : "topbarLink"}
          onClick={() => { setActive("Marketplace"); setMenuOpen(false); }}
        >
          Marketplace
        </button>

        <div className="topbarSpacer" />

        <div className="navDropdownWrap" ref={menuRef}>
          <button
            className="navIconBtn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Navigation menu"
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="16" cy="13" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 26c0-5 4-8 9-8s9 3 9 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {menuOpen && (
            <div className="navDropdownMenu">
              {navItems
                .filter((it) => it.key !== "Marketplace")
                .map((it) => (
                  <button
                    key={it.key}
                    className={active === it.key ? "navDropdownItem navDropdownItemActive" : "navDropdownItem"}
                    onClick={() => { setActive(it.key); setMenuOpen(false); }}
                  >
                    {it.label}
                  </button>
                ))}
              {isAuthed && (
                <>
                  <div className="navDropdownDivider" />
                  <button
                    className="navDropdownItem navDropdownItemDanger"
                    onClick={() => { logout(); setMenuOpen(false); }}
                    disabled={busyLogout}
                  >
                    {busyLogout ? "Logging out…" : "Logout"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <main className={active === "Marketplace" ? "main mainFull" : "main"}>

        {active === "Marketplace" && (
          <MarketplacePage
            profile={profile}
            gates={gates}
            notify={notify}
            onAuthError={onAuthError}
            onBookingMade={() => setActive("My Bookings")}
          />
        )}

        {active === "Information" && <InformationPage />}
        {active === "Terms" && <TermsPage />}
        {active === "Privacy" && <PrivacyPage />}

        {active === "Auth" && (
          <AuthPage
            isAuthed={isAuthed}
            notify={notify}
            onLoginSuccess={async () => {
              await fetchProfile();
              setActive("Profile");
            }}
            onNavigate={setActive}
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
            profile={profile}
            isAuthed={isAuthed}
            notify={notify}
            onAuthError={onAuthError}
          />
        )}

        {active === "My Bookings" && (
          <MyBookingsPage
            profile={profile}
            isAuthed={isAuthed}
            notify={notify}
            onAuthError={onAuthError}
          />
        )}

        {active === "Admin" && isAdmin && (
          <AdminPage notify={notify} onAuthError={onAuthError} />
        )}
      </main>

      <footer className="appFooter">
        <span className="tiny muted">© {new Date().getFullYear()} CarHop</span>
        <div className="row" style={{ gap: 16 }}>
          <button className="footerLink" onClick={() => setActive("Terms")}>Terms of Service</button>
          <button className="footerLink" onClick={() => setActive("Privacy")}>Privacy Policy</button>
        </div>
      </footer>
    </div>
  );
}

