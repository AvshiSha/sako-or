/**
 * Collection scroll restoration for browser Back.
 * Uses both sessionStorage and history.state on the collection history entry
 * (browser back restores history.state — more reliable than React effects alone).
 */

const LAST_SCROLL_KEY = "collection_last_scroll_v1";
/** Locked when leaving for PDP — never updated from product-page scroll. */
const FROZEN_SCROLL_KEY = "collection_frozen_scroll_v1";
const HISTORY_SCROLL_KEY = "__collectionScroll";

type LastCollectionScroll = {
  browseKey: string;
  scrollY: number;
  path: string;
  savedAt: number;
};

type HistoryScrollPayload = {
  y: number;
  browseKey?: string;
  path: string;
};

const RESTORE_DELAYS_MS = [0, 16, 50, 100, 200, 400, 800, 1200];
const SCROLL_TOLERANCE_PX = 16;
const GUARD_MAX_MS = 20000;
const RESTORE_TIMEOUT_MS = 20000;

let activeWatchdogCleanup: (() => void) | null = null;
let pendingRestoreTargetY = 0;
/** True after leaving collection for PDP — blocks any scroll snapshot writes. */
let collectionScrollLocked = false;

export const COLLECTION_RETURN_EVENT = "collection-browse-return";

export function isCollectionScrollLocked(): boolean {
  return collectionScrollLocked;
}

export function lockCollectionScrollWrites(): void {
  collectionScrollLocked = true;
}

