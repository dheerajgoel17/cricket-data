import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test } from "vitest";
import { AdSlot } from "./ad-slot";

const at = (path: string, slot?: string) => render(<MemoryRouter initialEntries={[path]}><AdSlot slot={slot} /></MemoryRouter>);
afterEach(() => { delete (window as unknown as { adsbygoogle?: unknown }).adsbygoogle; });

test("a stats page with a slot id draws one unit for the publisher and asks the script to fill it", () => {
  const { container } = at("/leagues", "1234567890");
  const ins = container.querySelector("ins.adsbygoogle");
  expect(ins?.getAttribute("data-ad-slot")).toBe("1234567890");
  expect(ins?.getAttribute("data-ad-client")).toMatch(/^ca-pub-\d+$/);
  expect((window as unknown as { adsbygoogle: unknown[] }).adsbygoogle).toHaveLength(1);
});

test("no unit on a page with prices, props or fancy lines, or without a slot id", () => {
  for (const path of ["/", "/props", "/fixture/2026-11-11-a-v-b", "/fancy", "/player/12"]) expect(at(path, "1234567890").container.querySelector("ins")).toBeNull();
  expect(at("/leagues", "").container.querySelector("ins")).toBeNull();
  expect((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle).toBeUndefined();
});

test("the slot: the built-in unit when the build variable is unset or empty (GitHub passes an unset variable as empty), another id when set, none on request", async () => {
  const { slotFrom, AD_SLOT } = await import("@/lib/ads");
  expect(slotFrom(undefined)).toMatch(/^\d{10}$/);
  expect(slotFrom("")).toBe(slotFrom(undefined));
  expect(slotFrom(" 5551234567 ")).toBe("5551234567");
  expect(slotFrom("none")).toBe("");
  expect(slotFrom("garbage")).toBe(slotFrom(undefined));
  expect(AD_SLOT).toMatch(/^\d{10}$/);
});
