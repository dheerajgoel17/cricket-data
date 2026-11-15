import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { gridFor } from "../../../packages/tokens/grid.js";
import { CardGrid } from "./page";

describe("CardGrid", () => {
  it("puts as many cards on a row as the grid tokens say (1 / 2 / 3)", () => {
    const { container } = render(<CardGrid><div /></CardGrid>);
    const cls = (container.firstElementChild as HTMLElement).className;
    const cols = (p: string) => Number(new RegExp(`(?:^|\\s)${p}grid-cols-(\\d+)`).exec(cls)?.[1]);
    expect(cols("")).toBe(gridFor(375).perRow);
    expect(cols("md:")).toBe(gridFor(768).perRow);
    expect(cols("xl:")).toBe(gridFor(1440).perRow);
  });
});
