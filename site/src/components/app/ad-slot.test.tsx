import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { markAdEmpty } from "@/lib/ad-fill";
import { AdSlot } from "./ad-slot";

const manual = vi.hoisted(() => ({ fetch: vi.fn(), url: vi.fn() }));
vi.mock("@/lib/manual-ads", () => ({
  fetchManualPlacement: (...a: unknown[]) => manual.fetch(...a),
  creativePublicUrl: (...a: unknown[]) => manual.url(...a),
}));

const wrap = (path: string, slotId: "fancy_detail_top" | "stats_top" | "player_detail_top" = "fancy_detail_top", adsenseSlot = "1234567890") => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <AdSlot slotId={slotId} slot={adsenseSlot} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  manual.fetch.mockReset();
  manual.url.mockReset();
  sessionStorage.clear();
  delete (window as unknown as { adsbygoogle?: unknown }).adsbygoogle;
});
afterEach(() => {
  sessionStorage.clear();
  delete (window as unknown as { adsbygoogle?: unknown }).adsbygoogle;
});

test("manual creative overrides AdSense (image link, no ins)", async () => {
  manual.fetch.mockResolvedValue({
    id: "1", slot_id: "fancy_detail_top", name: "Book X", href: "https://example.com/x",
    image_path: "fancy_detail_top/a.gif", alt: "Book X", enabled: true, priority: 1, starts_at: null, ends_at: null,
  });
  manual.url.mockReturnValue("https://cdn.example/a.gif");
  const { container, findByRole } = wrap("/fixture/2026-11-11-a-v-b/fancy");
  const link = await findByRole("link", { name: /Book X/i });
  expect(link).toHaveAttribute("href", "https://example.com/x");
  expect(container.querySelector("ins.adsbygoogle")).toBeNull();
  expect((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle).toBeUndefined();
});

test("pending AdSense takes no layout chrome (no border strip)", async () => {
  manual.fetch.mockResolvedValue(null);
  const { container } = wrap("/fixture/2026-11-11-a-v-b/fancy");
  await waitFor(() => expect(container.querySelector("ins.adsbygoogle")).toBeTruthy());
  const aside = container.querySelector("aside")!;
  expect(aside.getAttribute("data-ad-fill")).toBe("pending");
  expect(aside.className).toMatch(/opacity-0/);
  expect(aside.className).not.toMatch(/border-b/);
  expect((window as unknown as { adsbygoogle: unknown[] }).adsbygoogle).toHaveLength(1);
});

test("filled AdSense shows the strip chrome", async () => {
  manual.fetch.mockResolvedValue(null);
  const { container } = wrap("/leagues", "stats_top");
  await waitFor(() => expect(container.querySelector("ins.adsbygoogle")).toBeTruthy());
  const ins = container.querySelector("ins.adsbygoogle")!;
  ins.setAttribute("data-ad-status", "filled");
  await waitFor(() => expect(container.querySelector("aside")?.getAttribute("data-ad-fill")).toBe("filled"));
  const aside = container.querySelector("aside")!;
  expect(aside.className).toMatch(/border-b/);
  expect(aside.className).not.toMatch(/opacity-0/);
});

test("unfilled AdSense collapses to nothing", async () => {
  manual.fetch.mockResolvedValue(null);
  const { container } = wrap("/leagues", "stats_top");
  await waitFor(() => expect(container.querySelector("ins.adsbygoogle")).toBeTruthy());
  const ins = container.querySelector("ins.adsbygoogle")!;
  ins.setAttribute("data-ad-status", "unfilled");
  await waitFor(() => expect(container.querySelector("aside")).toBeNull());
});

test("session-empty short-circuits AdSense remount", async () => {
  markAdEmpty("stats_top", "1234567890");
  manual.fetch.mockResolvedValue(null);
  const { container } = wrap("/leagues", "stats_top");
  await waitFor(() => expect(manual.fetch).toHaveBeenCalled());
  expect(container.querySelector("ins.adsbygoogle")).toBeNull();
  expect(container.querySelector("aside")).toBeNull();
  expect((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle).toBeUndefined();
});

test("empty AdSense slot id draws nothing when no manual", async () => {
  manual.fetch.mockResolvedValue(null);
  const { container } = wrap("/leagues", "stats_top", "");
  await waitFor(() => expect(manual.fetch).toHaveBeenCalled());
  expect(container.querySelector("ins")).toBeNull();
  expect(container.querySelector("aside")).toBeNull();
});
