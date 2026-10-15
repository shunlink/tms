// Process-wide counter bumped on every DB write that changes rows.
// Work-queue caches (dashboard KPIs, sidebar badges) include it in their keys so
// any mutation invalidates them; the TTL only bounds staleness across instances.

const store = globalThis as unknown as { __tmsDataVersion?: number };

export function bumpDataVersion() {
  store.__tmsDataVersion = (store.__tmsDataVersion ?? 0) + 1;
}

export function dataVersion(): number {
  return store.__tmsDataVersion ?? 0;
}
