import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MiniBars, MINI_BARS_SLOTS } from "./mini-bars";

describe("MiniBars", () => {
  it("pads short histories to a fixed slot count so bar thickness matches a full L10", () => {
    const { container: short } = render(<MiniBars last={[{ v: 30, s: "hit" }, { v: 10, s: "miss" }]} line={24.5} />);
    const { container: full } = render(
      <MiniBars last={Array.from({ length: 10 }, (_, i) => ({ v: 20 + i, s: i % 2 ? "hit" : "miss" }))} line={24.5} />,
    );
    expect(short.firstElementChild!.children).toHaveLength(MINI_BARS_SLOTS + 1); // bars + dashed line
    expect(full.firstElementChild!.children).toHaveLength(MINI_BARS_SLOTS + 1);
    expect(screen.getByRole("img", { name: /Last 2:/ })).toBeInTheDocument();
  });
});
