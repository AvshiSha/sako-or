'use client'

import * as React from 'react'

import { Sheet, SheetContent, SheetTitle } from '@/app/components/ui/sheet'
import { cn } from '@/lib/utils'

/**
 * Shared side drawer — the navigation panel's shell, without its contents.
 *
 * The navigation drawer is the only one of these surfaces that was built on the
 * Radix dialog behind `Sheet`, and it is the one that behaves: the slide and the
 * scrim fade are the keyframes in globals.css, the page behind it cannot scroll,
 * Escape and a tap outside both close it, and focus is trapped while it is open.
 * The filter panels (Framer Motion springs) and Quick Buy (Headless UI) each had
 * their own answer to all of that, so three drawers in the same storefront opened
 * at three speeds on three curves. They now share this shell, which is `Sheet`
 * with the house drawer's measurements applied.
 *
 * Differences from the navigation drawer, all deliberate:
 *
 * - **Side.** Navigation opens from the inline start, where its ☰ sits. These
 *   open from the inline end, which is the side the approved filter board
 *   (438:3094) and the cart drawer (438:4595) are drawn on for the Hebrew
 *   storefront. `side` is physical because the slide is a transform and
 *   transforms are not direction-aware, so RTL and LTR are resolved here rather
 *   than left to logical properties - which would move the panel without moving
 *   its animation.
 * - **Width.** 78% of the viewport under 642px, so the grid behind stays visible
 *   through the scrim, capped at the 501px the filter board is drawn at. The
 *   navigation drawer keeps its own 90%.
 * - **Scrim.** black/30, the scrim both approved drawers use, against the
 *   navigation drawer's black/80.
 */
export interface SideDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Storefront locale. Drives both the panel's side and its text direction. */
  lng: string
  /** Dialog name for assistive tech; the panels draw their own visible heading. */
  title: string
  /** Extra classes for the panel itself. */
  className?: string
  children: React.ReactNode
}

export default function SideDrawer({
  open,
  onOpenChange,
  lng,
  title,
  className,
  children,
}: SideDrawerProps) {
  const isRTL = lng === 'he'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRTL ? 'left' : 'right'}
        dir={isRTL ? 'rtl' : 'ltr'}
        // Every panel here carries its own close control in a laid-out position,
        // so the floating default would be a second ✕ over the first.
        hideClose
        overlayClassName="bg-black/30"
        className={cn(
          // h-dvh, not the shared variant's 105vh: these panels end in a pinned
          // action bar, and 5vh of overshoot puts it under the bottom edge of
          // the screen where nobody can reach it.
          'flex h-dvh w-[78%] max-w-[501px] flex-col gap-0 border-0 bg-surface-primary p-0 shadow-xl sm:max-w-[501px]',
          className
        )}
        // Without this the drawer hands focus to whatever its first control is -
        // on the filter panel the price slider, which a keyboard user then drags
        // with the arrow keys they meant to scroll with.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  )
}
