import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DisputeCreateModal from "./DisputeCreateModal";

describe("DisputeCreateModal", () => {
  it("submits the expected payload when reason is valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <DisputeCreateModal
        open
        bookingId={42}
        busy={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const submitButton = screen.getByRole("button", { name: "Submit Dispute" });
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText("Reason"), "Flat tire on pickup");
    await user.type(screen.getByLabelText("Details"), "Front-left tire was punctured before start.");
    await user.click(submitButton);

    expect(onSubmit).toHaveBeenCalledWith({
      bookingId: 42,
      reason: "Flat tire on pickup",
      details: "Front-left tire was punctured before start.",
    });
  });
});
