import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import IncomingBookingsPage from "./IncomingBookingsPage";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
  apiFetchForm: vi.fn(),
}));

const baseProps = {
  profile: { id: 1, full_name: "Car Owner" },
  isAuthed: true,
  notify: vi.fn(),
  onAuthError: vi.fn(),
};

function makeApiFetch(bookings = []) {
  return (url) => {
    if (url.includes("/bookings/incoming")) return Promise.resolve({ items: bookings, total: bookings.length });
    if (url.includes("/reviews/mine")) return Promise.resolve([]);
    if (url.includes("/reviews/user/")) return Promise.resolve([]);
    if (url.includes("/disputes/booking")) return Promise.resolve(null);
    if (url.includes("/payments/booking")) return Promise.resolve(null);
    if (url.includes("/damage-reports/booking")) return Promise.resolve(null);
    return Promise.resolve(null);
  };
}

describe("IncomingBookingsPage", () => {
  it("shows login required when not authenticated", () => {
    render(<IncomingBookingsPage {...baseProps} isAuthed={false} />);
    expect(screen.getByText("Login required")).toBeInTheDocument();
  });

  it("shows no incoming bookings message when list is empty", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockImplementation(makeApiFetch([]));
    render(<IncomingBookingsPage {...baseProps} />);
    expect(await screen.findByText("No incoming bookings")).toBeInTheDocument();
  });

  it("shows Approve and Reject buttons for PENDING booking", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockImplementation(makeApiFetch([
      {
        id: 5,
        car_id: 2,
        renter_id: 99,
        start_date: "2026-08-01",
        end_date: "2026-08-03",
        status: "PENDING",
      },
    ]));
    render(<IncomingBookingsPage {...baseProps} />);
    expect(await screen.findByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("shows No action for non-PENDING booking", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockImplementation(makeApiFetch([
      {
        id: 8,
        car_id: 3,
        renter_id: 99,
        start_date: "2026-01-01",
        end_date: "2026-01-02",
        status: "APPROVED",
      },
    ]));
    render(<IncomingBookingsPage {...baseProps} />);
    expect(await screen.findByText("No action")).toBeInTheDocument();
    expect(screen.queryByText("Approve")).toBeNull();
  });

  it("renders booking title with booking id", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockImplementation(makeApiFetch([
      {
        id: 77,
        car_id: 4,
        renter_id: 55,
        start_date: "2026-09-10",
        end_date: "2026-09-12",
        status: "PENDING",
      },
    ]));
    render(<IncomingBookingsPage {...baseProps} />);
    expect(await screen.findByText("Booking #77")).toBeInTheDocument();
  });
});
