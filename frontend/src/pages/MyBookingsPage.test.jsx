import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MyBookingsPage from "./MyBookingsPage";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

const baseProps = {
  profile: { id: 1, full_name: "Test User" },
  isAuthed: true,
  notify: vi.fn(),
  onAuthError: vi.fn(),
};

describe("MyBookingsPage", () => {
  it("shows login required when not authenticated", () => {
    render(<MyBookingsPage {...baseProps} isAuthed={false} />);
    expect(screen.getByText("Login required")).toBeInTheDocument();
  });

  it("shows no bookings message when list is empty", async () => {
    render(<MyBookingsPage {...baseProps} />);
    expect(await screen.findByText("No bookings yet")).toBeInTheDocument();
  });

  it("renders booking row with status badge", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockImplementation((url) => {
      if (url.includes("/reviews/mine")) return Promise.resolve([]);
      if (url.includes("/disputes/booking")) return Promise.resolve(null);
      if (url.includes("/payments/booking")) return Promise.resolve(null);
      return Promise.resolve({
        items: [
          {
            id: 42,
            car_id: 7,
            start_date: "2026-06-01",
            end_date: "2026-06-03",
            status: "PENDING",
            renter_id: 1,
          },
        ],
        total: 1,
      });
    });
    render(<MyBookingsPage {...baseProps} />);
    expect(await screen.findByText("Booking #42")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("cancel button visible for PENDING booking", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockImplementation((url) => {
      if (url.includes("/reviews/mine")) return Promise.resolve([]);
      if (url.includes("/disputes/booking")) return Promise.resolve(null);
      if (url.includes("/payments/booking")) return Promise.resolve(null);
      return Promise.resolve({
        items: [
          {
            id: 10,
            car_id: 3,
            start_date: "2026-07-01",
            end_date: "2026-07-02",
            status: "PENDING",
            renter_id: 1,
          },
        ],
        total: 1,
      });
    });
    render(<MyBookingsPage {...baseProps} />);
    const cancelBtn = await screen.findByRole("button", { name: "Cancel" });
    expect(cancelBtn).not.toBeDisabled();
  });

  it("does not show cancel button for COMPLETED booking", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockImplementation((url) => {
      if (url.includes("/reviews/mine")) return Promise.resolve([]);
      if (url.includes("/disputes/booking")) return Promise.resolve(null);
      if (url.includes("/payments/booking")) return Promise.resolve(null);
      return Promise.resolve({
        items: [
          {
            id: 20,
            car_id: 5,
            start_date: "2026-01-01",
            end_date: "2026-01-03",
            status: "COMPLETED",
            renter_id: 1,
          },
        ],
        total: 1,
      });
    });
    render(<MyBookingsPage {...baseProps} />);
    await screen.findByText("Booking #20");
    expect(await screen.findByText("Cannot cancel")).toBeInTheDocument();
  });
});
