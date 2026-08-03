"use client";

import { useEffect } from "react";
import { snapshotBeforeLeavingForProduct } from "@/lib/collectionScrollRestore";

function isBrowsePath(pathname: string): boolean {
  return /\/collection/.test(pathname) && !/\/product\//.test(pathname);
}

/**
 * Stays mounted across collection <-> product navigation (rendered once in
 * the locale layout). Two jobs only:
 *
 *  1. Disable the browser's own automatic scroll restoration so it never
 *     fights the app's manual restore (lib/collectionScrollRestore.ts).
 *  2. A fallback snapshot-before-leaving for any `/product/` link that isn't
 *     rendered by ProductCard (which already snapshots more precisely, with
 *     an anchor card, on its own pointerdown/click handlers) — e.g. a "view
 *     full details" link inside QuickBuyDrawer. Harmless no-op if
 *     ProductCard's own handler already ran for this click.
 */
export default function CollectionScrollBridge() {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const onClickCapture = (event: MouseEvent) => {
      if (!isBrowsePath(window.location.pathname)) return;
      if (event.button !== 0) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (!anchor.href.includes("/product/")) return;

      const browseKey = document
        .querySelector("[data-collection-browse-key]")
        ?.getAttribute("data-collection-browse-key");
      if (!browseKey) return;

      snapshotBeforeLeavingForProduct(browseKey);
    };

    document.addEventListener("click", onClickCapture, true);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return null;
}
