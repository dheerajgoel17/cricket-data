import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { initialize } from "@ionic/core/components";
import { defineCustomElement as defineLabel } from "@ionic/core/components/ion-label.js";
import { defineCustomElement as defineTabBar } from "@ionic/core/components/ion-tab-bar.js";
import { defineCustomElement as defineTabButton } from "@ionic/core/components/ion-tab-button.js";
import { defineCustomElement as defineIcon } from "ionicons/components/ion-icon.js";
import { calendar, calendarOutline, dice, diceOutline, statsChart, statsChartOutline, trophy, trophyOutline } from "ionicons/icons";
import { goProduct, isDesignHost } from "@/lib/design-host";
import { dockScrollState } from "@/lib/tab-dock";
import { TAB_NAV } from "./nav";

// Ionic provides the expanded dock's buttons and selected state.
initialize({ mode: "ios" });
for (const define of [defineLabel, defineTabBar, defineTabButton, defineIcon]) define();

const ICON: Record<string, [string, string]> = {
  "/": [calendarOutline, calendar], "/props": [statsChartOutline, statsChart], "/fancy": [diceOutline, dice], "/leagues": [trophyOutline, trophy],
};

/**
 * The floating phone dock keeps a constant clearance in Shell as it collapses.
 */
export function IosTabBar() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  // Catalogue host is not a product route — never light a tab as selected (clicks still goProduct).
  const active = isDesignHost() ? undefined : TAB_NAV.find((t) => t.match(pathname));
  const current = active?.to ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const dock = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const open = (to: string) => isDesignHost() ? goProduct(to) : nav(to);

  function startSwipe(event: PointerEvent) {
    if (!event.isPrimary) return;
    suppressClick.current = false;
    if (event.pointerType !== "touch") return;
    touchStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function finishSwipe(event: PointerEvent) {
    const start = touchStart.current;
    if (start?.id !== event.pointerId) return;
    touchStart.current = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 36 || Math.abs(dx) <= Math.abs(dy)) return;
    suppressClick.current = true;
    const index = TAB_NAV.findIndex(({ to }) => to === current);
    const next = index >= 0 ? TAB_NAV[index + (dx < 0 ? 1 : -1)] : undefined;
    if (next) open(next.to);
  }

  useEffect(() => {
    const el = dock.current;
    if (!el) return;
    const sync = () => document.documentElement.style.setProperty("--phone-dock-h", `${el.offsetHeight}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--phone-dock-h"); };
  }, [pathname]);
  useEffect(() => {
    setCollapsed(false);
    if (!active) return;
    let checkpoint = Math.max(window.scrollY, 0);
    const onScroll = () => {
      const y = Math.max(window.scrollY, 0);
      const next = dockScrollState(y, checkpoint);
      if (next === undefined) return;
      setCollapsed(next);
      checkpoint = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [active, pathname]);

  const compact = collapsed && Boolean(active);
  return (
    <div ref={dock} className="phone-tab-dock fixed inset-x-0 bottom-0 z-60 lg:hidden" data-collapsed={compact}>
      <div className="phone-tab-dock-expanded" inert={compact}>
        <ion-tab-bar className="phone-tab-bar" selected-tab={current} aria-label="Sections"
          onPointerDown={startSwipe} onPointerUp={finishSwipe} onPointerCancel={() => { touchStart.current = null; }}
          onClickCapture={(event) => {
            if (!suppressClick.current || event.detail === 0) return;
            suppressClick.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}>
          {TAB_NAV.map(({ to, label }) => {
            const on = to === current, [outline, filled] = ICON[to] ?? ICON["/"];
            return (
              <ion-tab-button key={to} tab={to} selected={on} aria-current={on ? "page" : undefined} onClick={() => open(to)}>
                <ion-icon icon={on ? filled : outline} aria-hidden="true" />
                <ion-label>{label}</ion-label>
              </ion-tab-button>
            );
          })}
        </ion-tab-bar>
      </div>
      {active && (
        <button type="button" className="phone-tab-dock-compact" inert={!compact}
          aria-label={`Show navigation tabs, current section ${active.label}`} onClick={() => setCollapsed(false)}>
          <ion-icon icon={(ICON[active.to] ?? ICON["/"])[1]} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
