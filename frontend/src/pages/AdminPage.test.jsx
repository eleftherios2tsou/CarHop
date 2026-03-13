import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminPage from "./AdminPage";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("../components/disputes/DisputeResolveModal", () => ({
  default: () => null,
}));

vi.mock("../components/DamageReportResolveModal", () => ({
  default: () => null,
}));

const baseProps = {
  notify: vi.fn(),
  onAuthError: vi.fn(),
};

describe("AdminPage", () => {
  it("renders the Verify Licence button", () => {
    render(<AdminPage {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /verify licence/i })
    ).toBeInTheDocument();
  });

  it("renders a user ID field pre-filled with 1", () => {
    render(<AdminPage {...baseProps} />);
    expect(screen.getByLabelText(/user id to verify/i)).toHaveValue(1);
  });

  it("shows no open disputes message initially", () => {
    render(<AdminPage {...baseProps} />);
    expect(screen.getByText(/no open disputes loaded/i)).toBeInTheDocument();
  });

  it("shows no damage reports message initially", () => {
    render(<AdminPage {...baseProps} />);
    expect(screen.getByText(/no damage reports loaded/i)).toBeInTheDocument();
  });

  it("shows user search prompt initially", () => {
    render(<AdminPage {...baseProps} />);
    expect(
      screen.getByText(/use the search box above or click search/i)
    ).toBeInTheDocument();
  });

  it("renders Refresh Open Disputes button", () => {
    render(<AdminPage {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /refresh open disputes/i })
    ).toBeInTheDocument();
  });

  it("renders Refresh Damage Reports button", () => {
    render(<AdminPage {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /refresh damage reports/i })
    ).toBeInTheDocument();
  });

  it("loads and displays disputes when Refresh is clicked", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockResolvedValueOnce([
      {
        id: 3,
        booking_id: 10,
        status: "OPEN",
        opened_by_user_id: 2,
        against_user_id: 1,
        reason: "Vehicle issue",
        details: "Engine light on",
      },
    ]);

    render(<AdminPage {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /refresh open disputes/i }));

    expect(await screen.findByText(/dispute #3/i)).toBeInTheDocument();
    expect(screen.getByText("OPEN")).toBeInTheDocument();
    expect(screen.getByText(/vehicle issue/i)).toBeInTheDocument();
  });

  it("displays Resolve and Reject buttons for loaded disputes", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockResolvedValueOnce([
      {
        id: 7,
        booking_id: 20,
        status: "OPEN",
        opened_by_user_id: 3,
        against_user_id: 1,
        reason: "Late return",
        details: null,
      },
    ]);

    render(<AdminPage {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /refresh open disputes/i }));

    expect(await screen.findByText(/dispute #7/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("loads and displays users after search", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockResolvedValueOnce({
      items: [
        {
          id: 5,
          full_name: "Jane Doe",
          email: "jane@example.com",
          role: "USER",
          is_active: true,
          email_verified: true,
          license_verified: false,
          created_at: "2025-01-01T00:00:00",
        },
      ],
      total: 1,
      pages: 1,
    });

    render(<AdminPage {...baseProps} />);
    const searchInput = screen.getByPlaceholderText(/search by email or name/i);
    fireEvent.change(searchInput, { target: { value: "jane" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("shows Deactivate button for active users", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockResolvedValueOnce({
      items: [
        {
          id: 6,
          full_name: "Bob Smith",
          email: "bob@example.com",
          role: "USER",
          is_active: true,
          email_verified: true,
          license_verified: true,
          created_at: "2025-03-01T00:00:00",
        },
      ],
      total: 1,
      pages: 1,
    });

    render(<AdminPage {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByRole("button", { name: "Deactivate" })
    ).toBeInTheDocument();
  });

  it("renders Release to Owner and Forfeit escrow buttons", () => {
    render(<AdminPage {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /release to owner/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /forfeit/i })
    ).toBeInTheDocument();
  });
});
