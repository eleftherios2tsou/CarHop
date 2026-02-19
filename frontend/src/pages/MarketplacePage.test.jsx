import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarketplacePage from "./MarketplacePage";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn().mockResolvedValue([]),
}));

describe("MarketplacePage", () => {
  it("shows warning and disables search for invalid date range", () => {
    render(
      <MarketplacePage
        profile={null}
        gates={{ canBook: true }}
        notify={vi.fn()}
        onAuthError={vi.fn()}
        onBookingMade={vi.fn()}
      />
    );

    const from = screen.getByLabelText("From");
    const to = screen.getByLabelText("To");

    fireEvent.change(from, { target: { value: "2026-02-12" } });
    fireEvent.change(to, { target: { value: "2026-02-10" } });

    expect(screen.getByText("Date range is invalid")).toBeInTheDocument();
    const searchLikeButton = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "Search" || b.textContent === "Working...");
    expect(searchLikeButton).toBeDefined();
    expect(searchLikeButton).toBeDisabled();
  });
});
