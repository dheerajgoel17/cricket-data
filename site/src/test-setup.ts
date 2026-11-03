import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";
import { resetAuthHarness } from "./test/auth-harness";

vi.mock("@/lib/auth", async () => {
  const m = await import("./test/auth-harness");
  return m.mockAuthModule();
});
vi.mock("@/lib/supabase", async () => {
  const m = await import("./test/auth-harness");
  return m.mockSupabaseModule();
});

beforeEach(() => { resetAuthHarness(); });

// jsdom lacks these browser APIs that Radix / Motion probe for.
Object.defineProperty(window, "matchMedia", { writable: true, value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) });
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver ??= RO;
Element.prototype.scrollIntoView ??= () => {};
