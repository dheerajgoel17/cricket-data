import { HOME_PHASES, type HomePhase } from "@site/lib/home-phase";
import { LineTabs } from "@/ui/line-tabs";

/**
 * Home's phase tabs: In play / Pre-match / Completed underline tabs with how many matches each holds (the site's `HomePhaseBar`).
 * A full-width strip under the header, as on the site's phone Home: line tabs sitting on a hairline, the chosen one in the accent colour.
 */
export function PhaseBar({ value, counts, onChange }: { value: HomePhase; counts: Record<HomePhase, number>; onChange: (p: HomePhase) => void }) {
  return (
    <LineTabs<HomePhase>
      label="In play, pre-match or completed"
      items={HOME_PHASES.map(([id, label]) => [id, label, counts[id]] as [HomePhase, string, number])}
      value={value}
      onChange={onChange}
    />
  );
}
