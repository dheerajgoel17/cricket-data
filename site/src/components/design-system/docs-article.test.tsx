import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { DocsArticle, DocsPager, slugify } from "./docs-article";
import { PreviewFrame } from "./example-stage";

it("slugify builds stable section anchors", () => {
  expect(slugify("PillGroup — default")).toBe("pillgroup-default");
  expect(slugify("ChartBars")).toBe("chartbars");
});

it("DocsArticle renders header, when-to-use, TOC, and pager", () => {
  render(
    <MemoryRouter>
      <DocsArticle
        title="Buttons"
        lead="Actions and status badges."
        group="Components"
        source="components/ui/button.tsx"
        when="One primary action per region."
        toc={[
          { id: "variants", label: "Variants" },
          { id: "loading", label: "Loading" },
        ]}
        pager={{
          prev: { to: "/docs/components", label: "Overview", group: "Components" },
          next: { to: "/docs/chips", label: "Chips & tabs", group: "Components" },
        }}
      >
        <p>Body</p>
      </DocsArticle>
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { level: 1, name: "Buttons" })).toBeVisible();
  expect(screen.getByText("One primary action per region.")).toBeVisible();
  expect(screen.getByRole("navigation", { name: "On this page" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Chips & tabs/ })).toHaveAttribute("href", "/docs/chips");
  expect(screen.getByText("components/ui/button.tsx")).toBeVisible();
});

it("PreviewFrame exposes H2 anchor and preview toolbar", () => {
  render(
    <PreviewFrame title="Variants" description="Product CTAs." source="components/ui/button.tsx">
      <button type="button">Default</button>
    </PreviewFrame>,
  );
  expect(screen.getByRole("heading", { level: 2, name: "Variants" })).toBeVisible();
  expect(document.getElementById("variants")).toBeTruthy();
  expect(screen.getByText("Preview")).toBeVisible();
  expect(screen.getByText("components/ui/button.tsx")).toBeVisible();
});

it("DocsPager omits empty sides", () => {
  render(
    <MemoryRouter>
      <DocsPager next={{ to: "/docs/type", label: "Typography", group: "Foundations" }} />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: /Typography/ })).toBeVisible();
  expect(screen.queryByText("Previous")).toBeNull();
});
