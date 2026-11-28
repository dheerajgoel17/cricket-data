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
