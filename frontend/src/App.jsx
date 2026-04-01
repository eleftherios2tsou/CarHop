import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import { apiFetch } from "./lib/api";
import Toast from "./components/ui/Toast";

// importing all the page components — each one is a full "screen" in our SPA
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
  // profile holds the currently logged-in user's data (or null if not logged in)
  const [profile, setProfile] = useState(null);
  // active is the key of the current page being shown — we use this instead of a router
  const [active, setActive] = useState("Marketplace");
  // toast is the notification banner at the top — we set msg + tone to show it
  const [toast, setToast] = useState({ tone: "info", msg: "" });
  const [busyLogout, setBusyLogout] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // resetToken is set when the user arrives via a password reset link (?reset=...)
  const [resetToken, setResetToken] = useState(null);
  const menuRef = useRef(null); // used to detect clicks outside the dropdown so we can close it

  // close the navigation dropdown if the user clicks anywhere outside of it
  useEffect(() => {
    function handleOutsideClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // derive auth state and role from the profile object — avoids duplicating this logic everywhere
  const isAuthed = useMemo(() => !!profile, [profile]);
  const isAdmin = useMemo(() => profile?.role === "ADMIN", [profile]);

  // gates control which features are accessible — e.g. you need a verified licence to book
  const gates = useMemo(() => {
    const emailVerified = !!profile?.email_verified;
    const licenseVerified = !!profile?.license_verified;
    return {
      emailVerified,
      hasLicense: !!profile?.has_license,
      licenseVerified,
      canListCars: isAuthed && emailVerified,       // need email verified to list
      canBook: isAuthed && emailVerified && licenseVerified, // need licence too to book
    };
  }, [profile, isAuthed]);

  // build the nav items dynamically based on auth state and role
  // we do this in a useMemo so it only recalculates when the dependencies change
  const navItems = useMemo(() => {
    const items = [{ key: "Marketplace", label: "Marketplace" }];
    items.push({ key: "Information", label: "Information" });
    items.push({ key: "Terms", label: "Terms of Service" });
    items.push({ key: "Privacy", label: "Privacy Policy" });

    if (!isAuthed) {
      // if not logged in, just show the login/register option
      items.push({ key: "Auth", label: "Login / Register" });
      return items;
    }

    items.push({ key: "Profile", label: "Profile" });

    // only show the verify email page if the user hasn't verified yet
    if (!profile?.email_verified) {
      items.push({ key: "Verify Email", label: "Verify Email" });
    }

    // these pages are only available once the email is verified
    if (profile?.email_verified) {
      items.push({ key: "List Car", label: "List Car" });
      items.push({ key: "My Listings", label: "My Listings" });
      items.push({ key: "Incoming", label: "Incoming Bookings" });
      items.push({ key: "My Bookings", label: "My Bookings" });
    }

    // admin panel only appears for users with the ADMIN role
    if (isAdmin) items.push({ key: "Admin", label: "Admin" });
    return items;
  }, [isAuthed, profile?.email_verified, isAdmin]);

  // helper to show a toast notification from any page component
  function notify(msg, tone = "info") {
    setToast({ msg, tone });
  }

  // if any API call returns a 401 and refresh fails, we clear the session and redirect to login
  const onAuthError = () => {
    setProfile(null);
    notify("Session expired. Please login again.", "warn");
    setActive("Auth");
  };

  // fetch the current user's profile from the backend
  // called on mount and after actions that might change the profile (e.g. licence upload)
  async function fetchProfile() {
    try {
      const data = await apiFetch("/profile/me", { onAuthError });
      setProfile(data); // store the profile in state so the whole app can use it
      return data;
    } catch {
      setProfile(null); // if the request fails, treat the user as logged out
      return null;
    }
  }

  // log the user out by calling the backend endpoint and then clearing local state
  async function logout() {
    setBusyLogout(true);
    try {
      // pass an empty onAuthError so a 401 here doesn't trigger a redirect loop
      await apiFetch("/auth/logout", { method: "POST", onAuthError: () => {} });
      setProfile(null);
      setResetToken(null); // clear the reset token too so the auth page shows login, not reset form
      notify("Logged out.", "info");
      setActive("Marketplace");
    } catch (e) {
      notify(`Logout error: ${e.message}`, "bad");
    } finally {
      setBusyLogout(false);
    }
  }

  // on first render: restore the session, and handle any ?verify= or ?reset= query params
  // these come from email links (verification email and password reset email)
  useEffect(() => {
    fetchProfile(); // try to restore the session from the existing auth cookie

    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify"); // present when user clicks the verification email link
    const resetTok = params.get("reset");     // present when user clicks the password reset link

    if (verifyToken) {
      // remove the token from the URL so it doesn't show up on a refresh
      params.delete("verify");
      const clean = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", clean);

      // auto-call the verify endpoint right away — no manual action needed from the user
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

    if (resetTok) {
      // clean the URL and store the token in state so AuthPage can show the reset form
      params.delete("reset");
      const clean = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", clean);
      setResetToken(resetTok);
      setActive("Auth");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // safety check: if the user somehow ends up on the Admin page without being an admin, redirect them
  useEffect(() => {
    if (active === "Admin" && !isAdmin) setActive("Marketplace");
  }, [active, isAdmin]);

  // if the current page is no longer in the nav (e.g. email gets verified and "Verify Email" disappears),
  // redirect to the first available nav item instead of showing a blank screen
  useEffect(() => {
    const allowed = new Set(navItems.map((n) => n.key));
    if (!allowed.has(active)) setActive(navItems[0]?.key || "Marketplace");
  }, [navItems, active]);

  return (
    <div className="appShell">
      {/* global toast notification — shown at the top of the screen */}
      <Toast
        tone={toast.tone}
        message={toast.msg}
        onClose={() => setToast({ tone: "info", msg: "" })}
      />

      {/* GDPR cookie consent banner — shows once on first visit */}
      <CookieConsentBanner onPrivacy={() => setActive("Privacy")} />

      <header className="topbar">
        {/* clicking the logo always takes you back to the marketplace */}
        <button
          className="topbarBrand"
          onClick={() => { setActive("Marketplace"); setMenuOpen(false); }}
        >
          <div className="logo">CH</div>
          <span className="brandName">CarHop</span>
        </button>

        {/* marketplace shortcut in the header bar for quick access */}
        <button
          className={active === "Marketplace" ? "topbarLink topbarLinkActive" : "topbarLink"}
          onClick={() => { setActive("Marketplace"); setMenuOpen(false); }}
        >
          Marketplace
        </button>

        <div className="topbarSpacer" />

        {/* user icon button that opens the nav dropdown */}
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

          {/* dropdown menu — only rendered when menuOpen is true */}
          {menuOpen && (
            <div className="navDropdownMenu">
              {/* filter out Marketplace because it's already in the header bar */}
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
              {/* only show the logout button if the user is logged in */}
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

      {/* main content area — only one page is rendered at a time based on `active` */}
      <main className={active === "Marketplace" ? "main mainFull" : "main"}>

        {active === "Marketplace" && (
          <MarketplacePage
            profile={profile}
            gates={gates}
            notify={notify}
            onAuthError={onAuthError}
            onBookingMade={() => setActive("My Bookings")} // redirect after a booking is made
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
              // after login we fetch the profile so the rest of the app has the user data
              await fetchProfile();
              setActive("Profile");
            }}
            onNavigate={setActive}
            resetToken={resetToken} // pass the reset token so AuthPage shows the reset form
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
            onProfileUpdated={fetchProfile} // ProfilePage calls this after any change so data stays fresh
            onAccountDeleted={() => { setProfile(null); setActive("Marketplace"); }}
          />
        )}

        {active === "List Car" && (
          <ListCarPage
            gates={gates}
            notify={notify}
            onAuthError={onAuthError}
            onCarCreated={() => setActive("Marketplace")} // go to marketplace after listing a car
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

        {/* double-check isAdmin here as an extra safety net, even though the nav guard handles it */}
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
