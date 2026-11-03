import { fit, layoutWidth } from "@/lib/fit";

describe("text fit", () => {
  test("a screen as wide as the design, or wider, is not scaled", () => {
    expect(fit(390)).toBe(1);
    expect(fit(412)).toBe(1);
    expect(fit(1024)).toBe(1);
  });

  test("a narrower screen scales in proportion", () => {
    expect(fit(360)).toBeCloseTo(360 / 390, 10); // a typical 360 dp Android: 0.923
    expect(fit(351)).toBeCloseTo(0.9, 10);
  });

  test("never below 0.85, so a 320 dp screen or a large display size stays readable", () => {
    expect(fit(320)).toBe(0.85);
    expect(fit(200)).toBe(0.85);
  });

  test("in a browser only the app's column counts: a desktop window is the design size, a narrow one still scales", () => {
    expect(fit(layoutWidth(1920, "web"))).toBe(1);
    expect(layoutWidth(1920, "web")).toBe(560);
    expect(fit(layoutWidth(340, "web"))).toBeCloseTo(340 / 390, 10);
    expect(layoutWidth(1920, "android")).toBe(1920);
  });
});
