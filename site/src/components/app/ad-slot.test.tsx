import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AdSlot } from "./ad-slot";

const manual = vi.hoisted(() => ({ fetch: vi.fn(), url: vi.fn() }));
vi.mock("@/lib/manual-ads", () => ({
  fetchManualPlacement: (...a: unknown[]) => manual.fetch(...a),
  creativePublicUrl: (...a: unknown[]) => manual.url(...a),
}));

const wrap = (path: string, slotId: "fancy_detail_top" | "stats_top" = "fancy_detail_top", adsenseSlot = "1234567890") => {
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
  delete (window as unknown as { adsbygoogle?: unknown }).adsbygoogle;
});
afterEach(() => { delete (window as unknown as { adsbygoogle?: unknown }).adsbygoogle; });

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

test("no manual on allowlisted path mounts AdSense push", async () => {
  manual.fetch.mockResolvedValue(null);
  const { container } = wrap("/fixture/2026-11-11-a-v-b/fancy");
  await waitFor(() => expect(container.querySelector("ins.adsbygoogle")).toBeTruthy());
  expect((window as unknown as { adsbygoogle: unknown[] }).adsbygoogle).toHaveLength(1);
});

test("unfilled AdSense collapses to nothing", async () => {
  manual.fetch.mockResolvedValue(null);
  const { container } = wrap("/leagues", "stats_top");
  await waitFor(() => expect(container.querySelector("ins.adsbygoogle")).toBeTruthy());
  const ins = container.querySelector("ins.adsbygoogle")!;
  ins.setAttribute("data-ad-status", "unfilled");
  await waitFor(() => expect(container.querySelector("aside")).toBeNull());
});

test("empty AdSense slot id draws nothing when no manual", async () => {
  manual.fetch.mockResolvedValue(null);
  const { container } = wrap("/leagues", "stats_top", "");
  await waitFor(() => expect(manual.fetch).toHaveBeenCalled());
  expect(container.querySelector("ins")).toBeNull();
  expect(container.querySelector("aside")).toBeNull();
});
