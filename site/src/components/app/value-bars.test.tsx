import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ValueBars } from "./mini-bars";

const labels = (n: number) => Array.from({ length: n }, (_, i) => ({ date: `${i + 1} Oct`, text: i % 2 ? "ENG v SL" : "IND v NZ" }));

describe("ValueBars", () => {
  it("puts each match's value, sides and date under its bar when there are few enough", () => {
    render(<ValueBars values={[48, 52, 61]} line={50.5} labels={labels(3)} />);
    expect(screen.getByText("1 Oct")).toBeInTheDocument();
    expect(screen.getAllByText("IND v NZ")).toHaveLength(2);
    expect(screen.getByText("ENG v SL")).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
    expect(screen.queryByText("Oldest")).not.toBeInTheDocument();
  });

  it("keeps to the oldest and latest dates when there are too many to label", () => {
    render(<ValueBars values={Array.from({ length: 30 }, (_, i) => 40 + i)} line={50.5} labels={labels(30)} />);
    expect(screen.getByText("Oldest · 1 Oct")).toBeInTheDocument();
    expect(screen.getByText("30 Oct · Latest")).toBeInTheDocument();
  });

  it("is the old chart when it is given no labels", () => {
    render(<ValueBars values={[10, 20]} line={15.5} />);
    expect(screen.getByText("Oldest")).toBeInTheDocument();
    expect(screen.getByText("Latest")).toBeInTheDocument();
  });
});
