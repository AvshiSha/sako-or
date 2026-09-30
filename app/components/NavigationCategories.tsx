'use client'

import Link from 'next/link'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion'
import {
  WOMEN_BOGO_NAV_LINKS,
  womenSalesCampaignHref,
  womenSalesLinkLabel,
  womenSalesSectionTitle,
} from '@/lib/navigation/women-sales-nav'
import type { NavSubCategory } from '@/lib/navigation-categories'

/**
 * The category list shared by the mobile drawer (2014:2505) and the desktop
 * dropdown panel (2016:2578). The two frames are the same component at two type
 * scales - 16px rows on mobile, 23px on desktop, with NEW COLLECTION jumping to
 * 34.56px - so they are one component here rather than two copies that drift.
 *
 * Links are plain, with an onNavigate callback, instead of SheetClose: the desktop
 * panel is not a Sheet and SheetClose only works inside one.
 */

type Gender = 'women' | 'men'

export type NavigationCategoriesLabels = {
  allProducts: string
  women: string
  men: string
}

interface NavigationCategoriesProps {
  lng: 'en' | 'he'
  variant: 'drawer' | 'panel'
  selectedGender: Gender
  onSelectGender: (gender: Gender) => void
  womenSubcategories: NavSubCategory[]
  menSubcategories: NavSubCategory[]
  hasMen: boolean
  labels: NavigationCategoriesLabels
  onNavigate?: () => void
  /**
   * Optional column rendered beside the category list. The desktop panel puts the
   * campaign imagery here (2016:2578 lays the list and the imagery as two equal
   * columns below the full-width tab row); the drawer passes nothing.
   */
  aside?: React.ReactNode
}

/** Category names arrive either as a plain string or as a {he,en} pair. */
function resolveName(name: unknown, lng: 'en' | 'he'): string {
  if (name && typeof name === 'object') {
    const pair = name as { he?: string; en?: string }
    return (lng === 'he' ? pair.he : pair.en) || pair.en || ''
  }
  return String(name ?? '')
}

