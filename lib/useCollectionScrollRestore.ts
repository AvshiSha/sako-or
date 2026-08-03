"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  saveCollectionStateOnLeave,
  type CollectionBrowseSnapshot,
  type CollectionKey,
} from "@/lib/collectionBrowseStore";
import {
  beginCollectionScrollRestore,
  cancelCollectionScrollRestoreWatchdog,
  dispatchCollectionBrowseReturn,
} from "@/lib/collectionScrollRestore";

type UseCollectionScrollRestoreParams = {
  browseKey: CollectionKey | undefined;
  itemCount: number;
  snapshotRef: RefObject<CollectionBrowseSnapshot | null>;
  browseListReady?: boolean;
  /** Unused — kept so existing call sites don't need updating. */
  persistDeps?: readonly unknown[];
};

/**
 * Starts the single, re-entrancy-guarded scroll restore once the caller's
 * item list is ready (browseListReady + itemCount > 0). The caller owns
 * hydrating its own item/page state from cache before that point — this
 * hook only ever moves the scrollbar, and persists the latest item/page
 * snapshot on unmount so any departure (not just a ProductCard click) keeps
 * the list restorable next time.
 */
export function useCollectionScrollRestore({
  browseKey,
  itemCount,
  snapshotRef,
  browseListReady = true,
}: UseCollectionScrollRestoreParams) {
  const startedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (browseKey && startedForRef.current !== browseKey) {
      startedForRef.current = null;
    }
  }, [browseKey]);

  useEffect(() => {
    if (!browseKey || !browseListReady || itemCount === 0) return;
    if (startedForRef.current === browseKey) return;

    startedForRef.current = browseKey;
    beginCollectionScrollRestore(browseKey, dispatchCollectionBrowseReturn);
  }, [browseKey, browseListReady, itemCount]);

  useEffect(() => {
    return () => {
      if (!browseKey) return;
      // Intentionally read at cleanup (unmount) time, not effect-run time, so
      // this captures the latest item/page state right up to the moment the
      // user navigates away.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const snap = snapshotRef.current;
      if (!snap) return;
      saveCollectionStateOnLeave(browseKey, snap);
    };
  }, [browseKey, snapshotRef]);

  useEffect(() => {
    return () => cancelCollectionScrollRestoreWatchdog();
  }, []);
}
