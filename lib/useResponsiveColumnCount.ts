"use client";

import { useEffect, useState } from "react";

export type ColumnBreakpoint = {
  minWidthPx: number;
  columns: number;
};

/**
 * Tracks the active column count for a mobile-first set of min-width breakpoints,
 * mirroring Tailwind's responsive `grid-cols-*` classes so JS-side row-chunking
 * (for grid virtualization) stays in sync with the CSS grid it mirrors.
 *
 * `breakpoints` must be a stable (module-level) reference — it's only read once,
 * inside the effect, not tracked as a dependency.
 */
export function useResponsiveColumnCount(
  breakpoints: readonly ColumnBreakpoint[]
): number {
  const sorted = [...breakpoints].sort((a, b) => a.minWidthPx - b.minWidthPx);
  const fallback = sorted[0]?.columns ?? 1;

  const [columns, setColumns] = useState(fallback);

  useEffect(() => {
    if (typeof window === "undefined" || sorted.length === 0) return;

    const queries = sorted.map((bp) =>
      bp.minWidthPx > 0 ? window.matchMedia(`(min-width: ${bp.minWidthPx}px)`) : null
    );

    const resolve = () => {
      let active = sorted[0].columns;
      for (let i = 0; i < sorted.length; i++) {
        const mq = queries[i];
        if (mq === null || mq.matches) {
          active = sorted[i].columns;
        }
      }
      setColumns(active);
    };

    resolve();

    queries.forEach((mq) => mq?.addEventListener("change", resolve));
    return () => {
      queries.forEach((mq) => mq?.removeEventListener("change", resolve));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- breakpoints is a stable module-level reference
  }, []);

  return columns;
}
