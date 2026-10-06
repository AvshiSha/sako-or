'use client'

/**
 * The chrome shared by Sign in and Sign up.
 *
 * There is no Figma frame for either screen — the file's 63 approved screens
 * cover Product, Collection, Cart, Checkout, Favorites, Blog, Legal, 404, Header
 * and Footer, and nothing else. So, as with About / Contact / FAQ, this is
 * composed from constructions approved elsewhere rather than invented, and every
 * measurement below points at the node it came from:
 *
 *   - the whole shell      Checkout Details / Desktop, 438:2725. The same
 *                          1fr + 502px split closed by a black hairline, the
 *                          same 40/60px H1 over a full-bleed rule, the same 9px
 *                          tracked eyebrow under it. Auth and checkout are the
 *                          only two places on the storefront that are a form
 *                          with a standing panel beside it, so they should be
 *                          the same page.
 *   - the aside            the checkout summary panel's position and hairline
 *                          (438:2781). Carries the club pitch instead of a
 *                          basket, since that is what a visitor here is weighing.
 *   - the form column      438:2748's 681px measure, capped not fixed.
 *   - the field rhythm     438:2749 — 54px cells on a 69px pitch, two-up above
 *                          sm and stacked below.
 *
 * Below lg the columns stack and the panel follows the form: someone who came to
 * sign in should reach the fields first, and the pitch is what they scroll past
 * afterwards rather than through.
 */

import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { SPLIT_SHELL_GRID } from '@/lib/split-shell-layout'

/** 438:2749 — two-up above sm, stacked below, on the frame's 18px gutter. */
export const AUTH_ROW = 'grid grid-cols-1 gap-x-[18px] gap-y-0 sm:grid-cols-2'

/** The 15px that turns a 54px cell into the frame's 69px row pitch. */
export const AUTH_CELL = 'pb-[15px]'

/** 438:2748 — the form measure. */
export const AUTH_MEASURE = 'max-w-[681px]'

/** Typography/Body/Micro-Spaced, as checkout sets it per-instance (438:2739). */
export const AUTH_EYEBROW =
  'font-ploni text-[9px] tracking-[1.17px] text-start text-text-primary'

/** Typography/Label/Tag — 12px DemiBold at 1.2px tracking. */
export const AUTH_LABEL = 'font-ploni text-[12px] font-semibold tracking-[1.2px]'

export interface AuthShellProps {
  title: string
  eyebrow: string
  /** The standing panel beside the form. */
  aside?: ReactNode
  children: ReactNode
}

// No `language` prop, deliberately — unlike CheckoutShell, which takes one to
// write a `dir` on its root. Direction here comes from the <html> the [lng]
// layout already sets it on, and everything below is laid out with logical
// properties, so a second source of truth for direction would only be a way to
// disagree with the first.
export default function AuthShell({ title, eyebrow, aside, children }: AuthShellProps) {
  return (
    // No dir here: direction comes from the <html> the [lng] layout writes it
    // on. Setting it per-node is how a Hebrew block that opens on "SAKO OR"
    // flips itself to LTR.
    <div className="min-h-screen bg-surface-secondary">
      <div className={SPLIT_SHELL_GRID}>
        {/* The seam is drawn by SPLIT_SHELL_GRID, not by a border here: on these
            pages the standing panel is routinely taller than the form, which is
            exactly when a border on this column stops short. */}
        <section>
          <div className="px-[16px] pt-[24px] pb-[24px] lg:px-[30px] lg:pt-[30px] lg:pb-[30px]">
            <h1 className="font-ploni text-[40px] font-black leading-[40px] text-start text-text-primary lg:text-[60px] lg:leading-[50px]">
              {title}
            </h1>
          </div>

          <div className="border-t border-sako-black" />

          <div className="px-[16px] py-[20px] lg:px-[30px]">
            <p className={AUTH_EYEBROW}>{eyebrow}</p>
          </div>

          <div className="px-[16px] pb-[40px] lg:px-[30px]">
            <div className={AUTH_MEASURE}>{children}</div>
          </div>
        </section>

        {aside}
      </div>
    </div>
  )
}

/**
 * The standing panel. A hairline on the inline start on desktop so it reads as
 * the far side of the same sheet; above it on mobile, where it has stacked under
 * the form and needs a rule of its own to separate the two.
 */
export function AuthAside({
  heading,
  children,
  className,
}: {
  heading: string
  children: ReactNode
  className?: string
}) {
  return (
    <aside
      className={cn(
        'border-t border-sako-black px-[16px] py-[30px] lg:border-t-0 lg:px-[30px] lg:py-[30px]',
        className
      )}
    >
      <h2 className="font-ploni text-[20px] font-black text-start text-text-primary">
        {heading}
      </h2>
      <div className="mt-[20px] flex flex-col gap-[16px]">{children}</div>
    </aside>
  )
}

/**
 * One line of the panel's pitch. A ruled row rather than an icon chip: this
 * system draws no decorative pictograms, and the lucide gems and gift boxes the
 * old sign-up used were the clearest sign it predated the redesign.
 */
export function AuthAsideItem({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-border-subtle pt-[14px] font-ploni text-[14px] leading-[22px] text-start text-text-primary">
      {children}
    </p>
  )
}

