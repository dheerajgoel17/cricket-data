/**
 * A request that must not turn one failed attempt into an hour of "nothing": on success the fresh answer; on failure the copy kept from an earlier launch when there is one, else the error
 * itself (so the query is retried and the empty answer is never cached as if it were data). Used for the photos file, where a swallowed failure used to hide every picture for an hour.
 */
export async function withKeptFallback<T>(fetch: () => Promise<T>, kept: () => T | undefined): Promise<T> {
  try {
    return await fetch();
  } catch (e) {
    const old = kept();
    if (old !== undefined && old !== null) return old;
    throw e;
  }
}
