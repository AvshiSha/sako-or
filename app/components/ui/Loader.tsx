"use client";

import * as React from "react";
import { motion as fmMotion } from "framer-motion";

import { cn } from "@/lib/utils";

const motion = fmMotion as unknown as any;

export type LoaderProps = {
  className?: string;
  /**
   * When true, covers the viewport with a subtle overlay.
   * When false, renders just the animated icon (for inline use).
   */
  overlay?: boolean;
  /** Icon size in pixels. */
  size?: number;
  /** Extra label for screen readers. */
  label?: string;
};

const iconTransition = {
  duration: 1.6,
  ease: "easeInOut",
  repeat: Infinity,
  repeatType: "mirror",
};

const rotateTransition = {
  duration: 10,
  ease: "linear",
  repeat: Infinity,
};

export default function Loader({
  className,
  overlay = true,
  size = 120,
  label = "Loading",
}: LoaderProps) {
  const icon = (
    <motion.img
      src="/icons/sako-icon.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="select-none"
      draggable={false}
      style={{ transform: "translateZ(0)" }}
      animate={{ opacity: [0.88, 1], scale: [1, 1.02] }}
      transition={iconTransition}
    />
  );

  const animated = (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("flex items-center justify-center", className)}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={rotateTransition}
        className="will-change-transform"
        style={{ transform: "translateZ(0)" }}
      >
        {icon}
      </motion.div>
      <span className="sr-only">{label}</span>
    </div>
  );

  if (!overlay) return animated;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center">
      <div
        className={cn(
          "absolute inset-0 bg-white/70 backdrop-blur-sm",
          "supports-[backdrop-filter]:bg-white/55"
        )}
        aria-hidden="true"
      />
      <div className="relative">{animated}</div>
    </div>
  );
}

