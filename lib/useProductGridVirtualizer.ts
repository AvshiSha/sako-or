"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

export type ProductGridRow<T> = {
  key: string;
  items: T[];
  /** Flat index (into the original items array) of the first item in this row. */
  startIndex: number;
};

export type ProductGridVirtualRow = {
  key: string;
  index: number;
  /** px offset from the top of `containerRef`'s element — already adjusted for scrollMargin. */
  top: number;
};

type UseProductGridVirtualizerParams<T> = {
  items: readonly T[];
  columns: number;
  getItemKey: (item: T) => string;
  /**
   * Rough px height reserved below the card image for title/price/swatches
   * (an estimate only — actual row height is measured after mount).
   */
  extraRowHeightPx: number;
  /** Rough px vertical gap between rows, folded into the height estimate. */
  rowGapPx: number;
  overscan?: number;
};

/**
 * Row-chunks a flat product list into `columns`-wide rows and virtualizes those
 * rows against window scroll (@tanstack/react-virtual's useWindowVirtualizer) —
 * for grids where document/window is the scroll container, not an inner div.
 *
 * `getItemKey` should be a stable reference (e.g. a module-level function or one
 * wrapped in `useCallback` with no deps) — it's intentionally left out of the
 * row-chunking memo's dependency array.
 */
export function useProductGridVirtualizer<T>({
  items,
  columns,
  getItemKey,
  extraRowHeightPx,
  rowGapPx,
  overscan = 4,
}: UseProductGridVirtualizerParams<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setScrollMargin(el.offsetTop);
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const safeColumns = Math.max(1, columns);

  const rows = useMemo<ProductGridRow<T>[]>(() => {
    const result: ProductGridRow<T>[] = [];
    for (let i = 0; i < items.length; i += safeColumns) {
      const slice = items.slice(i, i + safeColumns);
      result.push({
        key: getItemKey(slice[0]),
        items: slice,
        startIndex: i,
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getItemKey identity intentionally excluded
  }, [items, safeColumns]);

  const estimateRowHeight = useCallback(() => {
    const cardWidth = containerWidth > 0 ? containerWidth / safeColumns : 200;
    return cardWidth + extraRowHeightPx + rowGapPx;
  }, [containerWidth, safeColumns, extraRowHeightPx, rowGapPx]);

  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: rows.length,
    estimateSize: estimateRowHeight,
    overscan,
    scrollMargin,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  const scrollToFlatIndex = useCallback(
    (flatIndex: number, align: "start" | "center" | "auto" = "start") => {
      const rowIndex = Math.floor(flatIndex / safeColumns);
      if (rowIndex < 0 || rowIndex >= rows.length) return;
      virtualizer.scrollToIndex(rowIndex, { align });
    },
    [virtualizer, rows.length, safeColumns]
  );

  // useWindowVirtualizer's item.start is in document/window scroll coordinates
  // (it bakes scrollMargin into the first item's start), but our rows render
  // inside a `position: relative` container that itself already sits at that
  // page offset — so the translateY used for absolute positioning must be
  // container-local, i.e. start minus scrollMargin. See virtual-core's
  // measurement code (`start = paddingStart + scrollMargin` for the first
  // item) and its own window-scrolling examples for this convention.
  const virtualItems: ProductGridVirtualRow[] = virtualizer
    .getVirtualItems()
    .map((item) => ({
      // getItemKey (below) always returns a string, so this is safe despite
      // virtual-core's wider `Key` type (string | number | bigint).
      key: String(item.key),
      index: item.index,
      top: item.start - scrollMargin,
    }));

  return {
    containerRef,
    rows,
    virtualItems,
    totalSize: virtualizer.getTotalSize(),
    measureElement: virtualizer.measureElement,
    scrollToFlatIndex,
  };
}
