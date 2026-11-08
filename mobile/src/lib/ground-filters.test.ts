import { groundMatchFilters } from "@/lib/ground-filters";

const men = { fmt: "Test" };
const women = { fmt: "ODI", gender: "female" };

test("uses the fixture format if that format is available", () => {
  const selection = groundMatchFilters([men, women, women], "Test", "");
  expect(selection.activeFmt).toBe("Test");
  expect(selection.list).toEqual([men]);
  expect(selection.both).toBe(true);
});

test("falls back to an available format when the gender filter removes the selected format", () => {
  const selection = groundMatchFilters([men, women], "Test", "female");
  expect(selection.activeFmt).toBe("ODI");
  expect(selection.formats).toEqual([["ODI", "ODI", 1]]);
  expect(selection.list).toEqual([women]);
});

test("an empty ground has no selectable formats or matches", () => {
  const selection = groundMatchFilters([], "Test", "");
  expect(selection.formats).toEqual([]);
  expect(selection.list).toEqual([]);
});
