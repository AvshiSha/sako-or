"use client";

import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { hasPendingCollectionScrollRestore } from "@/lib/collectionScrollRestore";

const COOLDOWN_MS = 400;

type UseCollectionInfiniteScrollParams = {
  hasMore: boolean;
  browseListReady: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => Promise<void>;
  /** When this changes (e.g. filter/collection key), re-arm is reset. */
  resetKey?: string;
};

/**
 * Observes a sentinel near the viewport bottom and triggers load-more.
 * A new page loads only after the sentinel has left the viewport at least once
 * since the previous load — prevents chained requests while the sentinel stays
 * in view (e.g. short first page or large rootMargin).
 */
export function useCollectionInfiniteScroll({
  hasMore,
  browseListReady,
  isLoadingMore,
  onLoadMore,
  resetKey,
}: UseCollectionInfiniteScrollParams) {
  const cooldownUntilRef = useRef(0);
  const inFlightRef = useRef(false);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  /** True after sentinel leaves view; consumed on next in-view entry. */
  const armedRef = useRef(false);

  const skip =
    !hasMore ||
    !browseListReady ||
    isLoadingMore ||
    hasPendingCollectionScrollRestore();

  const { ref: sentinelRef, inView } = useInView({
    rootMargin: "0px 0px 200px 0px",
    threshold: 0,
    skip,
  });

  useEffect(() => {
    armedRef.current = false;
  }, [resetKey]);

  // Re-arm only when the sentinel is not intersecting (user scrolled up or content grew past it).
  useEffect(() => {
    if (!inView) {
      armedRef.current = true;
    }
  }, [inView]);

  useEffect(() => {
    if (!inView || skip || !armedRef.current) return;
    if (inFlightRef.current) return;
    if (Date.now() < cooldownUntilRef.current) return;

    armedRef.current = false;
    inFlightRef.current = true;
    void onLoadMoreRef
      .current()
      .catch(() => {})
      .finally(() => {
        inFlightRef.current = false;
        cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
      });
  }, [inView, skip]);

  return { sentinelRef };
}