/**
 * The page-level error. A 1px accent-error edge on the paper, matching the one
 * checkout draws (CheckoutClient's submit failure), and announced — the old
 * tinted red boxes were silent to a screen reader.
 */
export function AuthError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div className="mb-[20px] border border-accent-error px-[16px] py-[12px]">
      <p role="alert" className="font-ploni text-[13px] leading-[18px] text-accent-error">
        {children}
      </p>
    </div>
  )
}

/**
 * A confirmation, e.g. "code sent to …". Ink rule rather than the old green
 * tint: the system has no success colour, so emphasis is weight and a rule.
 */
export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="border-t border-sako-black pt-[14px] font-ploni text-[14px] leading-[22px] text-start font-bold text-text-primary"
    >
      {children}
    </p>
  )
}

/**
 * A text link in the system's vocabulary: the label type over a hairline, as
 * contact's "GET DIRECTIONS" and the blog header's label draw it.
 */
export function AuthLink({
  href,
  onClick,
  disabled,
  children,
  className,
}: {
  href?: string
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  className?: string
}) {
  const classes = cn(
    AUTH_LABEL,
    'self-start border-b border-border-default pb-[4px] text-text-primary transition-opacity hover:opacity-60',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sako-ink-900',
    disabled && 'cursor-not-allowed border-sako-gray-500 text-sako-gray-500 hover:opacity-100',
    className
  )

  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  )
}

/**
 * The form's CTA: the design system's 54px bar (438:7683 Filled / 438:7685
 * Outlined) with the label on the inline start and the turned U+2199 opposite,
 * as the PDP, the cart and contact all draw it.
 *
 * Loading is the fourth state the design system does not provide. Rather than
 * import a spinner — a shape that exists nowhere in this system — the arrow is
 * replaced by the same pulsing block the skeletons are made of, the label swaps
 * to the working copy, and the control disables. aria-busy says so out loud, and
 * the label change is what a screen reader actually announces.
 *
 * Disabled is the system's flat grey fill, never a 50% fade, so an unavailable
 * CTA still reads as a solid bar.
 */
export function AuthSubmit({
  label,
  loadingLabel,
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  variant = 'filled',
  className,
}: {
  label: string
  loadingLabel?: string
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'filled' | 'outlined'
  className?: string
}) {
  const isOutlined = variant === 'outlined'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'flex h-[54px] w-full items-center justify-between px-[19px] font-ploni text-[16px] font-bold leading-none transition-colors',
        isOutlined
          ? 'border border-border-default bg-transparent text-btn-secondary-text hover:bg-sako-ink-900 hover:text-btn-primary-text'
          : 'border border-btn-primary-bg bg-btn-primary-bg text-btn-primary-text hover:bg-sako-ink-800',
        'disabled:cursor-not-allowed disabled:border-sako-gray-500 disabled:hover:bg-sako-gray-500',
        isOutlined
          ? 'disabled:bg-transparent disabled:text-sako-gray-500 disabled:hover:bg-transparent disabled:hover:text-sako-gray-500'
          : 'disabled:bg-sako-gray-500',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sako-ink-900',
        className
      )}
    >
      <span>{loading ? loadingLabel ?? label : label}</span>
      {loading ? (
        <span aria-hidden="true" className="size-[12px] animate-pulse bg-current" />
      ) : (
        <span
          aria-hidden="true"
          className="rotate-90 font-ploni text-[20px] font-black leading-none"
        >
          &#8601;
        </span>
      )}
    </button>
  )
}

/**
 * The loading face of the whole screen, for the moments auth spends deciding
 * where to send someone — resolving the Firebase session, syncing the profile,
 * redirecting.
 *
 * A skeleton of this exact shell rather than a spinner on a card, because that
 * is how this system loads everywhere else (CartSkeleton, FavoritesSkeleton):
 * pulsing gray-300 blocks standing in for the real furniture, so the page does
 * not visibly change shape when the content lands.
 */
export function AuthSkeleton({ title }: { title?: string }) {
  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className={SPLIT_SHELL_GRID}>
        {/* The seam is drawn by SPLIT_SHELL_GRID, not by a border here: on these
            pages the standing panel is routinely taller than the form, which is
            exactly when a border on this column stops short. */}
        <section>
          <div className="px-[16px] pt-[24px] pb-[24px] lg:px-[30px] lg:pt-[30px] lg:pb-[30px]">
            {title ? (
              <h1 className="font-ploni text-[40px] font-black leading-[40px] text-start text-text-primary lg:text-[60px] lg:leading-[50px]">
                {title}
              </h1>
            ) : (
              <div className="h-[40px] w-[220px] animate-pulse bg-sako-gray-300 lg:h-[50px]" />
            )}
          </div>

          <div className="border-t border-sako-black" />

          <div className="px-[16px] py-[20px] lg:px-[30px]">
            <div className="h-[11px] w-[140px] animate-pulse bg-sako-gray-300" />
          </div>

          <div className="px-[16px] pb-[40px] lg:px-[30px]">
            <div className={cn(AUTH_MEASURE, 'flex flex-col gap-[15px]')}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[54px] animate-pulse border-b border-border-subtle" />
              ))}
              <div className="mt-[10px] h-[54px] animate-pulse bg-sako-gray-300" />
            </div>
          </div>
        </section>

        <aside className="min-h-[300px] animate-pulse bg-sako-gray-400" />
      </div>
    </div>
  )
}
