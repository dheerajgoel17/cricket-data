import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { IosTabBar } from "./IosTabBar";

function Path() {
  return <output>{useLocation().pathname}</output>;
}

function touch(bar: HTMLElement, type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: x, clientY: y });
  fireEvent(bar, event);
}

it("switches one tab per horizontal swipe and ignores vertical and edge swipes", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  try {
    render(<MemoryRouter><IosTabBar /><Path /></MemoryRouter>);
    const bar = screen.getByLabelText("Sections");
    touch(bar, "pointerdown", 100, 20);
    touch(bar, "pointerup", 150, 20);
    expect(screen.getByRole("status")).toHaveTextContent(/^\/$/);

    touch(bar, "pointerdown", 100, 20);
    touch(bar, "pointerup", 50, 90);
    expect(screen.getByRole("status")).toHaveTextContent(/^\/$/);

    touch(bar, "pointerdown", 100, 20);
    touch(bar, "pointerup", 50, 20);
    expect(screen.getByRole("status")).toHaveTextContent(/^\/props$/);
    fireEvent.click(bar.querySelector("ion-tab-button")!, { detail: 1 });
    expect(screen.getByRole("status")).toHaveTextContent(/^\/props$/);

    touch(bar, "pointerdown", 50, 20);
    touch(bar, "pointerup", 100, 20);
    expect(screen.getByRole("status")).toHaveTextContent(/^\/$/);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("collapses on downward scroll and reopens on tap or upward scroll", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("scrollY", 0);
  try {
    const { container } = render(<MemoryRouter><IosTabBar /></MemoryRouter>);
    const dock = container.querySelector(".phone-tab-dock");
    const scroll = (y: number) => {
      vi.stubGlobal("scrollY", y);
      fireEvent.scroll(window);
    };

    scroll(96);
    expect(dock).toHaveAttribute("data-collapsed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Show navigation tabs, current section Fixtures" }));
    expect(dock).toHaveAttribute("data-collapsed", "false");
    scroll(132);
    expect(dock).toHaveAttribute("data-collapsed", "true");
    scroll(110);
    expect(dock).toHaveAttribute("data-collapsed", "false");
  } finally {
    vi.unstubAllGlobals();
  }
});
