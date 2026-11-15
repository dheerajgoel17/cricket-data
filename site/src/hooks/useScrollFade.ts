import { useEffect, type RefObject } from "react";

/**
 * Edge fade for a horizontally scrolling row (chips, tabs): sets `--fl` / `--fr` on the element as it scrolls (0 at the start / end, the fade width elsewhere), which the `scroll-fade-x`
 * mask in `index.css` reads. A mask, not a blur (cheap), and the app twin is `mobile/src/ui/h-scroll.tsx`. Re-measures when the row resizes.
 */
export function useScrollFade(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => {
      const max = el.scrollWidth - el.clientWidth;
      el.style.setProperty("--fl", el.scrollLeft > 1 ? "1.5rem" : "0px");
      el.style.setProperty("--fr", max > 1 && el.scrollLeft < max - 1 ? "1.5rem" : "0px");
    };
    set();
    el.addEventListener("scroll", set, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(set);
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", set); ro?.disconnect(); };
  }, [ref]);
}
