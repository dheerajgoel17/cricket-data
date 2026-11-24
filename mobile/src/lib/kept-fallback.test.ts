import { withKeptFallback } from "./kept-fallback";

describe("withKeptFallback", () => {
  it("returns the fresh answer", async () => {
    await expect(withKeptFallback(async () => "fresh", () => "kept")).resolves.toBe("fresh");
  });

  it("falls back to the kept copy when the request fails", async () => {
    await expect(withKeptFallback(async () => { throw new Error("offline"); }, () => "kept")).resolves.toBe("kept");
  });

  it("rethrows when there is nothing kept, so the empty answer is never cached as data", async () => {
    await expect(withKeptFallback(async () => { throw new Error("offline"); }, () => undefined)).rejects.toThrow("offline");
  });
});
