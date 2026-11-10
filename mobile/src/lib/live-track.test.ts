import { trackOf } from "@/lib/live-track";

test("the bar fills to the score against the line", () => {
  expect(trackOf(10, 40)).toEqual({ fill: 25, tone: "neutral", lineAt: null, wasAt: null });
});

test("past the live line the bar runs to the score, with a notch at the line, and is green", () => {
  expect(trackOf(50, 40)).toEqual({ fill: 100, tone: "primary", lineAt: 80, wasAt: null });
});

test("a notch marks where the line opened, and the bar is green once the score passes it", () => {
  expect(trackOf(20, 40, 15)).toMatchObject({ tone: "primary", wasAt: 37.5 });
  expect(trackOf(10, 40, 15)).toMatchObject({ tone: "neutral", wasAt: 37.5 });
  expect(trackOf(10, 40, 40)?.wasAt).toBeNull(); // not moved: no notch
});

test("a missed line is red; nothing draws without a score or a line", () => {
  expect(trackOf(10, 40, null, "missed")?.tone).toBe("miss");
  expect(trackOf(null, 40)).toBeNull();
  expect(trackOf(10, 0)).toBeNull();
  expect(trackOf(-1, 40)).toBeNull();
});
