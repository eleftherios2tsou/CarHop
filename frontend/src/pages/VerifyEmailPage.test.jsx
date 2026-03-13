import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VerifyEmailPage from "./VerifyEmailPage";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
}));

const baseProps = {
  notify: vi.fn(),
  setActive: vi.fn(),
};

describe("VerifyEmailPage", () => {
  it("renders the token input and Verify button", () => {
    render(<VerifyEmailPage {...baseProps} />);
    expect(screen.getByLabelText(/verification token/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify" })).toBeInTheDocument();
  });

  it("disables Verify button when token is empty", () => {
    render(<VerifyEmailPage {...baseProps} />);
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });

  it("enables Verify button when token is entered", () => {
    render(<VerifyEmailPage {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/verification token/i), {
      target: { value: "abc123token" },
    });
    expect(screen.getByRole("button", { name: "Verify" })).not.toBeDisabled();
  });

  it("calls apiFetch with the token and navigates to Profile on success", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockResolvedValueOnce({});

    render(<VerifyEmailPage {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/verification token/i), {
      target: { value: "mytoken" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await vi.waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/auth/verify-email/mytoken", {
        method: "POST",
      });
      expect(baseProps.notify).toHaveBeenCalledWith(
        expect.stringContaining("verified"),
        "ok"
      );
      expect(baseProps.setActive).toHaveBeenCalledWith("Profile");
    });
  });

  it("shows error notification when API call fails", async () => {
    const { apiFetch } = await import("../lib/api");
    apiFetch.mockRejectedValueOnce(new Error("Invalid token"));

    render(<VerifyEmailPage {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/verification token/i), {
      target: { value: "badtoken" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await vi.waitFor(() => {
      expect(baseProps.notify).toHaveBeenCalledWith(
        expect.stringContaining("Invalid token"),
        "bad"
      );
    });
  });

  it("Back button calls setActive with Profile", () => {
    render(<VerifyEmailPage {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(baseProps.setActive).toHaveBeenCalledWith("Profile");
  });
});
