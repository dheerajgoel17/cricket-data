import { type ReactNode } from "react";
import { motion } from "motion/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * shadcn Tabs in the props.cash pill style (40px pills): the selected pill is a shared-layout Motion element that slides between tabs.
 * `children` are the TabsContent panels. Use `scrollable` for a long rail (the stat rail on the player page).
 */
export function PillTabs({ tabs, value, onChange, layoutId, scrollable, className, listClassName, children }: {
  tabs: [string, ReactNode][]; value: string; onChange: (v: string) => void; layoutId: string; scrollable?: boolean; className?: string; listClassName?: string; children?: ReactNode;
}) {
  return (
    <Tabs value={value} onValueChange={onChange} className={cn("gap-3", className)}>
      <TabsList className={cn("h-auto w-full justify-start gap-1 rounded-none bg-transparent p-0", scrollable ? "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex-wrap", listClassName)}>
        {tabs.map(([id, label]) => (
          <TabsTrigger key={id} value={id} className="relative h-10 flex-none rounded-full border-0 px-4 text-[15px] font-medium text-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
            {value === id && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
