import { describe, expect, it } from "vitest";
import { innLabel } from "./live-board";

describe("innLabel", () => {
  it("is the team code when each side bats once (T20, ODI)", () => {
    const card = [{ team: "New Zealand" }, { team: "India" }];
    expect([0, 1].map((k) => innLabel(card, k))).toEqual(["NZ", "IND"]);
  });
  it("numbers a side's innings once it bats again (Test)", () => {
    const card = [{ team: "South Africa" }, { team: "Australia" }, { team: "South Africa" }, { team: "Australia" }];
    expect([0, 1, 2, 3].map((k) => innLabel(card, k))).toEqual(["SA 1st", "AUS 1st", "SA 2nd", "AUS 2nd"]);
  });
  it("leaves a follow-on or a side that has batted once unnumbered", () => {
    const card = [{ team: "England" }, { team: "India" }, { team: "India" }];
    expect([0, 1, 2].map((k) => innLabel(card, k))).toEqual(["ENG", "IND 1st", "IND 2nd"]);
  });
});
