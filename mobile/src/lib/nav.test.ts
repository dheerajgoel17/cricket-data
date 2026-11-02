jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => false) } }));

import { router } from "expo-router";
import { fixturePath, goBack, openFixture, openPlayer, playerPath, push } from "@/lib/nav";

describe("links", () => {
  test("a player link carries the site's parameters, the format as its number", () => {
    expect(playerPath({ idx: 4421, stat: "runs", line: 24.5, fmt: "T20" })).toBe("/player/4421?stat=runs&line=24.5&fmt=0");
    expect(playerPath({ idx: 7, stat: "wickets", line: 1.5, fmt: "Test", inn: 2, team: "New Zealand" })).toBe("/player/7?stat=wickets&line=1.5&fmt=2&scope=2&team=New%20Zealand");
  });

  test("a fixture link is the fixture's id", () => {
    expect(fixturePath("2026-10-27-south-africa-v-australia")).toBe("/fixture/2026-10-27-south-africa-v-australia");
  });
});

describe("taps", () => {
  // a tap pushes one frame later (so the pressed state paints first) and a second tap within 700 ms is dropped
  let now = 1_000_000;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(Date, "now").mockImplementation(() => (now += 1000));
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
  const frame = () => jest.advanceTimersByTime(20);

  test("a fixture with an id opens its page; one with none opens nothing", () => {
    openFixture({ id: "2026-11-02-oman-v-netherlands" });
    expect(router.push).not.toHaveBeenCalled(); // not before the frame
    frame();
    expect(router.push).toHaveBeenCalledWith("/fixture/2026-11-02-oman-v-netherlands");
    openFixture({});
    frame();
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  test("a prop row opens the player on its line", () => {
    openPlayer({ idx: 12, stat: "sixes", line: 0.5, fmt: "ODI" });
    frame();
    expect(router.push).toHaveBeenCalledWith("/player/12?stat=sixes&line=0.5&fmt=1");
  });

  test("a second tap right after the first is dropped, a later one is not", () => {
    (Date.now as jest.Mock).mockImplementation(() => 90_000_000);
    push("/a");
    push("/b"); // the same instant: a ghost or impatient tap
    frame();
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/a");
    (Date.now as jest.Mock).mockImplementation(() => 90_001_000);
    push("/c");
    frame();
    expect(router.push).toHaveBeenCalledWith("/c");
  });

  test("back goes to Fixtures when there is no page behind", () => {
    goBack();
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
