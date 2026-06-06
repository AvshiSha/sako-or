/** Survives CollectionClient remount so loading can bridge client navigation. */
let filterNavPending = false;

export function markCollectionFilterNavPending(): void {
  filterNavPending = true;
}

export function takeCollectionFilterNavPending(): boolean {
  const pending = filterNavPending;
  filterNavPending = false;
  return pending;
}

export function clearCollectionFilterNavPending(): void {
  filterNavPending = false;
}
