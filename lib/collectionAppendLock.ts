/** Blocks browser-back scroll restore while load-more is appending. */
let appendLockCount = 0;

export function lockCollectionAppend(): void {
  appendLockCount += 1;
}

export function unlockCollectionAppend(): void {
  appendLockCount = Math.max(0, appendLockCount - 1);
}

export function isCollectionAppendLocked(): boolean {
  return appendLockCount > 0;
}
