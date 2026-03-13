import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MyListingsPage from "./MyListingsPage";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
  apiFetchForm: vi.fn(),
}));

vi.mock("../components/EditListingModal", () => ({
  default: () => null,
}));

const baseProps = {
  isAuthed: true,
  notify: vi.fn(),
  onAuthError: vi.fn(),
};

describe("MyListingsPage", () => {
  it("shows login required when not authenticated", () => {
    render(<MyListingsPage {...baseProps} isAuthed={false} />);
    expect(screen.getByText("Login required")).toBeInTheDocument();
  });

  it("shows no listings message when list is empty", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockResolvedValueOnce([]);
    render(<MyListingsPage {...baseProps} />);
    expect(await screen.findByText("No listings yet")).toBeInTheDocument();
  });

  it("renders listing card with title and action buttons", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockResolvedValueOnce([
      {
        id: 5,
        make: "BMW",
        model: "3 Series",
        year: 2021,
        daily_price: 80,
        city: "Bristol",
        instant_book_enabled: false,
        photo_urls: [],
      },
    ]);
    render(<MyListingsPage {...baseProps} />);
    expect(await screen.findByText(/#5 - BMW 3 Series/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Manage Availability" })
    ).toBeInTheDocument();
  });

  it("shows daily price and city", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockResolvedValueOnce([
      {
        id: 7,
        make: "Audi",
        model: "A3",
        year: 2020,
        daily_price: 65,
        city: "London",
        instant_book_enabled: false,
        photo_urls: [],
      },
    ]);
    render(<MyListingsPage {...baseProps} />);
    expect(await screen.findByText("65")).toBeInTheDocument();
    expect(screen.getByText("London")).toBeInTheDocument();
  });

  it("renders Instant Book checkbox for each listing", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockResolvedValueOnce([
      {
        id: 10,
        make: "Tesla",
        model: "Model 3",
        year: 2023,
        daily_price: 100,
        city: "Manchester",
        instant_book_enabled: false,
        photo_urls: [],
      },
    ]);
    render(<MyListingsPage {...baseProps} />);
    await screen.findByText(/instant book/i);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("instant book checkbox is checked when enabled", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockResolvedValueOnce([
      {
        id: 11,
        make: "Ford",
        model: "Focus",
        year: 2022,
        daily_price: 45,
        city: "Leeds",
        instant_book_enabled: true,
        photo_urls: [],
      },
    ]);
    render(<MyListingsPage {...baseProps} />);
    await screen.findByText(/instant book/i);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });
});
