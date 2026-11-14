import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import tokens from "@cricket/tokens/tokens.json";
import { Button } from "@/components/ui/button";
import { PillGroup } from "@/components/app/pill-group";
import { Muted } from "@/components/app/page";
import { PreviewFrame, DocPanel } from "@/components/design-system/example-stage";
import { cn } from "@/lib/utils";

const EASE = {
  "ease-out": [0.23, 1, 0.32, 1] as const,
  "ease-in-out": [0.77, 0, 0.175, 1] as const,
  "ease-drawer": [0.32, 0.72, 0, 1] as const,
};

/** Live demos of tokens.motion curves and the product selection spring. */
export function MotionDemos() {
  const reduce = useReducedMotion();
  const [enterKey, setEnterKey] = useState(0);
  const [toggle, setToggle] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [pill, setPill] = useState("t20");

  return (
    <>
      <Muted>Prefer ease-out for entrances. Selection uses spring 500 / 38. Motion skips when prefers-reduced-motion is on.</Muted>

      <div className="grid gap-snug sm:grid-cols-3">
        {Object.entries(tokens.motion).map(([k, v]) => (
          <div key={k} className="grid gap-hair rounded-xl border border-hairline bg-card px-inset py-snug">
            <code className="text-footnote text-muted-foreground">{k}</code>
            <p className="break-all text-callout">{String(v)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-12 md:grid-cols-2 md:gap-8">
        <PreviewFrame title="ease-out entrance" description="List and card enters: opacity + y, ~0.3s.">
          <div className="flex w-full flex-col gap-snug">
            <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => setEnterKey((n) => n + 1)}>Replay</Button>
            <div className="relative h-16 overflow-hidden rounded-md bg-background ring-1 ring-hairline">
              <motion.div
                key={enterKey}
                initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.3, ease: EASE["ease-out"] }}
                className="absolute inset-snug rounded-md bg-primary/80"
              />
            </div>
          </div>
        </PreviewFrame>

        <PreviewFrame title="ease-in-out toggle" description="Symmetric state changes.">
          <div className="flex w-full flex-col gap-snug">
            <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => setToggle((v) => !v)}>{toggle ? "Collapse" : "Expand"}</Button>
            <motion.div
              animate={{ width: toggle ? "100%" : "40%" }}
              transition={{ duration: reduce ? 0 : 0.35, ease: EASE["ease-in-out"] }}
              className="h-10 rounded-md bg-primary/80"
            />
          </div>
        </PreviewFrame>

        <PreviewFrame title="ease-drawer peek" description="Sheet / drawer style slide.">
          <div className="flex w-full flex-col gap-snug">
            <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => setDrawer((v) => !v)}>{drawer ? "Close" : "Open"}</Button>
            <div className="relative h-24 overflow-hidden rounded-md bg-background ring-1 ring-hairline">
              <motion.div
                animate={{ y: drawer ? 0 : reduce ? 0 : "70%" }}
                transition={{ duration: reduce ? 0 : 0.4, ease: EASE["ease-drawer"] }}
                className={cn("absolute inset-x-0 bottom-0 h-20 rounded-t-md bg-primary/80 p-snug text-callout font-label text-primary-foreground", reduce && !drawer && "opacity-40")}
              >
                Drawer panel
              </motion.div>
            </div>
          </div>
        </PreviewFrame>

        <PreviewFrame title="Selection spring" description="PillGroup layoutId thumb — stiffness 500, damping 38.">
          <PillGroup layoutId="ds-motion-pill" label="Format" value={pill} onChange={setPill} items={[["t20", "T20"], ["odi", "ODI"], ["test", "Test"]]} />
        </PreviewFrame>
      </div>

      <DocPanel id="product-timings" title="Product timings">
        <ul className="grid gap-tight text-callout text-muted-foreground">
          <li><code className="text-foreground">ease-out</code> · enter opacity/y · 0.3s · stagger ≤6 × 40ms</li>
          <li><code className="text-foreground">AnimatedHeight</code> · panel swap · 300ms · ease-out</li>
          <li><code className="text-foreground">PillGroup / PillTabs</code> · spring 500 / 38</li>
          <li>Under <code className="text-foreground">prefers-reduced-motion</code>: duration 0, keep opacity/comprehension</li>
        </ul>
      </DocPanel>
    </>
  );
}
