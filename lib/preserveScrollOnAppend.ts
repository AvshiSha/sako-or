export type ScrollSnapshot = {
  scrollY: number;
  scrollX: number;
};

export function captureScrollSnapshot(): ScrollSnapshot {
  return {
    scrollY: window.scrollY,
    scrollX: window.scrollX,
  };
}

/**
 * Keep the viewport at the same scroll offset after items append below.
 * Does not follow the new bottom — that would jump the user to the end of
 * the page they just loaded.
 */
export function restoreScrollAfterAppend(snapshot: ScrollSnapshot): void {
  const apply = () => {
    if (Math.abs(window.scrollY - snapshot.scrollY) <= 2) return;
    window.scrollTo({
      top: snapshot.scrollY,
      left: snapshot.scrollX,
      behavior: "auto",
    });
  };

  apply();
  requestAnimationFrame(apply);
}
