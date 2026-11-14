import { type ReactNode } from "react";
import { motion } from "motion/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Section tabs with a sliding Motions pill (league / team markets). Allowed twin of `PillGroup` for
 * TabsContent panels; filter chips still use PillGroup. See docs/DESIGN_SYSTEM.md.
 */
export function PillTabs({ tabs, value, onChange, layoutId, scrollable, className, listClassName, children }: {
  tabs: [string, ReactNode][]; value: string; onChange: (v: string) => void; layoutId: string; scrollable?: boolean; className?: string; listClassName?: string; children?: ReactNode;
}) {
  return (
    <Tabs value={value} onValueChange={onChange} className={cn("gap-stack", className)}>
      <TabsList className={cn("h-auto w-full justify-start gap-hair rounded-none bg-transparent p-0", scrollable ? "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex-wrap", listClassName)}>
        {tabs.map(([id, label]) => (
          <TabsTrigger key={id} value={id} className="relative h-control flex-none rounded-full border-0 px-inset text-body font-label text-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
            {value === id && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