export function unlockCollectionScrollWrites(): void {
  collectionScrollLocked = false;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function currentPath(): string {
  return window.location.pathname + window.location.search;
}

function normalizePath(path: string): string {
  try {
    const url = new URL(path, window.location.origin);
    return url.pathname + url.search;
  } catch {
    return path.replace(/\/$/, "") || path;
  }
}

function pathsMatch(savedPath: string, current?: string): boolean {
  const cur = current ?? currentPath();
  const a = normalizePath(savedPath);
  const b = normalizePath(cur);
  return a === b || a === normalizePath(window.location.pathname);
}

export function isCollectionPath(path: string): boolean {
  return /\/collection/.test(path) && !/\/product\//.test(path);
}

export function isOnCollectionPage(): boolean {
  return isBrowser() && isCollectionPath(window.location.pathname);
}

function resolveCollectionSavePath(path?: string): string | undefined {
  const candidate = path ?? currentPath();
  if (isCollectionPath(candidate)) return candidate;
  const previous = readLastCollectionScroll();
  if (previous?.path && isCollectionPath(previous.path)) return previous.path;
  return undefined;
}

/** Stamp scroll onto the current history entry (the collection page the user will return to via Back). */
export function stampCollectionScrollInHistory(
  scrollY: number,
  browseKey?: string
): void {
  if (!isBrowser() || scrollY <= 0) return;
  if (!isCollectionPath(window.location.pathname)) return;

  const path = currentPath();
  const payload: HistoryScrollPayload = { y: scrollY, browseKey, path };

  const prevState =
    typeof window.history.state === "object" && window.history.state
      ? { ...window.history.state }
      : {};

  try {
    history.replaceState(
      { ...prevState, [HISTORY_SCROLL_KEY]: payload },
      ""
    );
  } catch {
    // ignore
  }
}

export function readCollectionScrollFromHistoryState(
  state: unknown
): number {
  if (!state || typeof state !== "object") return 0;
  const payload = (state as Record<string, unknown>)[HISTORY_SCROLL_KEY];
  if (!payload || typeof payload !== "object") return 0;
  const y = (payload as HistoryScrollPayload).y;
  return typeof y === "number" && y > 0 ? y : 0;
}

function parseScrollPayload(raw: string | null): LastCollectionScroll | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as LastCollectionScroll & { pathname?: string };
    if (
      !parsed ||
      typeof parsed.browseKey !== "string" ||
      typeof parsed.scrollY !== "number" ||
      parsed.scrollY <= 0
    ) {
      return undefined;
    }
    if (!parsed.path && parsed.pathname) {
      parsed.path = parsed.pathname;
    }
    if (typeof parsed.path !== "string" || !isCollectionPath(parsed.path)) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function writeScrollSnapshot(
  browseKey: string,
  scrollY: number,
  collectionPath: string,
  options?: { allowOffPage?: boolean; stampHistory?: boolean }
): void {
  if (!isBrowser() || !browseKey || scrollY <= 0) return;
  if (!isCollectionPath(collectionPath)) return;
  if (!options?.allowOffPage && !isOnCollectionPage()) return;

  const previous = readLastCollectionScroll();
  const frozen = readFrozenCollectionScroll();
  const resolvedScrollY = Math.max(
    scrollY,
    previous?.browseKey === browseKey ? previous.scrollY : 0,
    frozen?.browseKey === browseKey ? frozen.scrollY : 0
  );

  const payload: LastCollectionScroll = {
    browseKey,
    scrollY: resolvedScrollY,
    path: collectionPath,
    savedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(LAST_SCROLL_KEY, JSON.stringify(payload));
    if (options?.allowOffPage) {
      sessionStorage.setItem(FROZEN_SCROLL_KEY, JSON.stringify(payload));
    }
    if (options?.stampHistory !== false && isOnCollectionPage()) {
      stampCollectionScrollInHistory(resolvedScrollY, browseKey);
    }
  } catch {
    // ignore
  }
}

/** Lock scroll before PDP navigation — only while still on the collection URL. */
export function freezeCollectionScrollForBack(
  browseKey: string,
  scrollY: number,
  path: string
): void {
  if (!isBrowser() || !browseKey || scrollY <= 0 || !isCollectionPath(path)) return;
  if (!isOnCollectionPage()) return;

  const existing = readFrozenCollectionScroll();
  const resolvedScrollY =
    existing?.browseKey === browseKey
      ? Math.max(scrollY, existing.scrollY)
      : scrollY;

  try {
    const payload: LastCollectionScroll = {
      browseKey,
      scrollY: resolvedScrollY,
      path,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(FROZEN_SCROLL_KEY, JSON.stringify(payload));
    sessionStorage.setItem(LAST_SCROLL_KEY, JSON.stringify(payload));
    stampCollectionScrollInHistory(resolvedScrollY, browseKey);
    lockCollectionScrollWrites();
  } catch {
    // ignore
  }
}

export function readFrozenCollectionScroll(): LastCollectionScroll | undefined {
  if (!isBrowser()) return undefined;
  return parseScrollPayload(sessionStorage.getItem(FROZEN_SCROLL_KEY));
}

export function saveLastCollectionScroll(
  browseKey: string,
  scrollY: number,
  path?: string
): void {
  if (!isBrowser() || !browseKey || scrollY <= 0) return;
  if (!isOnCollectionPage() || collectionScrollLocked) return;

  const collectionPath = resolveCollectionSavePath(path);
  if (!collectionPath) return;

  const frozen = readFrozenCollectionScroll();
  if (frozen?.browseKey === browseKey && scrollY < frozen.scrollY) return;

  writeScrollSnapshot(browseKey, scrollY, collectionPath, { stampHistory: true });
}

export function readLastCollectionScroll(): LastCollectionScroll | undefined {
  if (!isBrowser()) return undefined;
  return parseScrollPayload(sessionStorage.getItem(LAST_SCROLL_KEY));
}

export function clearLastCollectionScroll(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(LAST_SCROLL_KEY);
  } catch {
    // ignore
  }
}

function isAtScrollTarget(targetY: number): boolean {
  return Math.abs(window.scrollY - targetY) <= SCROLL_TOLERANCE_PX;
}

function maxScrollTop(): number {
  return Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight
  );
}

export function canScrollToTarget(targetY: number): boolean {
  return maxScrollTop() >= targetY - SCROLL_TOLERANCE_PX;
}

function isAnchorInView(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 60 &&
    rect.top <= window.innerHeight * 0.55 &&
    rect.bottom > 0
  );
}

function scrollToCollectionAnchor(anchorKey: string): boolean {
  const el = document.querySelector(
    `[data-collection-anchor="${CSS.escape(anchorKey)}"]`
  );
  if (!el || !(el instanceof HTMLElement)) return false;
  el.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
  return isAnchorInView(el);
}

export function hasPendingCollectionScrollRestore(): boolean {
  return pendingRestoreTargetY > 0;
}

