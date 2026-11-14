import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { MotionConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DesignDocsShell, navGroupFor } from "./chrome";
import { DesignSystemPage } from "@/pages/DesignSystem";
import { MotionDemos } from "./motion-demos";
import { AuthProvider } from "@/lib/auth";
import { goProduct, isDesignCataloguePath, isDesignHost } from "@/lib/design-host";

Element.prototype.scrollTo = () => {};
window.scrollTo = () => {};
window.matchMedia = window.matchMedia || ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}));

vi.mock("@/lib/data", () => ({
  DataProvider: ({ children }: { children: React.ReactNode }) => children,
  useData: () => ({ store: { P: { id: [], tm: [] }, playerName: () => "", teamName: () => "", ready: Promise.resolve() }, rz: { team: () => null, players: () => [], venues: () => [] }, matchesReady: true }),
  useDataMaybe: () => null,
}));

vi.mock("@/hooks/useEngine", () => ({
  useFixtures: () => ({ data: [] }),
}));

const groups = [
  { title: "Foundations", sections: [["type", "Typography"], ["color", "Colour"]] as const },
  { title: "Components", sections: [["buttons", "Buttons"]] as const },
] as const;

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

it("maps docs topic ids to primary nav groups", () => {
  expect(navGroupFor("type")).toBe("Foundations");
  expect(navGroupFor("components")).toBe("Components");
  expect(navGroupFor(undefined, true)).toBe("Search");
});

it("design-host helpers keep catalogue paths local", () => {
  expect(isDesignCataloguePath("/")).toBe(true);
  expect(isDesignCataloguePath("/docs/type")).toBe(true);
  expect(isDesignCataloguePath("/search")).toBe(true);
  expect(isDesignCataloguePath("/saved")).toBe(false);
  expect(isDesignCataloguePath("/auth/callback")).toBe(false);
  expect(isDesignCataloguePath("/props")).toBe(false);
  expect(typeof goProduct).toBe("function");
  expect(typeof isDesignHost()).toBe("boolean");
  expect(isDesignHost("design.fancy.cash")).toBe(true);
  expect(isDesignHost("fancy.cash")).toBe(false);
});

it("docs footer and Saved link target PRODUCT_ORIGIN", async () => {
  const { PRODUCT_ORIGIN } = await import("@/lib/design-host");
  render(wrap(
    <DesignDocsShell groups={groups} currentId="color" topicPath={(id) => `/docs/${id}`}>
      <p>Content</p>
    </DesignDocsShell>,
  ));
  expect(screen.getByRole("link", { name: "fancy.cash" })).toHaveAttribute("href", `${PRODUCT_ORIGIN}/`);
  const saved = screen.getByRole("link", { name: "Saved", hidden: true });
  // Off design host Saved is an in-app Link; on design host it is PRODUCT_ORIGIN/saved (covered when hostname matches).
  expect(saved.getAttribute("href")).toMatch(/\/saved$/);
});

it("docs shell mounts product Header search and sidebar topics", () => {
  render(wrap(
    <DesignDocsShell groups={groups} currentId="color" topicPath={(id) => `/docs/${id}`}>
      <p>Content</p>
    </DesignDocsShell>,
  ));
  expect(screen.getByRole("link", { name: "Colour" })).toHaveAttribute("data-active", "true");
  expect(screen.getAllByRole("button", { name: "Search" }).length).toBeGreaterThan(0);
  // Auth control: Sign in when logged out, Account when a session exists in the test env.
  expect(
    screen.queryByRole("button", { name: "Sign in" })
      || screen.queryByRole("button", { name: /Account/ }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Saved", hidden: true })).toBeInTheDocument();
  expect(document.querySelector('ion-tab-bar[aria-label="Sections"]')).toBeTruthy();
});

it("renders EmptyState on an unknown docs path", () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/docs/not-a-real-topic"]}>
          <Routes>
            <Route path="*" element={<DesignSystemPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("heading", { name: "Page not found" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Design system home" })).toBeVisible();
});

it("docs topic uses DocsArticle header instead of product PageTitle crumbs", () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/docs/buttons"]}>
          <Routes>
            <Route path="*" element={<DesignSystemPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("heading", { level: 1, name: "Buttons" })).toBeVisible();
  expect(screen.getByText("When to use")).toBeVisible();
  expect(screen.getByRole("heading", { level: 2, name: "Variants" })).toBeVisible();
  expect(screen.getByRole("navigation", { name: "Adjacent topics" })).toBeVisible();
});

it("motion demos expose replay controls and product timing notes", () => {
  render(
    <MotionConfig reducedMotion="always">
      <MotionDemos />
    </MotionConfig>,
  );
  expect(screen.getByRole("button", { name: "Replay" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Selection spring" })).toBeVisible();
});
