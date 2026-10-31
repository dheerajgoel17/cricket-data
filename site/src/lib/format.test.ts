import { describe, expect, it } from "vitest";
import { abbr, dayLabel, fixtureWhen, fixtureStart, fromIst, initials, localTime, num, odds, pc, shortDate, shortVenue } from "./format";

describe("format helpers", () => {
  it("formats odds, percentages and numbers, with a dash for missing values", () => {
    expect(odds(1.6666)).toBe("1.67");
    expect(odds(null)).toBe("–");
    expect(pc(0.4857)).toBe("48.6%");
    expect(pc(undefined)).toBe("–");
    expect(num(28)).toBe("28");
    expect(num(34.3376)).toBe("34.34");
    expect(num(null)).toBe("–");
  });
  it("builds initials and short opponent codes", () => {
    expect(initials("Mumbai Indians")).toBe("MI");
    expect(initials("India (W)")).toBe("I");
    expect(abbr("Mumbai Indians")).toBe("MI");
    expect(abbr("India")).toBe("IND");
  });
  it("shortens a ground for a prop row: famous shorts, stripped stadium, else the city", () => {
    expect(shortVenue("Western Australia Cricket Association Ground, Perth")).toBe("WACA");
    expect(shortVenue("Melbourne Cricket Ground, Melbourne")).toBe("MCG");
    expect(shortVenue("The Gabba, Brisbane")).toBe("Gabba");
    expect(shortVenue("Lord's Cricket Ground, London")).toBe("Lord's");
    expect(shortVenue("The Wanderers Stadium, Johannesburg")).toBe("Wanderers");
    expect(shortVenue("Sher-e-Bangla National Stadium, Mirpur, Dhaka")).toBe("Sher-e-Bangla");
    expect(shortVenue("Wankhede Stadium, Mumbai")).toBe("Wankhede");
    expect(shortVenue("Gaddafi Stadium, Lahore")).toBe("Gaddafi");
    expect(shortVenue("Eden Gardens, Kolkata")).toBe("Eden Gardens");
    expect(shortVenue("Hagley Oval, Christchurch")).toBe("Hagley Oval");
    expect(shortVenue("Newlands, Cape Town")).toBe("Newlands");
    expect(shortVenue("Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur, New Chandigarh")).toBe("Mullanpur");
    expect(shortVenue("Tribhuvan University International Cricket Ground, Kirtipur")).toBe("Kirtipur");
    expect(shortVenue("")).toBe("");
  });
  it("turns a chart date into dd/mm", () => { expect(shortDate("2026-05-23")).toBe("23/05"); });
  it("parses the value-bets IST timestamp into the right instant", () => {
    expect(fromIst("2026-10-23 17:00 IST")?.toISOString()).toBe("2026-10-23T11:30:00.000Z");
    expect(fromIst("nonsense")).toBeNull();
  });
  it("labels today and tomorrow", () => {
    const k = (d: Date) => d.toLocaleDateString("en-CA");
    const now = new Date(), next = new Date(Date.now() + 864e5);
    expect(dayLabel(k(now))).toBe("Today");
    expect(dayLabel(k(next))).toBe("Tomorrow");
  });
  it("shows kick-off times in the viewer's own zone and never invents a time for date-only fixtures", () => {
    const utc = "2026-12-09T23:00:00Z";
    expect(fixtureStart({ start: utc }).toISOString()).toBe("2026-12-09T23:00:00.000Z");
    expect(localTime(utc)).toBe(new Date(utc).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", ...(/-IN$/.test(navigator.language) ? { hour12: true } : {}) }));
    expect(fixtureWhen({ start: utc })).not.toMatch(/TBC/);
    expect(fixtureWhen({ start: "2026-12-10" })).toMatch(/time TBC/);
    expect(fixtureWhen({ start: "2026-12-10" })).not.toMatch(/12:00/);
  });
});
