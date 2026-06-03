"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  getCollectionState,
  saveCollectionStateOnLeave,
  setCollectionState,
  resolveBrowseScrollY,
  type CollectionBrowseSnapshot,
  type CollectionKey,
} from "@/lib/collectionBrowseStore";

const RESTORE_MAX_ATTEMPTS = 15;

type UseCollectionScrollRestoreParams = {
  browseKey: CollectionKey | undefined;
  /** Number of grid items rendered; restore waits until > 0. */
  itemCount: number;
  snapshotRef: RefObject<CollectionBrowseSnapshot | null>;
  /** When these change, persist full browse state (skipped while restoring). */
  persistDeps: readonly unknown[];
};

export function useCollectionScrollRestore({
  browseKey,
  itemCount,
  snapshotRef,
  persistDeps,
}: UseCollectionScrollRestoreParams) {
  const isRestoringRef = useRef(false);
  const scrollRestoredRef = useRef(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  const persistBrowseState = useCallback(
    (scrollYOverride?: number) => {
      if (!browseKey || isRestoringRef.current) return;
      const snap = snapshotRef.current;
      if (!snap) return;
      const scrollY = resolveBrowseScrollY(browseKey, scrollYOverride);
      if (scrollY > 0) lastScrollYRef.current = scrollY;
      setCollectionState(browseKey, {
        ...snap,
        scrollY,
        updatedAt: Date.now(),
      });
    },
    [browseKey, snapshotRef]
  );

  useEffect(() => {
    if (!browseKey) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      if (isRestoringRef.current) return;
      const y = window.scrollY;
      if (y > 0) lastScrollYRef.current = y;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        persistBrowseState(y);
      }, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [browseKey, persistBrowseState]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- persistDeps supplied by caller
  useEffect(() => {
    if (!browseKey || isRestoringRef.current) return;
    persistBrowseState();
  }, [browseKey, persistBrowseState, ...persistDeps]);

  useEffect(() => {
    return () => {
      if (!browseKey) return;
      const snap = snapshotRef.current;
      if (!snap) return;
      saveCollectionStateOnLeave(
        browseKey,
        snap,
        lastScrollYRef.current
      );
    };
  }, [browseKey, snapshotRef]);

  useEffect(() => {
    if (!browseKey || scrollRestoredRef.current) return;

    const stored = getCollectionState(browseKey);
    if (!stored || stored.scrollY <= 0) {
      scrollRestoredRef.current = true;
      return;
    }

    if (itemCount === 0) return;

    const targetY = stored.scrollY;
    isRestoringRef.current = true;
    scrollRestoredRef.current = true;
    lastScrollYRef.current = targetY;

    let attempts = 0;
    const tryRestore = () => {
      window.scrollTo({ top: targetY, left: 0, behavior: "auto" });
      attempts += 1;
      const tallEnough =
        document.documentElement.scrollHeight >=
        targetY + window.innerHeight * 0.5;
      if (tallEnough || attempts >= RESTORE_MAX_ATTEMPTS) {
        isRestoringRef.current = false;
        lastScrollYRef.current = targetY;
        return;
      }
      requestAnimationFrame(tryRestore);
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(tryRestore);
    });
  }, [browseKey, itemCount]);

  return { persistBrowseState, lastScrollYRef };
}