/** Apply scroll and retry until we hit the target or time out (fights late Next scroll-to-top). */
export function runCollectionScrollRestore(
  targetY: number,
  onComplete?: () => void,
  anchorKey?: string
): void {
  if (!isBrowser() || targetY <= 0) {
    onComplete?.();
    return;
  }

  cancelCollectionScrollRestoreWatchdog();
  pendingRestoreTargetY = targetY;

  const timeouts: ReturnType<typeof setTimeout>[] = [];
  let ro: ResizeObserver | null = null;
  let mo: MutationObserver | null = null;
  let finished = false;
  const startedAt = Date.now();

  const teardown = () => {
    pendingRestoreTargetY = 0;
    timeouts.forEach(clearTimeout);
    ro?.disconnect();
    mo?.disconnect();
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("scroll", onScrollGuard, { capture: true });
    activeWatchdogCleanup = null;
  };

  const cancel = () => {
    if (finished) return;
    finished = true;
    teardown();
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    teardown();
    onComplete?.();
  };

  const attempt = () => {
    if (finished) return;

    if (anchorKey) {
      const el = document.querySelector(
        `[data-collection-anchor="${CSS.escape(anchorKey)}"]`
      );
      if (el instanceof HTMLElement) {
        if (scrollToCollectionAnchor(anchorKey) || isAnchorInView(el)) {
          finish();
          return;
        }
        return;
      }
    }

    const reachable = canScrollToTarget(targetY);
    // Never scroll to maxScrollTop as a stand-in — that lands on page-1 bottom.
    if (!reachable) return;

    window.scrollTo({ top: targetY, left: 0, behavior: "auto" });

    if (isAtScrollTarget(targetY)) {
      finish();
      return;
    }

    if (Date.now() - startedAt > RESTORE_TIMEOUT_MS) {
      finish();
    }
  };

  const onPageShow = () => attempt();

  const onScrollGuard = () => {
    if (finished || targetY <= 0) return;
    if (Date.now() - startedAt > GUARD_MAX_MS) return;
    // Short page (list not hydrated yet) — do not fight user scroll.
    if (!canScrollToTarget(targetY)) return;
    const y = window.scrollY;
    if (y < targetY - 80 && !isAtScrollTarget(targetY)) {
      window.scrollTo({ top: targetY, left: 0, behavior: "auto" });
    }
  };

  attempt();

  for (const delay of RESTORE_DELAYS_MS) {
    timeouts.push(setTimeout(attempt, delay));
  }

  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(attempt);
    ro.observe(document.documentElement);
  }

  if (typeof MutationObserver !== "undefined" && document.body) {
    mo = new MutationObserver(attempt);
    mo.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("scroll", onScrollGuard, { passive: true, capture: true });

  activeWatchdogCleanup = cancel;
}

export function cancelCollectionScrollRestoreWatchdog(): void {
  activeWatchdogCleanup?.();
  activeWatchdogCleanup = null;
}

/** Notify hooks that the user returned to a collection route (browser Back). */
export function dispatchCollectionBrowseReturn(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(COLLECTION_RETURN_EVENT));
}

export function resolveRestoreScrollY(
  popStateEvent?: PopStateEvent
): number {
  const fromHistory = popStateEvent
    ? readCollectionScrollFromHistoryState(popStateEvent.state)
    : readCollectionScrollFromHistoryState(window.history.state);

  const frozen = readFrozenCollectionScroll();
  const fromFrozen =
    frozen && pathsMatch(frozen.path) ? frozen.scrollY : 0;

  const last = readLastCollectionScroll();
  const fromStorage =
    last && isCollectionPath(last.path) && pathsMatch(last.path)
      ? last.scrollY
      : 0;

  return Math.max(fromHistory, fromStorage, fromFrozen);
}

/** Notify collection UI to re-hydrate list state; scroll runs after browseListReady. */
export function restoreCollectionScrollIfPending(
  popStateEvent?: PopStateEvent
): void {
  if (!isBrowser()) return;
  if (!/\/collection/.test(window.location.pathname)) return;
  if (/\/product\//.test(window.location.pathname)) return;

  unlockCollectionScrollWrites();

  const targetY = resolveRestoreScrollY(popStateEvent);
  if (targetY <= 0) return;

  cancelCollectionScrollRestoreWatchdog();
  dispatchCollectionBrowseReturn();
}

/** Re-dispatch return while list hydrates; does not scroll until the grid is ready. */
export function scheduleCollectionScrollRestoreBurst(
  popStateEvent?: PopStateEvent
): void {
  if (!isBrowser()) return;
  restoreCollectionScrollIfPending(popStateEvent);
  const delays = [100, 400, 900, 1800];
  for (const ms of delays) {
    setTimeout(() => restoreCollectionScrollIfPending(), ms);
  }
}

export function getRestoreScrollTarget(
  browseKey: string | undefined
): number {
  if (!browseKey) return 0;
  const frozen = readFrozenCollectionScroll();
  if (frozen?.browseKey === browseKey) return frozen.scrollY;
  const last = readLastCollectionScroll();
  if (last && last.browseKey === browseKey) return last.scrollY;
  return readCollectionScrollFromHistoryState(window.history.state);
}
