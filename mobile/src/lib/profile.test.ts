import { profileParts } from "@/lib/profile";

const doc = {
  v: 1,
  l: { r: { BAT: "Batter", BWL: "Bowler", AR: "All-rounder", WK: "Wicketkeeper" }, b: { RHB: "Right-hand bat", LHB: "Left-hand bat" }, w: { OB: "Off-spin", RFM: "Right-arm fast-medium" } },
  p: { a1: { r: "AR", b: "RHB", w: "OB" }, b2: { r: "BAT", b: "LHB" }, c3: { w: "RFM" }, d4: { r: "XX", w: "ZZ" } },
};

describe("profileParts", () => {
  test("role, hand and bowling style in that order, the role and style by their labels and the hand by its code", () => {
    expect(profileParts(doc, "a1")).toEqual(["All-rounder", "RHB", "Off-spin"]);
  });

  test("a missing field is left out, never filled in", () => {
    expect(profileParts(doc, "b2")).toEqual(["Batter", "LHB"]);
    expect(profileParts(doc, "c3")).toEqual(["Right-arm fast-medium"]);
  });

  test("a code the label table does not know is shown as it is", () => {
    expect(profileParts(doc, "d4")).toEqual(["XX", "ZZ"]);
  });

  test("a player with no profile, no id, or no file gives nothing", () => {
    expect(profileParts(doc, "nobody")).toEqual([]);
    expect(profileParts(doc, undefined)).toEqual([]);
    expect(profileParts(null, "a1")).toEqual([]);
    expect(profileParts({}, "a1")).toEqual([]);
  });
});
