import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ListCarPage from "./ListCarPage";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
  apiFetchForm: vi.fn(),
}));

vi.mock("../lib/photos", () => ({
  filesToPreviews: vi.fn().mockResolvedValue([]),
}));

const baseProps = {
  gates: { canListCars: true },
  notify: vi.fn(),
  onAuthError: vi.fn(),
  onCarCreated: vi.fn(),
};

describe("ListCarPage", () => {
  it("shows Unlocked badge when canListCars is true", () => {
    render(<ListCarPage {...baseProps} />);
    expect(screen.getByText("Unlocked")).toBeInTheDocument();
  });

  it("shows Locked badge when canListCars is false", () => {
    render(<ListCarPage {...baseProps} gates={{ canListCars: false }} />);
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("disables Publish Listing button when canListCars is false", () => {
    render(<ListCarPage {...baseProps} gates={{ canListCars: false }} />);
    expect(
      screen.getByRole("button", { name: /publish listing/i })
    ).toBeDisabled();
  });

  it("enables Publish Listing button when canListCars is true", () => {
    render(<ListCarPage {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /publish listing/i })
    ).not.toBeDisabled();
  });

  it("shows unlock hint when canListCars is false", () => {
    render(<ListCarPage {...baseProps} gates={{ canListCars: false }} />);
    expect(screen.getByText(/unlock.*login.*verify email/i)).toBeInTheDocument();
  });

  it("toggles feature chip on click", () => {
    render(<ListCarPage {...baseProps} />);
    const acChip = screen.getByRole("button", { name: "A/C" });
    expect(acChip.className).not.toContain("chipOn");
    fireEvent.click(acChip);
    expect(acChip.className).toContain("chipOn");
    fireEvent.click(acChip);
    expect(acChip.className).not.toContain("chipOn");
  });

  it("renders all feature chips", () => {
    render(<ListCarPage {...baseProps} />);
    expect(screen.getByRole("button", { name: "A/C" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bluetooth" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apple CarPlay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GPS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heated seats" })).toBeInTheDocument();
  });

  it("shows empty photos state initially", () => {
    render(<ListCarPage {...baseProps} />);
    expect(screen.getByText(/no photos yet/i)).toBeInTheDocument();
  });

  it("calls apiFetch and onCarCreated on successful submission", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockResolvedValueOnce({ id: 99 });

    render(<ListCarPage {...baseProps} />);

    // Fill required fields
    fireEvent.change(screen.getByLabelText("Make"), {
      target: { value: "Toyota" },
    });
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "Corolla" },
    });
    fireEvent.change(screen.getByLabelText("Daily price (GBP)"), {
      target: { value: "50" },
    });

    fireEvent.submit(screen.getByRole("button", { name: /publish listing/i }).closest("form"));

    await vi.waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/cars/",
        expect.objectContaining({ method: "POST" })
      );
      expect(baseProps.onCarCreated).toHaveBeenCalled();
    });
  });
});
