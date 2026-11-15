import { useRef, type ComponentProps } from "react";
import { useScrollFade } from "@/hooks/useScrollFade";
import { cn } from "@/lib/utils";

/** A horizontally scrolling row (active-filter chips, tabs) whose content fades at an edge that has more behind it. Twin of the app's `HScroll`. */
export function ScrollRow({ className, ...rest }: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollFade(ref);
  return <div ref={ref} className={cn("scroll-fade-x overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)} {...rest} />;
}
