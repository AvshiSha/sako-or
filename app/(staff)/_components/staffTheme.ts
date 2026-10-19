/**
 * Class map for the staff warehouse screen.
 *
 * Same flat `as const` shape as `app/(unlocalized)/admin/_components/adminTheme.ts`,
 * which is the de-facto design system for internal surfaces here -- but a
 * separate map, not a reuse, for two reasons:
 *
 *  1. `adminTheme` is sized for a mouse. Its controls are `px-4 py-2` with
 *     `sm:text-sm`, which lands around a 36px target and 14px text. The primary
 *     device for this screen is an iPad held by someone standing up, so targets
 *     here are at least 48px and body text at least 16px.
 *  2. 16px is also the iOS zoom floor. Anything smaller on a focused input
 *     makes Safari zoom the page, which on a one-field lookup screen is
 *     genuinely disorienting. `app/components/ui/input.tsx` exports
 *     `FIELD_BOX_TEXT` for exactly this, and the input classes below use it.
 *
 * Colours come from the `@theme static` tokens in `app/globals.css` rather than
 * hardcoded hexes, so this surface follows the design system if it moves. The
 * utility names read oddly (`text-text-primary`) because the token names are
 * the design system's own; that is the existing convention.
 */

import { FIELD_BOX_TEXT } from '@/app/components/ui/input'

/** Minimum comfortable touch target. Used for every interactive element. */
const TOUCH = 'min-h-[48px]'

export const staffTheme = {
  // --- shell -------------------------------------------------------------
  pageBg: 'min-h-dvh bg-surface-secondary text-text-primary font-ploni',
  header:
    'sticky top-0 z-20 bg-surface-dark text-text-inverse px-4 py-3 flex items-center justify-between gap-3',
  headerTitle: 'text-[18px] font-bold',
  // Max width rather than full bleed: a 1024px-wide iPad in landscape with
  // edge-to-edge content makes the eye travel further than the data warrants.
  container: 'mx-auto w-full max-w-[900px] px-4 pb-16 pt-4',

  // --- lookup ------------------------------------------------------------
  /**
   * The input and the Search button share ONE row at every width -- desktop,
   * iPad portrait and iPad landscape alike.
   *
   * `items-stretch` rather than `items-end`: both controls carry
   * `min-h-[48px]`, so stretching makes them exactly the same height and
   * removes the half-row offset that `items-end` produced once the hint text
   * sat inside the same column as the input.
   *
   * `flex-nowrap` is explicit so the button can never drop to its own line at a
   * narrow width, which is the failure this replaced.
   */
  searchRow: 'flex flex-nowrap items-stretch gap-3',
  /** `min-w-0` lets the input actually shrink inside the flex row. */
  searchInput: 'flex-1 min-w-0',
  /**
   * `shrink-0` keeps the button at its natural width, and the `min-w` stops the
   * row resizing when the label swaps to its loading text mid-search.
   */
  searchButton: 'shrink-0 whitespace-nowrap min-w-[7rem]',
  label: 'block text-[15px] font-bold text-text-primary mb-1',
  hint: 'mt-1 text-[14px] text-text-secondary',
  input: [
    'block w-full rounded-sako-sm border border-border-subtle bg-surface-primary',
    'px-4 py-3 text-text-primary placeholder-sako-gray-500',
    // tabular-nums because Ploni's digits are not tabular, and a model number
    // that reflows as you type is unpleasant to read back.
    'tabular-nums tracking-[0.08em]',
    'focus:outline-none focus:border-border-default focus:ring-2 focus:ring-border-default/30',
    TOUCH,
    FIELD_BOX_TEXT,
  ].join(' '),
  inputInvalid: 'border-accent-error focus:border-accent-error',

  // --- buttons -----------------------------------------------------------
  buttonPrimary: [
    'inline-flex items-center justify-center gap-2 rounded-sako-sm',
    'bg-btn-primary-bg px-6 text-btn-primary-text text-[16px] font-bold',
    'transition-opacity hover:opacity-90 active:opacity-80',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    TOUCH,
  ].join(' '),
  buttonSecondary: [
    'inline-flex items-center justify-center gap-2 rounded-sako-sm',
    'border border-border-default bg-btn-secondary-bg px-6 text-btn-secondary-text text-[16px] font-bold',
    'transition-colors hover:bg-sako-gray-100',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    TOUCH,
  ].join(' '),
  buttonGhost: [
    'inline-flex items-center justify-center gap-2 rounded-sako-sm',
    'px-4 text-[15px] font-bold text-text-primary underline underline-offset-4',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    TOUCH,
  ].join(' '),
  headerButton: [
    'inline-flex items-center justify-center rounded-sako-sm',
    'px-4 text-[15px] font-bold text-text-inverse',
    'border border-text-inverse/40 hover:bg-text-inverse/10',
    'min-h-[40px]',
  ].join(' '),

  // --- cards -------------------------------------------------------------
  card: 'rounded-sako-sm bg-surface-primary border border-border-subtle overflow-hidden',
  cardHeader: 'flex items-start justify-between gap-3 p-4 border-b border-border-subtle',
  colorName: 'text-[20px] font-black leading-tight',
  /**
   * The location, which the brief wants readable at a glance. Big, bold, and
   * the only thing on the card at this size.
   */
  locationValue: 'text-[22px] font-black leading-tight tabular-nums',
  locationEmpty: 'text-[18px] font-bold text-text-secondary',
  locationBlock: 'px-4 py-3 bg-sako-gray-300',

  // --- size table --------------------------------------------------------
  sizeTable: 'w-full text-[17px] tabular-nums',
  sizeHead: 'bg-sako-gray-100 text-[14px] font-bold text-text-secondary',
  sizeCell: 'px-3 py-2 text-start',
  sizeCellZero: 'text-text-secondary',
  totalRow: 'border-t border-border-subtle font-bold',

  // --- states ------------------------------------------------------------
  notice: 'rounded-sako-sm px-4 py-3 text-[16px] font-bold',
  noticeError: 'bg-accent-error/10 text-accent-error border border-accent-error/30',
  noticeWarn: 'bg-sako-gray-400 text-text-primary border border-border-subtle',
  noticeSuccess: 'bg-sako-gray-300 text-text-primary border border-border-subtle',
  fieldError: 'mt-1 text-[15px] font-bold text-accent-error',
  meta: 'text-[14px] text-text-secondary',

  // --- dialog ------------------------------------------------------------
  dialogOverlay: 'fixed inset-0 bg-sako-ink-900/50',
  dialogPanel: [
    'w-full max-w-[460px] rounded-sako-sm bg-surface-primary p-5',
    'text-start shadow-xl font-ploni text-text-primary',
  ].join(' '),
  dialogTitle: 'text-[20px] font-black',
  select: [
    'block w-full rounded-sako-sm border border-border-subtle bg-surface-primary',
    'px-3 py-3 text-text-primary tabular-nums',
    'focus:outline-none focus:border-border-default',
    TOUCH,
    FIELD_BOX_TEXT,
  ].join(' '),
  pinInput: [
    'block w-full rounded-sako-sm border border-border-subtle bg-surface-primary',
    'px-4 py-3 text-center text-[22px] tracking-[0.5em] tabular-nums',
    'focus:outline-none focus:border-border-default',
    'min-h-[56px]',
  ].join(' '),
} as const
