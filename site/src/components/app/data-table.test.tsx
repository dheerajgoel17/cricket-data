import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable, TABLE_BLEED, TABLE_HEAD } from "./page";
import { BOARD_HEAD } from "./tournament-stats";

const root = join(import.meta.dirname, "../..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("DataTable (stats tables)", () => {
  it("exports the shared header and bleed recipes", () => {
    expect(TABLE_HEAD).toContain("label-cap");
    expect(TABLE_HEAD).toContain("text-footnote");
    expect(TABLE_BLEED).toContain("-mx-gutter");
    expect(TABLE_BLEED).toContain("border-hairline");
    expect(TABLE_BLEED).toContain("lg:mx-0");
  });

  it("keeps BOARD_HEAD as the denser league-board variant", () => {
    expect(BOARD_HEAD).toContain("label-cap");
    expect(BOARD_HEAD).toContain("text-caption");
    expect(BOARD_HEAD).not.toContain("text-footnote");
  });

  it("renders headers and cells", () => {
    render(<DataTable columns={["Prop", "Hit"]} rows={[["Runs", "60%"]]} />);
    expect(screen.getByText("Prop")).toBeInTheDocument();
    expect(screen.getByText("Runs")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("wraps with the phone bleed contract when bleed is set", () => {
    const { container } = render(<DataTable bleed columns={["A"]} rows={[["1"]]} />);
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.className).toContain("-mx-gutter");
    expect(wrap.className).toContain("border-y");
    expect(wrap.className).toContain("lg:mx-0");
  });

  it("Match Fancy ladder and Ask ResultView use the shared recipes", () => {
    expect(src("components/app/match-fancy.tsx")).toContain("TABLE_HEAD");
    const result = src("components/app/result.tsx");
    expect(result).toContain("bleed");
    expect(result).toContain("LadderTable bleed");
    expect(src("pages/Markets.tsx")).toMatch(/DataTable bleed/);
    expect(src("pages/Simple.tsx")).toMatch(/DataTable bleed/);
  });
});
