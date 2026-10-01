import 'server-only'
import { prisma } from '../prisma'

/**
 * The reviews behind the About page carousel.
 *
 * This module is the privacy boundary between the `reviews` table and the
 * storefront. Those rows carry a customer's full name, email address and phone
 * number; `FeaturedReview` deliberately has no field any of them could travel
 * in. Anything the carousel renders has to be built here, so there is exactly
 * one place to audit - a page that selected the Prisma row itself could leak a
 * contact detail into the HTML without anyone noticing.
 *
 * Reviews reach the carousel only by an admin setting `featuredAt` in
 * /admin/reviews. There is no automatic rule (such as "all 5-star reviews"):
 * publishing a customer's words on the brand page is an editorial decision, and
 * an automatic one would put a review on the About page the moment it was
 * submitted, before anybody had read it.
 */

export interface FeaturedReview {
  id: string
  /** 1-5, the overall shopping-experience rating. */
  rating: number
  /** The customer's own words. Never empty - see `quoteOf`. */
  quote: string
  /**
   * Display name, already reduced to first name + initial ("סבטלנה י.").
   * Reducing it here rather than in the component means no caller can render
   * the full name by accident.
   */
  author: string
  /** Product names from the same order, for the line under the quote. */
  products: string[]
}

/**
 * How many to show. The carousel duplicates its track to loop seamlessly, so
 * this is doubled in the DOM - a cap keeps that honest.
 */
const MAX_FEATURED = 12

/**
 * First name plus the initial of whatever follows.
 *
 * Falls back to a neutral label rather than to the raw string: an empty or
 * single-token name must not quietly become a full name, and a review with no
 * usable name is still worth showing.
 */
function displayNameOf(fullName: string | null, locale: 'en' | 'he'): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return locale === 'he' ? 'לקוח/ה' : 'A customer'
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`
}

/**
 * The best sentence the customer wrote.
 *
 * Preference order is general comment, then the per-product notes, then the
 * service/delivery/packaging ones. A review can be featured while every comment
 * box was left blank, and a carousel card with no words is not worth a slide, so
 * those are dropped rather than rendered as a bare row of stars.
 */
function quoteOf(review: {
  generalComment: string | null
  serviceComment: string | null
  deliveryComment: string | null
  packagingComment: string | null
  productReviews: { body: string | null }[]
}): string | null {
  const candidates = [
    review.generalComment,
    ...review.productReviews.map((product) => product.body),
    review.serviceComment,
    review.deliveryComment,
    review.packagingComment,
  ]

  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (trimmed) return trimmed
  }
  return null
}

/**
 * Featured reviews for the carousel, most recently featured first.
 *
 * Returns [] on any database error rather than throwing: the About page is
 * static editorial content and must still render if the reviews database is
 * unreachable. The carousel renders nothing when the list is empty.
 */
export async function listFeaturedReviews(locale: 'en' | 'he'): Promise<FeaturedReview[]> {
  try {
    const rows = await prisma.review.findMany({
      where: { featuredAt: { not: null } },
      orderBy: { featuredAt: 'desc' },
      take: MAX_FEATURED,
      select: {
        id: true,
        overallRating: true,
        generalComment: true,
        serviceComment: true,
        deliveryComment: true,
        packagingComment: true,
        // customerName only. Email and phone are deliberately not selected, so
        // they cannot reach this process, let alone the page.
        order: { select: { customerName: true } },
        productReviews: {
          select: { body: true, orderItem: { select: { productName: true } } },
        },
      },
    })

    return rows.flatMap((review) => {
      const quote = quoteOf(review)
      if (!quote) return []

      return [
        {
          id: review.id,
          rating: review.overallRating,
          quote,
          author: displayNameOf(review.order.customerName, locale),
          products: [
            ...new Set(
              review.productReviews
                .map((product) => product.orderItem.productName)
                .filter((name): name is string => Boolean(name))
            ),
          ],
        },
      ]
    })
  } catch (error) {
    console.error('[FEATURED_REVIEWS_ERROR]', error)
    return []
  }
}
