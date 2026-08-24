"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cancelCollectionScrollRestoreWatchdog } from "@/lib/collectionScrollRestore";

/** A pathname change this soon after a popstate is a Back/Forward navigation. */
const POP_NAVIGATION_WINDOW_MS = 250;

/**
 * Guarantees a newly opened product page starts at the top.
 *
 * ProductCard's <Link scroll> already does this, so this is a fallback for the
 * ways the router alone is not enough:
 *
 *  - a collection scroll restore (lib/collectionScrollRestore.ts) whose rAF
 *    loop is still running when the user clicks a card would otherwise keep
 *    ticking across the soft navigation and drag this page to the collection's
 *    offset. Cancelling only stops the loop - the saved record survives, so
 *    Back still restores the collection precisely.
 *  - colour switching on the page itself (ProductColorClient's router.push).
 *
 * Arriving at a product page always goes to the top - including via Forward,
 * which is a fresh arrival at a page the user expects to read from the start.
 * Only a Back/Forward that moves between products *while this component stays
 * mounted* is left alone, so the browser's history behaviour is untouched.
 * A hash deep link is always left alone.
 */
export default function ProductScrollReset() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);
  const lastPopAtRef = useRef(0);

  useLayoutEffect(() => {
    const onPopState = () => {
      lastPopAtRef.current = Date.now();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useLayoutEffect(() => {
    if (lastPathRef.current === pathname) return;
    const isArrival = lastPathRef.current === null;
    lastPathRef.current = pathname;

    // Moving between products under a history navigation keeps whatever
    // position that entry had. An arrival is never skipped, or a Forward back
    // into a product page would inherit the listing's offset.
    if (!isArrival && Date.now() - lastPopAtRef.current < POP_NAVIGATION_WINDOW_MS) return;
    // A deep link to a section wins over the top of the page.
    if (window.location.hash) return;

    cancelCollectionScrollRestoreWatchdog();

    if (window.scrollY !== 0) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    // One re-apply after the first frame, in case late layout (breadcrumbs,
    // the LCP image) moved us. Any real user input cancels it, so this can
    // never fight someone who has already started scrolling.
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    for (const event of events) {
      window.addEventListener(event, cancel, { passive: true, once: true });
    }

    const rafId = requestAnimationFrame(() => {
      if (!cancelled && window.scrollY !== 0) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
      for (const event of events) {
        window.removeEventListener(event, cancel);
      }
    };
  }, [pathname]);

  return null;
}