export default function NavigationCategories({
  lng,
  variant,
  selectedGender,
  onSelectGender,
  womenSubcategories,
  menSubcategories,
  hasMen,
  labels,
  onNavigate,
  aside,
}: NavigationCategoriesProps) {
  const isPanel = variant === 'panel'
  const dir = lng === 'he' ? 'rtl' : 'ltr'

  // 2014:* (drawer) vs 2016:* (panel). Only the scale differs.
  //
  // The panel is deliberately smaller than its frame specifies. 2016:2578 is drawn on
  // a 1728px artboard where 23px rows and a 34.56px heading read as normal; on a real
  // desktop the panel is far wider, and at those sizes it dominated the viewport and
  // buried the hero. These values keep the design's hierarchy - the feature row still
  // steps above the category rows, which still step above their children - at a scale
  // that sits with the rest of the site. Rows stay at/above 44px so they remain
  // comfortable click targets.
  const rowText = isPanel ? 'text-[17px]' : 'text-[16px]'
  const plusText = isPanel ? 'text-[17px]' : 'text-[16px]'
  const featureText = isPanel ? 'text-[20px]' : 'text-[16px]'
  const featureLeading = isPanel ? 'leading-[26px]' : 'leading-[34.56px]'
  const childText = isPanel ? 'text-[15px]' : 'text-[16px]'
  const rowH = isPanel ? 'min-h-[46px]' : 'min-h-[58px]'
  const tabText = isPanel ? 'text-[16px]' : 'text-[19px]'

  const subcategories = selectedGender === 'women' ? womenSubcategories : menSubcategories

  const plus = (
    <span
      aria-hidden="true"
      className={`nav-plus font-ploni ${plusText} font-black leading-[23px] tracking-[-0.805px] text-text-primary transition-transform duration-200`}
    >
      ＋
    </span>
  )

  const childGrid = (children: React.ReactNode) => (
    // dir is explicit, not inherited: without it the grid fills left-to-right while
    // the text runs right-to-left, which pushes the first item into the left column.
    <div
      dir={dir}
      className="grid grid-cols-2 gap-x-[24px] gap-y-[11px] pb-[25px] pt-[16px]"
    >
      {children}
    </div>
  )

  const childLink = (key: string, href: string, label: string) => (
    <Link
      key={key}
      href={href}
      onClick={onNavigate}
      className={`block font-ploni ${childText} font-semibold leading-[19.077px] text-text-primary transition-opacity hover:opacity-70`}
      dir={dir}
      suppressHydrationWarning
    >
      {label}
    </Link>
  )

  return (
    <>
      {/* Department tabs. The active tab takes the surface-tab-active ground; the
          inactive one keeps a full-strength ground with its label dimmed. */}
      <div
        // dir is explicit for the same reason the category list below sets it: in
        // the drawer this renders inside a Radix ScrollArea, which stamps dir="ltr"
        // on its root when no DirectionProvider is present. Inherited, that put
        // נשים on the left of the pair instead of the inline start.
        dir={dir}
        // 44px on both. The frame gives the panel a 68px tab row, which at real
        // desktop width reads as a banner rather than a control strip.
        className="grid h-[44px] shrink-0 grid-cols-2 border-b border-sako-black"
      >
        <button
          onClick={() => onSelectGender('women')}
          className={`flex items-center justify-center transition-colors ${
            selectedGender === 'women' ? 'bg-surface-tab-active' : 'bg-surface-secondary'
          }`}
          aria-pressed={selectedGender === 'women'}
          suppressHydrationWarning
        >
          <span
            className={`font-ploni ${tabText} font-black leading-[19px] text-text-primary ${
              selectedGender === 'women' ? '' : 'opacity-20'
            }`}
          >
            {labels.women}
          </span>
        </button>
        {hasMen && (
          <button
            onClick={() => onSelectGender('men')}
            className={`flex items-center justify-center border-e border-sako-black transition-colors ${
              selectedGender === 'men' ? 'bg-surface-tab-active' : 'bg-surface-secondary'
            }`}
            aria-pressed={selectedGender === 'men'}
            suppressHydrationWarning
          >
            <span
              className={`font-ploni ${tabText} font-black leading-[19px] text-text-primary ${
                selectedGender === 'men' ? '' : 'opacity-20'
              }`}
            >
              {labels.men}
            </span>
          </button>
        )}
      </div>

      {/* dir is explicit so the list lands on the inline-start side and the aside on
          the other, matching the frame where the links sit right and the imagery left. */}
      <div dir={dir} className={aside ? 'grid grid-cols-2' : ''}>
      <div className={isPanel ? 'px-[28px] pb-[28px] pt-[8px]' : 'px-[16px]'}>
        {/* NEW COLLECTION row — the one row set in Black at the feature size. It points
            at the campaign page rather than the gender collection, so the label is the
            campaign's own name in both languages rather than a translated string, and
            it is the same row for either department. No ＋: the row has no children to
            disclose, and the glyph read as though it did. */}
        <Link
          href={`/${lng}/collection/campaign?slug=new-collection`}
          onClick={onNavigate}
          className={`flex ${rowH} items-center border-b border-sako-black`}
          dir={dir}
          suppressHydrationWarning
        >
          <span className={`font-ploni ${featureText} font-black ${featureLeading} text-text-primary`}>
            NEW COLLECTION
          </span>
        </Link>

        <Accordion type="single" collapsible className="w-full">
          {subcategories.map((subcategory) => {
            const hasChildren = Boolean(subcategory.subChildren && subcategory.subChildren.length > 0)
            const categoryName = resolveName(subcategory.name, lng)

            if (!hasChildren) {
              return (
                <div key={subcategory.id} data-nav-subcategory={subcategory.slug} className="border-b border-sako-black">
                  <Link
                    href={`/${lng}/collection/${selectedGender}/${subcategory.slug}`}
                    onClick={onNavigate}
                    className={`flex ${rowH} items-center justify-between transition-opacity hover:opacity-70`}
                    dir={dir}
                    suppressHydrationWarning
                  >
                    <span className={`font-ploni ${rowText} font-semibold leading-[23px] text-text-primary`}>
                      {categoryName}
                    </span>
                  </Link>
                </div>
              )
            }

            return (
              <AccordionItem
                key={subcategory.id}
                data-nav-subcategory={subcategory.slug}
                value={subcategory.id}
                className="border-b border-sako-black"
              >
                {/* The whole row expands, not just the ＋: a parent category's row is a
                    disclosure, because its children are what the row is for. The route
                    to the category page itself is the "show all" link that heads the
                    expanded child grid below - so the row never has to be both a link
                    and a toggle, which is what made tapping the name feel wrong.

                    Radix ships its own chevron; [&>svg]:hidden drops it so the design's
                    ＋ can rotate 45deg into the − instead. */}
                <AccordionTrigger
                  className={`${rowH} py-0 font-ploni ${rowText} font-semibold leading-[23px] text-text-primary hover:no-underline hover:opacity-70 [&>svg]:hidden [&[data-state=open]_.nav-plus]:rotate-45`}
                  dir={dir}
                >
                  <span className="flex w-full items-center justify-between">
                    <span>{categoryName}</span>
                    {plus}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-0">
                  {childGrid(
                    <>
                      {childLink(
                        `${subcategory.id}-all`,
                        `/${lng}/collection/${selectedGender}/${subcategory.slug}`,
                        labels.allProducts,
                      )}
                      {subcategory.subChildren?.map((child) =>
                        childLink(
                          child.id,
                          `/${lng}/collection/${selectedGender}/${subcategory.slug}/${child.slug}`,
                          resolveName(child.name, lng),
                        ),
                      )}
                    </>,
                  )}
                </AccordionContent>
              </AccordionItem>
            )
          })}

          {selectedGender === 'women' && (
            <AccordionItem value="women-nav-sales" className="border-b border-sako-black">
              <AccordionTrigger
                className={`${rowH} py-0 font-ploni ${rowText} font-semibold leading-[23px] text-text-primary hover:no-underline hover:opacity-70 [&>svg]:hidden [&[data-state=open]_.nav-plus]:rotate-45`}
                dir={dir}
              >
                <span className="flex w-full items-center justify-between">
                  <span>{womenSalesSectionTitle(lng)}</span>
                  {plus}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-0">
                {childGrid(
                  WOMEN_BOGO_NAV_LINKS.map((link) =>
                    childLink(link.slug, womenSalesCampaignHref(lng, link.slug), womenSalesLinkLabel(lng, link)),
                  ),
                )}
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
      {aside}
      </div>
    </>
  )
}
