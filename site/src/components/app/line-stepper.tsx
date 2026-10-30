import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText } from "@/components/ui/input-group";

/** shadcn InputGroup stepper: minus, the line, plus. Same control on the player, fixture and fancy pages. */
export function LineStepper({ value, onStep, label, min = 0.5 }: { value: number; onStep: (delta: number) => void; label: string; min?: number }) {
  return (
    <InputGroup className="h-control w-fit rounded-[var(--chip-radius)] border-0 bg-card shadow-none dark:bg-card">
      <InputGroupAddon>
        <InputGroupButton size="icon-sm" aria-label="Lower the line" disabled={value <= min} onClick={() => onStep(-0.5)}><MinusIcon /></InputGroupButton>
      </InputGroupAddon>
      <InputGroupText className="min-w-20 justify-center text-callout font-semibold tabular-nums text-foreground">{label} {value}</InputGroupText>
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-sm" aria-label="Raise the line" onClick={() => onStep(0.5)}><PlusIcon /></InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
