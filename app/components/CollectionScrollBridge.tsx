"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  cancelCollectionScrollRestoreWatchdog,
  freezeCollectionScrollForBack,
  isCollectionScrollLocked,
  isOnCollectionPage,
  lockCollectionScrollWrites,
  readLastCollectionScroll,
  saveLastCollectionScroll,
  scheduleCollectionScrollRestoreBurst,
  unlockCollectionScrollWrites,
} from "@/lib/collectionScrollRestore";
import { persistCollectionScroll } from "@/lib/collectionBrowseStore";

function isProductPath(pathname: string): boolean {
  return /\/product\//.test(pathname);
}

function isBrowsePath(pathname: string): boolean {
  return /\/collection/.test(pathname) && !isProductPath(pathname);
}

/**
 * Stays mounted across collection <-> product navigation.
 * Browser Back is handled primarily via popstate + history.state.
 */
export default function CollectionScrollBridge() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const onPopState = (event: PopStateEvent) => {
      requestAnimationFrame(() => {
        scheduleCollectionScrollRestoreBurst(event);
      });
    };

    const onPageShow = () => {
      if (!isBrowsePath(window.location.pathname)) return;
      requestAnimationFrame(() => {
        scheduleCollectionScrollRestoreBurst();
      });
    };

    const saveScrollBeforeProductNav = (event: MouseEvent) => {
      if (!isBrowsePath(window.location.pathname)) return;
      if (event.button !== 0) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (!anchor.href.includes("/product/")) return;

      const y = window.scrollY;
      const browseKey =
        document
          .querySelector("[data-collection-browse-key]")
          ?.getAttribute("data-collection-browse-key") ??
        readLastCollectionScroll()?.browseKey;

      if (!browseKey) return;

      const scrollY =
        y > 0 ? y : readLastCollectionScroll()?.scrollY ?? 0;
      const collectionPath = window.location.pathname + window.location.search;
      if (scrollY > 0) {
        freezeCollectionScrollForBack(browseKey, scrollY, collectionPath);
        persistCollectionScroll(browseKey);
      }
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("click", saveScrollBeforeProductNav, true);

    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("click", saveScrollBeforeProductNav, true);
    };
  }, []);

  useEffect(() => {
    if (!pathname || !isBrowsePath(pathname)) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;
    const handleCollectionScroll = () => {
      if (isCollectionScrollLocked()) return;
      if (!isOnCollectionPage()) return;
      if (!isBrowsePath(pathname)) return;

      const browseKey = document
        .querySelector("[data-collection-browse-key]")
        ?.getAttribute("data-collection-browse-key");
      if (!browseKey) return;

      const y = window.scrollY;
      if (y <= 0) return;

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (isCollectionScrollLocked() || !isOnCollectionPage()) return;
        const path = window.location.pathname + window.location.search;
        saveLastCollectionScroll(browseKey, y, path);
      }, 100);
    };

    window.addEventListener("scroll", handleCollectionScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleCollectionScroll);
      clearTimeout(scrollTimeout);
    };
  }, [pathname]);

  useEffect(() => {
    if (!pathname) return;

    const prev = prevPathRef.current;
    const cameFromProduct =
      prev != null && isProductPath(prev) && isBrowsePath(pathname);

    const leftForProduct =
      prev != null && isBrowsePath(prev) && isProductPath(pathname);
    if (leftForProduct) {
      cancelCollectionScrollRestoreWatchdog();
      lockCollectionScrollWrites();
    }

    if (cameFromProduct) {
      unlockCollectionScrollWrites();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scheduleCollectionScrollRestoreBurst();
        });
      });
    }

    prevPathRef.current = pathname;
  }, [pathname]);

  return null;
}
