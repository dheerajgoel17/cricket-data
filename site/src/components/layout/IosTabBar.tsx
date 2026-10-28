import { useLocation, useNavigate } from "react-router-dom";
import { initialize } from "@ionic/core/components";
import { defineCustomElement as defineLabel } from "@ionic/core/components/ion-label.js";
import { defineCustomElement as defineTabBar } from "@ionic/core/components/ion-tab-bar.js";
import { defineCustomElement as defineTabButton } from "@ionic/core/components/ion-tab-button.js";
import { defineCustomElement as defineIcon } from "ionicons/components/ion-icon.js";
import { calendar, calendarOutline, person, personOutline } from "ionicons/icons";
import { TAB_NAV } from "./nav";

// Ionic's own iOS tab bar (web components, MIT), not a copy of it: the classic iOS bar, translucent with the hairline on top, 49 pt plus the safe area,
// icon and label stacked, the selected tab tinted. Forced to the iOS look whatever the phone is (Android would otherwise get the Material bar).
initialize({ mode: "ios" });
for (const define of [defineLabel, defineTabBar, defineTabButton, defineIcon]) define();

const ICON: Record<string, [string, string]> = {
  "/": [calendarOutline, calendar], "/players": [personOutline, person],
};

/** Phones only. Fixed to the bottom; the page keeps clear of it with `--tabbar-h` (see Shell). */
export function IosTabBar() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const current = TAB_NAV.find((t) => t.match(pathname))?.to ?? "";
  return (
    <div className="fixed inset-x-0 bottom-0 z-60 md:hidden">
      <ion-tab-bar translucent selected-tab={current} aria-label="Sections">
        {TAB_NAV.map(({ to, label }) => {
          const on = to === current, [outline, filled] = ICON[to] ?? ICON["/"];
          return (
            <ion-tab-button key={to} tab={to} selected={on} aria-current={on ? "page" : undefined} onClick={() => nav(to)}>
              <ion-icon icon={on ? filled : outline} aria-hidden="true" />
              <ion-label>{label}</ion-label>
            </ion-tab-button>
          );
        })}
      </ion-tab-bar>
    </div>
  );
}
