import { city, countdown, dayLabel, initials, seriesName, shortSeries, startsIn } from "@/lib/format";

describe("startsIn", () => {
  test.each([
    [46 * 60e3, "Starts in 46m"],
    [3 * 3600e3, "Starts in 3h"],
    [100 * 60e3, "Starts in 1h 40m"],
    [26 * 3600e3, "Starts in 1 day"],
    [49 * 3600e3, "Starts in 2 days"],
  ])("%d ms", (ms, want) => expect(startsIn(ms)).toBe(want));
});

describe("names", () => {
  test("shortSeries drops the year, the place and the host", () => {
    expect(shortSeries("India tour of New Zealand 2026")).toBe("India tour");
    expect(shortSeries("Afghanistan vs Zimbabwe in UAE 2026")).toBe("Afghanistan vs Zimbabwe");
    expect(shortSeries("Womens Big Bash League 2026")).toBe("Womens Big Bash League");
  });
  test("seriesName falls back to the men's / women's label", () => {
    expect(seriesName({ series: "", gender: "female" })).toBe("Women's cricket");
    expect(seriesName({ series: "", gender: "male" })).toBe("Men's cricket");
    expect(seriesName({ series: "CSA Pro T20 Cup 2026" })).toBe("CSA Pro T20 Cup 2026");
  });
  test("city is the first part of the venue, without a bracket", () => {
    expect(city("Sharjah Cricket Stadium, Sharjah")).toBe("Sharjah Cricket Stadium");
    expect(city("Eden Park (Auckland), NZ")).toBe("Eden Park");
  });
  test("initials skip (W) and Women", () => {
    expect(initials("Hobart Hurricanes Women")).toBe("HH");
    expect(initials("Oman")).toBe("O");
    expect(initials("Women's Big Bash League")).toBe("WB"); // "Women's" in a league's own name stays
  });
});

describe("dayLabel", () => {
  const NOW = Date.parse("2026-11-01T10:00:00Z");
  test("today and tomorrow", () => {
    expect(dayLabel(new Date(NOW), NOW)).toBe("Today");
    expect(dayLabel(new Date(NOW + 24 * 3600e3), NOW)).toBe("Tomorrow");
  });
});

describe("countdown", () => {
  test.each([
    [0, "00:00:00"],
    [-5000, "00:00:00"],
    [12 * 3600e3 + 13 * 60e3 + 42e3, "12:13:42"],
    [59e3, "00:00:59"],
    [26 * 3600e3 + 61e3, "1d 02:01:01"],
    [3 * 86400e3 + 3 * 3600e3 + 10 * 60e3 + 5e3, "3d 03:10:05"],
  ])("%d ms", (ms, want) => expect(countdown(ms)).toBe(want));
});
