import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { DesignReference, TypographyReference, referenceSections } from "./reference";

it("links every reference section and searches the actual shared tokens", () => {
  const { container } = render(<DesignReference />);
  for (const [id] of referenceSections) expect(container.querySelector("#" + id)).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "weight-editorial" } });
  expect(screen.getByText("weight-editorial")).toBeVisible();
  expect(screen.getByText("300")).toBeVisible();
  expect(screen.queryByText("weight-copy")).toBeNull();
});

it("filters platform modules and drives the production Button variant and state", () => {
  render(<DesignReference />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "site/src/components/ui/button.tsx" } });
  fireEvent.click(screen.getByText("Button", { exact: false, selector: "summary" }));
  fireEvent.change(screen.getByLabelText("Variant"), { target: { value: "destructive" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Disabled" }));
  const button = screen.getByRole("button", { name: "Add filter" });
  expect(button).toHaveAttribute("data-variant", "destructive");
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Platform"), { target: { value: "ios" } });
  expect(screen.getByText("No source modules match this search and platform.")).toBeVisible();
});

it("lists the shared type scale and toggles specimen wrapping", () => {
  render(<TypographyReference />);
  expect(within(screen.getByRole("table")).getByText("fs-caption")).toBeVisible();
  fireEvent.click(screen.getByRole("checkbox", { name: "Wrap specimen" }));
  expect(screen.getByText(/Player props and historical/)).toHaveClass("truncate");
});
