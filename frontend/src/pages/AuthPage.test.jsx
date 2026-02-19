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
});
