import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AuthPage from "./AuthPage";

describe("AuthPage", () => {
  it("switches between register and login modes", async () => {
    const user = userEvent.setup();

    render(
      <AuthPage
        isAuthed={false}
        notify={vi.fn()}
        onLoginSuccess={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Full name")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Login" }).length).toBeGreaterThan(0);
  });

  it("shows forgot-password form when 'Forgot password?' is clicked", async () => {
    const user = userEvent.setup();

    render(
      <AuthPage
        isAuthed={false}
        notify={vi.fn()}
        onLoginSuccess={vi.fn()}
      />
    );

    // Switch to login mode first
    await user.click(screen.getByRole("button", { name: "Login" }));
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(screen.getByText("Reset your password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Reset Link" })).toBeInTheDocument();
  });

  it("Send Reset Link button is disabled when email is empty", async () => {
    const user = userEvent.setup();

    render(
      <AuthPage
        isAuthed={false}
        notify={vi.fn()}
        onLoginSuccess={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Login" }));
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(screen.getByRole("button", { name: "Send Reset Link" })).toBeDisabled();
  });

  it("shows reset-password form when resetToken prop is provided", () => {
    render(
      <AuthPage
        isAuthed={false}
        notify={vi.fn()}
        onLoginSuccess={vi.fn()}
        resetToken="test-token-abc"
      />
    );

    expect(screen.getByText("Set a new password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set New Password" })).toBeInTheDocument();
  });

  it("Set New Password button is disabled when password is empty", () => {
    render(
      <AuthPage
        isAuthed={false}
        notify={vi.fn()}
        onLoginSuccess={vi.fn()}
        resetToken="test-token-abc"
      />
    );

    expect(screen.getByRole("button", { name: "Set New Password" })).toBeDisabled();
  });

  it("navigates back to login from forgot-password mode", async () => {
    const user = userEvent.setup();

    render(
      <AuthPage
        isAuthed={false}
        notify={vi.fn()}
        onLoginSuccess={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Login" }));
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.click(screen.getByRole("button", { name: "Back to login" }));

    // Should be back in login mode — login submit button visible
    expect(screen.getAllByRole("button", { name: "Login" }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Reset your password")).not.toBeInTheDocument();
  });

  it("shows 'Not logged in' badge when isAuthed is false", () => {
    render(
      <AuthPage
        isAuthed={false}
        notify={vi.fn()}
        onLoginSuccess={vi.fn()}
      />
    );

    expect(screen.getByText("Not logged in")).toBeInTheDocument();
  });

  it("shows 'Logged in' badge when isAuthed is true", () => {
    render(
      <AuthPage
        isAuthed={true}
        notify={vi.fn()}
        onLoginSuccess={vi.fn()}
      />
    );

    expect(screen.getByText("Logged in")).toBeInTheDocument();
  });
});
