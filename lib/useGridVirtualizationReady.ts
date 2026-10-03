"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and through the first client render; true from just after
 * hydration.
 *
 * Gates grid virtualization on the two listings. `useWindowVirtualizer` has no
 * viewport to measure during SSR and reports an empty window there, so a grid
 * that is virtualized from the first render ships a container with a height and
 * no cards inside it — the page's <h1> and filter bar reach a crawler, and not
 * one product link does. Rendering the full list until this flips puts the real
 * cards, their names, prices and hrefs in the server HTML, and hands the window
 * back to the virtualizer a frame later.
 *
 * Returning to the top of the render (rather than inside the virtualizer) keeps
 * the swap honest about when it happens: at mount, with the page at its initial
 * scroll offset, so no row above the viewport is re-measured underneath the
 * user. See estimateCollectionRowHeight for the other half of that guarantee.
 */
export function useGridVirtualizationReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return ready;
}
