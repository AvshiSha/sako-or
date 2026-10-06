/**
 * Header geometry shared between the sticky header and any page that wants content
 * to sit *behind* it.
 *
 * The header is `sticky top-0` inside a flex column, so it occupies flow space and
 * everything after it starts underneath. That is right for ordinary pages, but the
 * design's Transparent header variant (438:4393) only means anything if the hero is
 * actually behind the bar - otherwise a transparent nav just reveals the page ground
 * and reads as plain white.
 *
 * So the home hero is pulled up by exactly the nav bar's height. The announcement
 * banner above it keeps its own space: the design stacks the banner over the hero,
 * not behind it.
 *
 * These two must stay in step, which is why they live together rather than as two
 * literals in two files.
 */
export const NAV_BAR_H = "h-[50px] lg:h-[72px]";

/**
 * One pixel taller than NAV_BAR_H on purpose. The nav carries a `border-b`, so the
 * element occupies 51px / 73px in flow, not 50px / 72px. Pulling the hero up by only
 * the content height leaves that single border row with nothing behind it, which
 * renders as a hairline of page ground between the announcement banner and the hero.
 */
export const NAV_BAR_PULL_UP = "-mt-[51px] lg:-mt-[73px]";

/**
 * The same 51/73 flow height appears inside a `calc()` in NotFoundClient's
 * full-viewport hero, which Tailwind can only read as a literal - an arbitrary value
 * built from an interpolated constant is never scanned, so it cannot be imported from
 * here. It is cross-referenced in a comment there instead; a change to NAV_BAR_H
 * needs to visit it.
 */
