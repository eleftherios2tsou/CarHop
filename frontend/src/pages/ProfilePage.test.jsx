import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ProfilePage from "./ProfilePage";

// Minimal profile fixture
const PROFILE = {
  id: 1,
  email: "alice@example.com",
  full_name: "Alice Smith",
  date_of_birth: "1990-01-01",
  email_verified: true,
  is_active: true,
  role: "USER",
  has_license: false,
  license_verified: false,
  license_status: null,
  profile_complete: false,
  payout_connected: false,
  payout_account_id: null,
  avatar_url: null,
  bio: null,
};

const GATES = { canListCars: false, canBook: false };

function renderPage(overrides = {}) {
  return render(
    <ProfilePage
      profile={PROFILE}
      isAuthed={true}
      isAdmin={false}
      gates={GATES}
      notify={vi.fn()}
      onAuthError={vi.fn()}
      onProfileUpdated={vi.fn()}
      {...overrides}
    />
  );
}

describe("ProfilePage — change password form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Change Password section", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByText("Change Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("Update Password button is disabled when fields are empty", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByRole("button", { name: "Update Password" })).toBeDisabled();
  });

  it("Update Password button is enabled when all three fields have values", async () => {
    const user = userEvent.setup();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Account" }));

    await user.type(screen.getByLabelText("Current password"), "oldpass");
    await user.type(screen.getByLabelText("New password"), "newpass");
    await user.type(screen.getByLabelText("Confirm new password"), "newpass");

    expect(screen.getByRole("button", { name: "Update Password" })).toBeEnabled();
  });
});

describe("ProfilePage — profile info display", () => {
  it("shows user email and name", () => {
    renderPage();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("shows 'Not submitted' licence badge when no licence submitted", () => {
    renderPage();
    expect(screen.getByText("Not submitted")).toBeInTheDocument();
  });

  it("shows login prompt when not authenticated", () => {
    renderPage({ profile: null, isAuthed: false });
    expect(screen.getByText("Login to see your profile.")).toBeInTheDocument();
  });
});
