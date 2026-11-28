/** Return a new dock state after enough vertical travel from the last checkpoint. */
export function dockScrollState(y: number, checkpoint: number): boolean | undefined {
  if (y <= 24) return checkpoint > 24 ? false : undefined;
  if (checkpoint - y >= 16) return false;
  if (y >= 80 && y - checkpoint >= 24) return true;
}
