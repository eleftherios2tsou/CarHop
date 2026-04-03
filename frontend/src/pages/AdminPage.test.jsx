import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
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
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders the tab bar with all tabs", () => {
    render(<AdminPage {...baseProps} />);
    expect(screen.getByRole("button", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bookings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disputes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Damage Reports" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escrow" })).toBeInTheDocument();
  });

  it("shows no open disputes message when Disputes tab is active", async () => {
    render(<AdminPage {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Disputes" }));
    expect(await screen.findByText(/no open disputes/i)).toBeInTheDocument();
  });

  it("shows no damage reports message when Damage Reports tab is active", async () => {
    render(<AdminPage {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Damage Reports" }));
    expect(await screen.findByText(/no damage reports/i)).toBeInTheDocument();
  });

  it("shows user search prompt when Users tab is active", () => {
    render(<AdminPage {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Users" }));
    expect(screen.getByText(/search or click search to load users/i)).toBeInTheDocument();
  });

  it("renders Refresh button in the Disputes tab", async () => {
    render(<AdminPage {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Disputes" }));
    expect(await screen.findByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("renders Refresh button in the Damage Reports tab", async () => {
    render(<AdminPage {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Damage Reports" }));
    expect(await screen.findByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("loads and displays disputes after clicking Refresh in Disputes tab", async () => {
    const { apiFetch } = await import("../lib/api");
    // stats on mount, disputes on tab switch, disputes on Refresh
    apiFetch
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
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
    fireEvent.click(screen.getByRole("button", { name: "Disputes" }));
    await screen.findByText(/no open disputes/i);

    fireEvent.click(await screen.findByRole("button", { name: "Refresh" }));

    expect(await screen.findByText(/dispute #3/i)).toBeInTheDocument();
    expect(screen.getByText("OPEN")).toBeInTheDocument();
    expect(screen.getByText(/vehicle issue/i)).toBeInTheDocument();
  });

  it("displays Resolve and Reject buttons for loaded disputes", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
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
    fireEvent.click(screen.getByRole("button", { name: "Disputes" }));
    await screen.findByText(/no open disputes/i);

    fireEvent.click(await screen.findByRole("button", { name: "Refresh" }));

    expect(await screen.findByText(/dispute #7/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("loads and displays users after search in Users tab", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
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
    fireEvent.click(screen.getByRole("button", { name: "Users" }));

    const searchInput = screen.getByPlaceholderText(/search by name or email/i);
    fireEvent.change(searchInput, { target: { value: "jane" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.getByText(/jane@example\.com/)).toBeInTheDocument();
  });

  it("shows Deactivate button for active users", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
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
    fireEvent.click(screen.getByRole("button", { name: "Users" }));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("button", { name: "Deactivate" })).toBeInTheDocument();
  });

  it("renders Release to Owner and Forfeit escrow buttons in Escrow tab", () => {
    render(<AdminPage {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Escrow" }));
    expect(screen.getByRole("button", { name: /release to owner/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /forfeit/i })).toBeInTheDocument();
  });
});
