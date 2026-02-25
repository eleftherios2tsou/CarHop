import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Badge from "./Badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies ok class for ok tone", () => {
    render(<Badge tone="ok">OK</Badge>);
    expect(screen.getByText("OK")).toHaveClass("badgeOk");
  });

  it("applies warn class for warn tone", () => {
    render(<Badge tone="warn">Warn</Badge>);
    expect(screen.getByText("Warn")).toHaveClass("badgeWarn");
  });

  it("applies bad class for bad tone", () => {
    render(<Badge tone="bad">Bad</Badge>);
    expect(screen.getByText("Bad")).toHaveClass("badgeBad");
  });

  it("applies base badge class by default (neutral)", () => {
    render(<Badge>Neutral</Badge>);
    const el = screen.getByText("Neutral");
    expect(el).toHaveClass("badge");
    expect(el).not.toHaveClass("badgeOk");
    expect(el).not.toHaveClass("badgeWarn");
    expect(el).not.toHaveClass("badgeBad");
  });
});
