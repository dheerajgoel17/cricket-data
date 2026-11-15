import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A horizontally scrolling row (active-filter chips, tabs): content runs edge to edge with no fade at the sides. Twin of the app's `HScroll`. */
export function ScrollRow({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)} {...rest} />;
}
