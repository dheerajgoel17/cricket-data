import { ComputerDesktopIcon, MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { useTheme } from "./ThemeProvider";
import type { ThemePref } from "@/lib/theme";

const NEXT: Record<ThemePref, ThemePref> = { light: "dark", dark: "light", system: "light" };

/** Header control: tap cycles light ↔ dark (system is in the profile menu). Icon shows what tapping will switch to. */
export function ThemeToggle() {
  const { pref, resolved, setPref } = useTheme();
  const toLight = resolved === "dark";
  return (
    <button type="button" aria-label={toLight ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setPref(pref === "system" ? (toLight ? "light" : "dark") : NEXT[pref])}
      className="grid size-control place-items-center rounded-full bg-primary-foreground/15 text-primary-foreground transition hover:bg-primary-foreground/25">
      {toLight ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </button>
  );
}

export function ThemeRadios() {
  const { pref, setPref } = useTheme();
  const Item = ({ value, icon: Icon, label }: { value: ThemePref; icon: typeof SunIcon; label: string }) => (
    <button type="button" role="radio" aria-checked={pref === value} onClick={() => setPref(value)}
      className="flex w-full items-center gap-snug rounded-sm px-snug py-tight text-callout outline-none hover:bg-accent hover:text-accent-foreground">
      <Icon className="size-4 text-muted-foreground" />
      <span>{label}</span>
      {pref === value ? <span className="ml-auto size-1.5 rounded-full bg-primary" /> : null}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Appearance" className="flex flex-col">
      <Item value="light" icon={SunIcon} label="Light" />
      <Item value="dark" icon={MoonIcon} label="Dark" />
      <Item value="system" icon={ComputerDesktopIcon} label="System" />
    </div>
  );
}
