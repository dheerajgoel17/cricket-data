/**
 * Keeps list rows referentially stable across the live poll. A row's own data (`r`) comes from the scored history and does not change on a score tick; only what is layered onto it
 * (`live`, `out`) can. `makeStabilizer()` returns a function that re-uses the previous object for a row whose layered values are shallow-equal, and re-uses the whole previous array when
 * every row is unchanged, so a `PropRow` memo, a `useMemo` over the rows and FlashList's diff all see "nothing happened" on a tick that changed nothing for them.
 */
export function makeStabilizer<R extends object, X extends Record<string, unknown>>() {
  const cache = new WeakMap<R, { x: X; row: R & X }>();
  let last: (R & X)[] = [];
  return (rows: readonly R[], layer: (r: R) => X): (R & X)[] => {
    const next = rows.map((r) => {
      const x = layer(r);
      const c = cache.get(r);
      if (c && shallowEqual(c.x, x)) return c.row;
      const row = { ...r, ...x };
      cache.set(r, { x, row });
      return row;
    });
    if (next.length === last.length && next.every((r, i) => r === last[i])) return last;
    last = next;
    return next;
  };
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}
