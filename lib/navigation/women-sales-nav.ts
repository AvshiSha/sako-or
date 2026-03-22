export type WomenSalesLocale = 'en' | 'he'

export const WOMEN_SALES_SECTION_TITLE: Record<WomenSalesLocale, string> = {
  en: 'BOGO Deals',
  he: 'מבצע הזוגות',
}

export type WomenSalesNavLink = {
  slug: string
  label: Record<WomenSalesLocale, string>
}

/** Hardcoded BOGO campaign entry points under Women nav only; extend by appending rows. */
export const WOMEN_BOGO_NAV_LINKS: WomenSalesNavLink[] = [
  { slug: 'bogo450', label: { he: '2 ב-450', en: '2 for 450' } },
  { slug: 'bogo500', label: { he: '2 ב-500', en: '2 for 500' } },
  { slug: 'bogo600', label: { he: '2 ב-600', en: '2 for 600' } },
  { slug: 'bogo700', label: { he: '2 ב-700', en: '2 for 700' } },
  { slug: 'bogo800', label: { he: '2 ב-800', en: '2 for 800' } }
]

export function womenSalesCampaignHref(lng: string, slug: string): string {
  return `/${lng}/collection/campaign?slug=${encodeURIComponent(slug)}`
}

export function womenSalesSectionTitle(lng: string): string {
  const key = lng === 'he' ? 'he' : 'en'
  return WOMEN_SALES_SECTION_TITLE[key]
}

export function womenSalesLinkLabel(lng: string, link: WomenSalesNavLink): string {
  const key = lng === 'he' ? 'he' : 'en'
  return link.label[key]
}
