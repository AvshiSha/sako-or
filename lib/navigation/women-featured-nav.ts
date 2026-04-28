export type WomenFeaturedLocale = 'en' | 'he'

export type WomenFeaturedNavLink = {
  slug: string
  label: Record<WomenFeaturedLocale, string>
  /** Optional small badge text (no emojis). */
  badge?: Record<WomenFeaturedLocale, string>
  /** Visual tone for badge styling in the nav UI. */
  badgeTone?: 'warm' | 'cool' | 'neutral'
}

/**
 * Featured campaign shortcuts shown at the top of the Women navigation.
 * These are static links (no fetching) and point to existing campaign pages.
 *
 * Ordering is intentional (high-conversion shortcuts first).
 */
export const WOMEN_FEATURED_NAV_LINKS: WomenFeaturedNavLink[] = [
  { slug: 'new-collection', label: { en: 'New In SAKO OR', he: 'New In SAKO OR' } },
  {
    slug: 'best-sellers',
    label: { en: 'Best Sellers', he: 'Best Sellers' },
    badge: { en: 'Popular', he: 'פופולרי' },
    badgeTone: 'warm',
  },
  {
    slug: 'last-sizes',
    label: { en: 'Last Sizes', he: 'מידות אחרונות' },
    badge: { en: 'Limited', he: 'מוגבל' },
    badgeTone: 'cool',
  },
  { slug: 'back-in-stock', label: { en: 'Back in Stock', he: 'חזר למלאי' } },
  { slug: 'limited-edition', label: { en: 'Limited Edition', he: 'Limited Edition' } },
]

export function womenFeaturedCampaignHref(lng: string, slug: string): string {
  return `/${lng}/collection/campaign?slug=${encodeURIComponent(slug)}`
}

export function womenFeaturedLinkLabel(lng: string, link: WomenFeaturedNavLink): string {
  const key: WomenFeaturedLocale = lng === 'he' ? 'he' : 'en'
  return link.label[key]
}

export function womenFeaturedLinkBadge(
  lng: string,
  link: WomenFeaturedNavLink
): string | undefined {
  if (!link.badge) return undefined
  const key: WomenFeaturedLocale = lng === 'he' ? 'he' : 'en'
  return link.badge[key]
}

export function womenFeaturedBadgeTone(
  link: WomenFeaturedNavLink
): WomenFeaturedNavLink['badgeTone'] {
  return link.badgeTone ?? 'neutral'
}

