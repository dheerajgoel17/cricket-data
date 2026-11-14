import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { initialize } from "@ionic/core/components";
import { defineCustomElement as defineLabel } from "@ionic/core/components/ion-label.js";
import { defineCustomElement as defineTabBar } from "@ionic/core/components/ion-tab-bar.js";
import { defineCustomElement as defineTabButton } from "@ionic/core/components/ion-tab-button.js";
import { defineCustomElement as defineIcon } from "ionicons/components/ion-icon.js";
import { bookmark, bookmarkOutline, calendar, calendarOutline, dice, diceOutline, mail, mailOutline, statsChart, statsChartOutline, trophy, trophyOutline } from "ionicons/icons";
import { AdSlot } from "@/components/app/ad-slot";
import { slotForPath } from "@/lib/ad-slots";
import { goProduct, isDesignHost } from "@/lib/design-host";
import { TAB_NAV } from "./nav";

// Ionic's own iOS tab bar (web components, MIT), not a copy of it: the classic iOS bar, translucent with the hairline on top, 49 pt plus the safe area,
// icon and label stacked, the selected tab tinted. Forced to the iOS look whatever the phone is (Android would otherwise get the Material bar).
initialize({ mode: "ios" });
for (const define of [defineLabel, defineTabBar, defineTabButton, defineIcon]) define();

const ICON: Record<string, [string, string]> = {
  "/": [calendarOutline, calendar], "/props": [statsChartOutline, statsChart], "/fancy": [diceOutline, dice], "/leagues": [trophyOutline, trophy], "/saved": [bookmarkOutline, bookmark], "/contact": [mailOutline, mail],
};

/**
 * Phones and tablets (below lg). Fixed dock: optional catalogue ad above the tab bar when the path has a slot,
 * then the Ionic tab bar. Height is written to `--phone-dock-h` so Shell can clear it (empty ads reserve nothing).
 */
export function IosTabBar() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  // Catalogue host is not a product route — never light a tab as selected (clicks still goProduct).
  const current = isDesignHost() ? "" : (TAB_NAV.find((t) => t.match(pathname))?.to ?? "");
  const slot = slotForPath(pathname);
  const dock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = dock.current;
    if (!el) return;
    const sync = () => document.documentElement.style.setProperty("--phone-dock-h", `${el.offsetHeight}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--phone-dock-h"); };
  }, [pathname, slot]);
  return (
    <div ref={dock} className="fixed inset-x-0 bottom-0 z-60 lg:hidden">
      {slot && <AdSlot slotId={slot} className="mx-0 border-b-0 border-t border-hairline bg-background" />}
      <ion-tab-bar translucent selected-tab={current} aria-label="Sections">
        {TAB_NAV.map(({ to, label }) => {
          const on = to === current, [outline, filled] = ICON[to] ?? ICON["/"];
          return (
            <ion-tab-button key={to} tab={to} selected={on} aria-current={on ? "page" : undefined} onClick={() => (isDesignHost() ? goProduct(to) : nav(to))}>
              <ion-icon icon={on ? filled : outline} aria-hidden="true" />
              <ion-label>{label}</ion-label>
            </ion-tab-button>
          );
        })}
      </ion-tab-bar>
    </div>
  );
}
