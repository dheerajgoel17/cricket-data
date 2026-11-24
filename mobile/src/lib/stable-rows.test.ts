import { makeStabilizer } from "./stable-rows";

type Row = { id: number; name: string };

describe("makeStabilizer", () => {
  const rows: Row[] = [{ id: 1, name: "a" }, { id: 2, name: "b" }];

  it("returns the same array and rows when nothing layered on top changed", () => {
    const stable = makeStabilizer<Row, { out: boolean }>();
    const first = stable(rows, () => ({ out: false }));
    const again = stable(rows, () => ({ out: false }));
    expect(again).toBe(first);
    expect(again[0]).toBe(first[0]);
  });

  it("rebuilds only the row whose layered value changed", () => {
    const stable = makeStabilizer<Row, { out: boolean }>();
    const first = stable(rows, () => ({ out: false }));
    const next = stable(rows, (r) => ({ out: r.id === 2 }));
    expect(next).not.toBe(first);
    expect(next[0]).toBe(first[0]);
    expect(next[1]).not.toBe(first[1]);
    expect(next[1]).toEqual({ id: 2, name: "b", out: true });
  });

  it("follows a changed source row list", () => {
    const stable = makeStabilizer<Row, { out: boolean }>();
    const first = stable(rows, () => ({ out: false }));
    const next = stable([rows[0]], () => ({ out: false }));
    expect(next).toHaveLength(1);
    expect(next[0]).toBe(first[0]);
  });
});
