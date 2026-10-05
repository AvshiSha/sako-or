/* Shared class strings for the profile / complete-profile / verify-sms screens.
   Bound to the v5 design system (Figma Q7WqJRF5rqxc4V7zqdpQUM, Section / Colors
   439:7727) — every colour here is a token from globals.css, no literals.

   Two deliberate departures from what this file used to carry:

   1. No elevation. The DESIGN SYSTEM page documents no shadow and no ring
      anywhere, so `card` and the two buttons lost `shadow-*` / `ring-*` and the
      cards are separated from the #f2f2f2 ground by a 1px border-subtle rule
      instead. The old `shadow-[0_4px_20px_rgba(15,23,42,0.08)]` was a slate-blue
      tint with no counterpart in the palette.
   2. `input` keeps its filled look. The old fill was #E1DBD7 — one digit off
      gray-200 (#E1DBD6), so it reads as the design system's beige already, and
      `bg-sako-gray-200` is that value exactly. The rule is ink per the system's
      form field (438:2751); see app/components/ui/field.tsx, which owns the
      focus/disabled/error states for v5 fields and is the precedent followed
      here (disabled is flat gray-500 type, never a 50% fade).

   Geometry (rounded-xl / rounded-md, spacing, type scale) is untouched — the
   design system is predominantly sharp-cornered (radius none/sm/full only), so
   the radii here are still off-system and want a separate pass. */
export const profileTheme = {
  pageBg: 'min-h-[calc(100vh-0px)] bg-surface-secondary',
  shell: 'mx-auto w-full max-w-2xl px-4 py-4 sm:py-8 ',
  card: 'rounded-xl bg-surface-primary border border-border-subtle mt-4',
  header: 'flex items-center gap-3 border-b border-border-subtle px-5 py-4 sm:px-6 sm:py-5',
  avatar:
    'h-11 w-11 md:h-12 md:w-12 shrink-0 rounded-full bg-surface-secondary ring-1 ring-border-subtle flex items-center justify-center',
  title: 'text-lg md:text-xl lg:text-2xl font-semibold tracking-tight text-text-primary',
  subtitle: 'mt-1 text-xs sm:text-sm text-sako-gray-500',

  section: 'px-5 py-4 sm:px-6 sm:py-6 md:px-8 md:py-4',
  sectionTitle: 'text-sm md:text-base font-semibold text-text-primary mb-2 md:mb-4',
  grid: 'mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2',

  label: 'block text-sm font-medium text-text-secondary mb-1.5 rtl:text-right ltr:text-left',
  input:
    'flex h-10 w-full rounded-md border border-border-default bg-sako-gray-200 px-3 py-2 text-sm text-text-primary ring-offset-background placeholder:text-sako-gray-500 focus-visible:outline-none focus-visible:ring-border-default focus-visible:ring-offset-2 focus-visible:border-border-default disabled:cursor-not-allowed disabled:border-border-subtle disabled:text-sako-gray-500',
  inputDisabled: 'bg-surface-secondary text-sako-gray-500',

  hint: 'mt-1 text-xs text-sako-gray-500',
  error: 'mt-1 text-xs text-accent-error',

  actions: 'flex flex-col-reverse gap-3 sm:flex-row sm:justify-end',
  buttonPrimary:
    'inline-flex items-center justify-center rounded-md bg-surface-dark px-5 py-2.5 text-sm font-semibold text-text-inverse hover:bg-sako-ink-800 focus:outline-none focus:ring-2 focus:ring-border-default disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
  buttonSecondary:
    'inline-flex items-center justify-center rounded-md border border-border-default bg-btn-secondary-bg px-5 py-2.5 text-sm font-semibold text-btn-secondary-text hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-border-default disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
} as const
