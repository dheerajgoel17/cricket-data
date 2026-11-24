import { describe, expect, it } from "vitest";
import { abbr, initials } from "./format";

describe("team abbreviations", () => {
  it("ignores a bracketed tag a book adds, whatever its case or spelling", () => {
    for (const tag of ["(W)", "(w)", "(Women)", "(W"]) expect(abbr(`Perth Scorchers ${tag}`)).toBe("PS");
    expect(initials("Hobart Hurricanes (Women)")).toBe("HH");
  });

  it("keeps a plain name and a one-word name as they were", () => {
    expect(abbr("South Africa")).toBe("SA");
    expect(abbr("India")).toBe("IND");
    expect(abbr("Perth Scorchers Women")).toBe("PSW");
  });
});
