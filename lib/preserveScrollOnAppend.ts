export type ScrollSnapshot = {
  scrollY: number;
  scrollX: number;
};

/** Snapshot taken immediately before append; includes a visible grid anchor when possible. */
export type ScrollAppendSnapshot = ScrollSnapshot & {
  anchorKey: string | null;
  anchorTop: number | null;
};

export function captureScrollSnapshot(): ScrollSnapshot {
  return {
    scrollY: window.scrollY,
    scrollX: window.scrollX,
  };
}

/**
 * Capture the viewport immediately before new rows are committed.
 * Must be called synchronously right before flushSync / state append — not at fetch start.
 */
export function captureScrollForAppend(): ScrollAppendSnapshot {
  const base = captureScrollSnapshot();
  const nodes = document.querySelectorAll<HTMLElement>(
    "[data-collection-anchor]"
  );
  let best: { anchorKey: string; top: number } | null = null;

  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    const key = el.getAttribute("data-collection-anchor");
    if (!key) continue;
    if (!best || rect.top < best.top) {
      best = { anchorKey: key, top: rect.top };
    }
  }

  return {
    ...base,
    anchorKey: best?.anchorKey ?? null,
    anchorTop: best?.top ?? null,
  };
}

function findAnchorElement(anchorKey: string): HTMLElement | null {
  const selector = `[data-collection-anchor="${CSS.escape(anchorKey)}"]`;
  return document.querySelector<HTMLElement>(selector);
}

/**
 * Keep the same product card at the same viewport offset after rows append below.
 * Never scrolls to a stored absolute Y — that causes jumps when the user moved while fetching.
 */
export function restoreScrollAfterAppend(snapshot: ScrollAppendSnapshot): void {
  if (snapshot.anchorKey == null || snapshot.anchorTop == null) {
    return;
  }

  const apply = () => {
    const el = findAnchorElement(snapshot.anchorKey!);
    if (!el) return;
    const delta = el.getBoundingClientRect().top - snapshot.anchorTop!;
    if (Math.abs(delta) < 0.5) return;
    window.scrollBy({ top: delta, left: 0 });
  };

  apply();
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(apply);
  });
}
