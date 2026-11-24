import { type ReactNode } from "react";
import { motion } from "motion/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Section tabs: the same underlined row as `PillGroup sub` (text, primary underline that slides, hairline under the row) so a team / league page reads like the fixture page (league / team markets). Allowed twin of `PillGroup` for
 * TabsContent panels; filter chips still use PillGroup. See docs/DESIGN_SYSTEM.md.
 */
export function PillTabs({ tabs, value, onChange, layoutId, scrollable, className, listClassName, children }: {
  tabs: [string, ReactNode][]; value: string; onChange: (v: string) => void; layoutId: string; scrollable?: boolean; className?: string; listClassName?: string; children?: ReactNode;
}) {
  return (
    <Tabs value={value} onValueChange={onChange} className={cn("gap-snug", className)}>
      <div className="-mx-gutter border-b border-hairline px-gutter">
        <TabsList className={cn("h-auto w-full justify-start gap-stack rounded-none bg-transparent p-0", scrollable ? "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex-wrap", listClassName)}>
          {tabs.map(([id, label]) => (
            <TabsTrigger key={id} value={id} className="relative h-auto flex-none rounded-none border-0 bg-transparent px-0 py-snug text-callout font-label text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
              {value === id && <motion.span layoutId={layoutId} aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className="relative">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}
