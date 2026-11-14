import { afterEach, describe, expect, it, vi } from "vitest";
import { goProduct, isDesignCataloguePath, isDesignHost, PRODUCT_ORIGIN } from "./design-host";

describe("design-host", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("treats only the catalogue hostname as the design host", () => {
    expect(isDesignHost("design.fancy.cash")).toBe(true);
    expect(isDesignHost("fancy.cash")).toBe(false);
    expect(isDesignHost("localhost")).toBe(false);
  });

  it("keeps catalogue paths local and hands product paths off", () => {
    expect(isDesignCataloguePath("/")).toBe(true);
    expect(isDesignCataloguePath("/docs/buttons")).toBe(true);
    expect(isDesignCataloguePath("/search")).toBe(true);
    expect(isDesignCataloguePath("/saved")).toBe(false);
    expect(isDesignCataloguePath("/auth/callback")).toBe(false);
    expect(isDesignCataloguePath("/props")).toBe(false);
  });

  it("goProduct assigns to PRODUCT_ORIGIN", () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...location, assign });
    goProduct("/saved");
    expect(assign).toHaveBeenCalledWith(`${PRODUCT_ORIGIN}/saved`);
    goProduct("props");
    expect(assign).toHaveBeenCalledWith(`${PRODUCT_ORIGIN}/props`);
  });
});
