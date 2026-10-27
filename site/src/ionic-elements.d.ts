import type { DetailedHTMLProps, HTMLAttributes } from "react";

// Ionic's web components as JSX elements (React 19 passes properties to custom elements that have them, attributes otherwise).
type El = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>;
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "ion-tab-bar": El;
      "ion-tab-button": El;
      "ion-icon": El;
      "ion-label": El;
    }
  }
}
