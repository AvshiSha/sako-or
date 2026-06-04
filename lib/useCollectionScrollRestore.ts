"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";
import {
  getCollectionState,
  saveCollectionStateOnLeave,
  setCollectionState,
  resolveBrowseScrollY,
  type CollectionBrowseSnapshot,
  type CollectionKey,
} from "@/lib/collectionBrowseStore";
import { usePathname } from "next/navigation";
import {
  COLLECTION_RETURN_EVENT,
  getRestoreScrollTarget,
  hasPendingCollectionScrollRestore,
  isCollectionScrollLocked,
  isOnCollectionPage,
  readFrozenCollectionScroll,
  resolveRestoreScrollY,
  runCollectionScrollRestore,
  unlockCollectionScrollWrites,
} from "@/lib/collectionScrollRestore";

type UseCollectionScrollRestoreParams = {
  browseKey: CollectionKey | undefined;
  itemCount: number;
  snapshotRef: RefObject<CollectionBrowseSnapshot | null>;
  persistDeps: readonly unknown[];
  browseListReady?: boolean;
};

export function useCollectionScrollRestore({
  browseKey,
  itemCount,
  snapshotRef,
  persistDeps,
  browseListReady = true,
}: UseCollectionScrollRestoreParams) {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const isRestoringRef = useRef(false);
  const restoreCompleteRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const collectionPathRef = useRef("");

  useEffect(() => {
    restoreCompleteRef.current = false;
    isRestoringRef.current = false;
  }, [browseKey]);

  useEffect(() => {
    if (!pathname || !/\/collection/.test(pathname) || /\/product\//.test(pathname)) {
      return;
    }
    collectionPathRef.current =
      window.location.pathname + window.location.search;
  }, [pathname]);

  const persistBrowseState = useCallback(
    (scrollYOverride?: number) => {
      if (!browseKey || isRestoringRef.current || !browseListReady) return;
      if (!isOnCollectionPage() || isCollectionScrollLocked()) return;
      const frozen = readFrozenCollectionScroll();
      const frozenY =
        frozen?.browseKey === browseKey ? frozen.scrollY : 0;
      if (
        frozenY > 0 &&
        scrollYOverride == null &&
        (hasPendingCollectionScrollRestore() ||
          window.scrollY < frozenY - 80)
      ) {
        return;
      }
      const snap = snapshotRef.current;
      if (!snap) return;

      const stored = getCollectionState(browseKey);
      const scrollY = Math.max(
        resolveBrowseScrollY(browseKey, scrollYOverride),
        frozenY
      );
      if (scrollY > 0) {
        lastScrollYRef.current = scrollY;
      }

      setCollectionState(browseKey, {
        useVariantItems: snap.useVariantItems,
        items: snap.items,
        currentPage: Math.max(snap.currentPage, stored?.currentPage ?? 1),
        totalProducts: Math.max(snap.totalProducts, stored?.totalProducts ?? 0),
        hasMore: snap.hasMore || !!stored?.hasMore,
        scrollY,
        updatedAt: Date.now(),
        anchorVariantKey: stored?.anchorVariantKey,
      });
    },
    [browseKey, snapshotRef, browseListReady]
  );

  useEffect(() => {
    if (!browseKey) return;

    const handlePageHide = () => {
      if (!isOnCollectionPage()) return;
      persistBrowseState(lastScrollYRef.current);
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [browseKey, persistBrowseState]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- persistDeps supplied by caller
  useEffect(() => {
    if (!browseKey || isRestoringRef.current || !browseListReady) return;
    persistBrowseState();
  }, [browseKey, persistBrowseState, browseListReady, ...persistDeps]);

  useEffect(() => {
    return () => {
      if (!browseKey) return;
      const snap = snapshotRef.current;
      if (!snap) return;
      saveCollectionStateOnLeave(
        browseKey,
        snap,
        lastScrollYRef.current,
        collectionPathRef.current || undefined
      );
    };
  }, [browseKey, snapshotRef]);

  const beginRestore = useCallback(() => {
    if (!browseKey || !browseListReady) return;

    const frozen = readFrozenCollectionScroll();
    const targetY = Math.max(
      resolveRestoreScrollY(),
      getRestoreScrollTarget(browseKey),
      getCollectionState(browseKey)?.scrollY ?? 0,
      frozen?.browseKey === browseKey ? frozen.scrollY : 0
    );

    if (targetY <= 0) return;

    restoreCompleteRef.current = false;
    isRestoringRef.current = true;
    lastScrollYRef.current = targetY;

    const anchorKey = getCollectionState(browseKey)?.anchorVariantKey;

    runCollectionScrollRestore(
      targetY,
      () => {
        isRestoringRef.current = false;
        restoreCompleteRef.current = true;
      },
      anchorKey
    );
  }, [browseKey, browseListReady]);

  useEffect(() => {
    if (!pathname) return;
    const prev = prevPathRef.current;
    const cameFromProduct =
      prev != null && /\/product\//.test(prev) && /\/collection/.test(pathname);
    prevPathRef.current = pathname;

    if (cameFromProduct) {
      unlockCollectionScrollWrites();
      restoreCompleteRef.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    const onReturn = () => {
      restoreCompleteRef.current = false;
      beginRestore();
    };
    window.addEventListener(COLLECTION_RETURN_EVENT, onReturn);
    return () => window.removeEventListener(COLLECTION_RETURN_EVENT, onReturn);
  }, [beginRestore]);

  useLayoutEffect(() => {
    if (!browseKey || !browseListReady) return;

    const targetY = Math.max(
      resolveRestoreScrollY(),
      getRestoreScrollTarget(browseKey),
      getCollectionState(browseKey)?.scrollY ?? 0
    );

    if (targetY <= 0) {
      return;
    }

    restoreCompleteRef.current = false;
    beginRestore();
  }, [browseKey, browseListReady, beginRestore]);

  // Re-apply only during an active browser-Back restore (not on load-more append).
  useEffect(() => {
    if (!browseKey || !browseListReady || itemCount === 0) return;
    if (!hasPendingCollectionScrollRestore()) return;

    const targetY = Math.max(
      getRestoreScrollTarget(browseKey),
      getCollectionState(browseKey)?.scrollY ?? 0
    );
    if (targetY <= 0) return;
    if (Math.abs(window.scrollY - targetY) <= 16) return;

    restoreCompleteRef.current = false;
    beginRestore();
  }, [itemCount, browseKey, browseListReady, beginRestore]);

  return { persistBrowseState, lastScrollYRef, beginRestore };
}
