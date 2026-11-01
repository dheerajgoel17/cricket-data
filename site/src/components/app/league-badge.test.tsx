import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_IMG_CDN", "https://img.test");
vi.mock("@/lib/data", () => ({ useData: () => ({ photos: { l: { "indian premier league": "1PW", "women s big bash league": "2KG" } } }) }));

const { LeagueBadge } = await import("./badges");

describe("LeagueBadge", () => {
  it("loads the newest season's logo by the league's folded name", () => {
    render(<LeagueBadge name="Women's Big Bash League" />);
    expect(screen.getByAltText("Women's Big Bash League")).toHaveAttribute("src", "https://img.test/Series/2KG.png");
  });

  it("shows the league's initials when the source has no logo for it, and when the logo fails to load", () => {
    const { unmount } = render(<LeagueBadge name="Some Local Cup" />);
    expect(screen.getByText("SLC")).toBeInTheDocument();
    unmount();
    render(<LeagueBadge name="Indian Premier League" />);
    fireEvent.error(screen.getByAltText("Indian Premier League"));
    expect(screen.getByText("IPL")).toBeInTheDocument();
  });
});
