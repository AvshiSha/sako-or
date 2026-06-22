"use client";

import { useEffect, useState } from "react";

/** True when viewport is at or above Tailwind `lg` (1024px). */
export function useLgDesktop() {
  const [isLgDesktop, setIsLgDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLgDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isLgDesktop;
}
