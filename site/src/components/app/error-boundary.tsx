import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** A page that throws (or whose script is gone after a deploy) shows a way back instead of a blank screen; a script that is gone reloads once by itself, since the new deploy has it. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error, _info: ErrorInfo) { if (/dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(String(e?.message))) reloadOnce(); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-[50svh] flex-col items-center justify-center gap-stack p-inset text-center">
        <p className="text-body font-semibold">This page did not load.</p>
        <p className="text-callout text-muted-foreground">The site was probably updated while it was open.</p>
        <Button onClick={() => location.reload()}>Reload</Button>
      </div>
    );
  }
}

/** Reload the page once (a second failure in the same tab is left for the boundary to show). */
export function reloadOnce() {
  try {
    if (sessionStorage.getItem("reloaded-after-deploy")) return;
    sessionStorage.setItem("reloaded-after-deploy", "1");
  } catch { /* storage blocked: reload anyway */ }
  location.reload();
}
