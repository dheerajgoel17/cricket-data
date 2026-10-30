import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OutcomeDonut, RateHeatStrip } from "./viz";

describe("OutcomeDonut", () => {
  it("stays off when fewer than three outcome kinds are live", () => {
    const { container } = render(
      <OutcomeDonut caption="L20 mix" center="60%" slices={[
        { key: "hit", n: 8, color: "green" }, { key: "miss", n: 4, color: "red" },
        { key: "push", n: 0, color: "amber" }, { key: "out", n: 0, color: "gray" },
      ]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("draws a ring when three or more kinds are live", () => {
    render(
      <OutcomeDonut caption="L20 mix" center="55%" slices={[
        { key: "hit", n: 6, color: "green" }, { key: "miss", n: 3, color: "red" },
        { key: "push", n: 1, color: "amber" }, { key: "out", n: 2, color: "gray" },
      ]} />,
    );
    expect(screen.getByRole("img", { name: "L20 mix 55%" })).toBeInTheDocument();
  });
});

describe("RateHeatStrip", () => {
  it("stays off under five groups", () => {
    const { container } = render(<RateHeatStrip title="by venue" rows={[
      { label: "A", pOver: 0.8, n: 10 }, { label: "B", pOver: 0.4, n: 8 },
      { label: "C", pOver: 0.5, n: 6 }, { label: "D", pOver: null, n: 2 },
    ]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows one cell per group when there are five or more", () => {
    render(<RateHeatStrip title="by opposition" rows={[
      { label: "A", pOver: 0.8, n: 10 }, { label: "B", pOver: 0.4, n: 8 },
      { label: "C", pOver: 0.5, n: 6 }, { label: "D", pOver: 0.2, n: 4 },
      { label: "E", pOver: null, n: 2 },
    ]} />);
    expect(screen.getByLabelText("by opposition")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("–")).toBeInTheDocument();
  });
});
