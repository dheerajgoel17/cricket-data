import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Slot = { wash: string | null; setWash: (w: string | null) => void; el: HTMLElement | null; setEl: (e: HTMLElement | null) => void; active: boolean; setActive: (a: boolean) => void; flush: boolean; setFlush: (f: boolean) => void };
const Ctx = createContext<Slot | null>(null);

/** Lets a page put its own actions in the top bar. On phones the bar drops the logo/search/account for those actions; from lg the brand mark stays and the slot holds trailing actions (e.g. share). Prefer `Crumbs` / `Link` for desktop navigation instead of a back button. */
export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const [flush, setFlush] = useState(false);
  const [wash, setWash] = useState<string | null>(null);
  return <Ctx.Provider value={{ wash, setWash, el, setEl, active, setActive, flush, setFlush }}>{children}</Ctx.Provider>;
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

/**
 * An entity page's tint (player, team) as a page-level layer behind the header and the sticky chip band, so the colour flows through them instead of starting below them (app twin:
 * `PageAtmosphere` + `EntityHeroWash` with the clear-to-solid header). The layer is drawn by the shell; the header and the band turn solid once the page scrolls (`useScrolled`).
 */
export function usePageWash(accent: string | null) {
  const setWash = useContext(Ctx)?.setWash;
  useEffect(() => {
    if (!accent) return;
    setWash?.(accent);
    return () => setWash?.(null);
  }, [accent, setWash]);
}

/** The accent currently washing the page, or null. */
export const usePageWashColor = () => useContext(Ctx)?.wash ?? null;

/** True once the window has scrolled past `after` px: the clear chrome over a wash goes solid. */
export function useScrolled(after = 8) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => setOn(window.scrollY > after);
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, [after]);
  return on;
}
