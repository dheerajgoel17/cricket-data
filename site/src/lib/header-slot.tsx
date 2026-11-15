import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Slot = { el: HTMLElement | null; setEl: (e: HTMLElement | null) => void; active: boolean; setActive: (a: boolean) => void; flush: boolean; setFlush: (f: boolean) => void };
const Ctx = createContext<Slot | null>(null);

/** Lets a page put its own actions in the top bar. On phones the bar drops the logo/search/account for those actions; from lg the brand mark stays and the slot holds trailing actions (e.g. share). Prefer `Crumbs` / `Link` for desktop navigation instead of a back button. */
export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const [flush, setFlush] = useState(false);
  return <Ctx.Provider value={{ el, setEl, active, setActive, flush, setFlush }}>{children}</Ctx.Provider>;
}

export const useHeaderSlot = () => useContext(Ctx);

/** Renders its children in the top bar (nothing outside the shell). */
export function HeaderActions({ children }: { children: ReactNode }) {
  const slot = useContext(Ctx);
  const setActive = slot?.setActive;
  useEffect(() => {
    setActive?.(true);
    return () => setActive?.(false);
  }, [setActive]);
  return slot?.el ? createPortal(children, slot.el) : null;
}

/**
 * Tab page title in the shell bar (app `AppHeader title=` twin). Phone swaps out the brand; from `lg` the brand stays and the title sits beside it.
 * Use on every tab except Fixtures / Home (those keep the wordmark). Search + account stay via Header for top-level owned bars.
 */
export function TabTitle({ children }: { children: ReactNode }) {
  return (
    <HeaderActions>
      <h1 className="min-w-0 flex-1 truncate text-title font-emphasis tracking-tight">{children}</h1>
    </HeaderActions>
  );
}

/** A full-width card sits right under the top bar: the bar takes the card's background and drops its bottom line, so the two read as one surface. */
export function useHeaderFlush(flush: boolean) {
  const setFlush = useContext(Ctx)?.setFlush;
  useEffect(() => {
    if (!flush) return;
    setFlush?.(true);
    return () => setFlush?.(false);
  }, [flush, setFlush]);
}
