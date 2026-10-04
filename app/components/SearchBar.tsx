'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { Product } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import ProductCard from './ProductCard'
import Loader from './ui/Loader'

type SearchResultProduct = Product & { matchedColorSlug?: string }

interface SearchBarProps {
  language: string
  variant?: 'default' | 'inline'
}

/**
 * The design's own 22px magnifier (2014:2511), at the 0.9167 stroke the file
 * vectors it with. lucide's <Search> was being used in both variants at two
 * different stroke weights, neither of which was the design's, and neither of
 * which matched the sibling header glyphs - which are these same assets.
 */
const SEARCH_ICON = '/icons/sako/search.svg'

/**
 * Search field, design system 2014:2509.
 *
 * A 36px white cell with a 1px black rule and square corners: the whole control
 * is that rule, as everywhere else in this system. Placeholder is Ploni DemiBold
 * 16/23 in text-primary at 30% - a real opacity, not a grey, which is why it is
 * written as two utilities rather than a text-gray-* token.
 *
 * Laid out with flex rather than absolute insets because the frame itself is
 * `justify-between`: the value runs from the reading start and the magnifier sits
 * hard against the opposite edge, its 22px glyph centred in a 32px box so it
 * clears the rule by the frame's 5px. Flex reverses on its own under dir="rtl",
 * so this lands pixel-identical to the Hebrew frame and mirrors for /en for free
 * - no logical-inset arithmetic, and none of the traps that come with it.
 *
 * NOTE this reverses an earlier reading of the frame. The magnifier was pinned to
 * the physical left in both directions on the grounds that "the design keeps it
 * there in an RTL frame". But the file's artboards are LTR frames with Hebrew
 * copy set in them, so that frame's visual left is the reading END - pinning it
 * left made the glyph trail the value in Hebrew and lead it in English, which is
 * why the clear button then had to sit between the magnifier and the text in
 * /en. Read as a logical end, both locales agree and the clear button lands
 * where it belongs, just inside the submit.
 *
 * GAP: 2014:2509 is a lone symbol - no focus, filled or disabled variant, the
 * same omission field.tsx (438:2751) records for the form input. Focus follows
 * the precedent field.tsx set: the rule, which IS the control, thickens 1px -> 2px
 * in ink-900 and nothing moves. Drawn as an outline at a -2px offset rather than
 * border-2 so the thickening happens inside the box: a border swap would grow the
 * cell 2px and shove the panel's whole first row. No ring and no glow - this
 * system draws neither.
 */
function SearchField({
  value,
  onChange,
  onClear,
  placeholder,
  inputRef,
  submitLabel,
  clearLabel,
  className,
  ...inputProps
}: {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder: string
  inputRef: React.RefObject<HTMLInputElement | null>
  submitLabel: string
  clearLabel: string
  className?: string
} & Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'placeholder' | 'className' | 'ref'>) {
  return (
    <div
      className={cn(
        'flex h-[36px] items-center border border-sako-black bg-surface-primary',
        'outline-sako-ink-900 focus-within:outline-2 focus-within:-outline-offset-2',
        className
      )}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        // The virtual keyboard's action key should say "search", not "go".
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 border-0 bg-transparent ps-[16px] font-ploni text-[16px] font-semibold leading-[23px] text-text-primary outline-none placeholder:text-text-primary placeholder:opacity-30"
        {...inputProps}
      />

      {value && (
        <button
          type="button"
          onClick={onClear}
          // Inside the submit, not outside it: the magnifier is the frame's one
          // fixed element at that edge, so the clear tucks in beside the value.
          className="flex h-[29px] w-[24px] shrink-0 items-center justify-center text-text-primary transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
          aria-label={clearLabel}
        >
          <X className="h-[16px] w-[16px]" strokeWidth={1.25} aria-hidden="true" />
        </button>
      )}

      <button
        type="submit"
        // 32x29 box around the 22px glyph, per 2014:2510 - that is what puts the
        // magnifier 5px off the rule without a single positioning utility.
        className="flex h-[29px] w-[32px] shrink-0 items-center justify-center transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        aria-label={submitLabel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SEARCH_ICON} width={22} height={22} alt="" aria-hidden="true" />
      </button>
    </div>
  )
}

export default function SearchBar({ language, variant = 'default' }: SearchBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResultProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previousPathnameRef = useRef<string>(pathname)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const bandRef = useRef<HTMLDivElement>(null)
  const [panelMaxH, setPanelMaxH] = useState<number | null>(null)
  const panelId = useId()

  const isRTL = language === 'he'

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    const debounceTimer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/products/search?q=${encodeURIComponent(searchQuery)}&limit=8`
        )
        const data = await response.json().catch(() => ({}))
        setSearchResults(data.items || [])
        setShowResults(true)
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
      } finally {
        setIsLoading(false)
      }
    }, 400) // 400ms debounce

    return () => clearTimeout(debounceTimer)
  }, [searchQuery, language])

  // Close search when pathname changes (navigation occurred)
  useEffect(() => {
    if (pathname !== previousPathnameRef.current) {
      if (variant === 'default' && isExpanded) {
        setIsExpanded(false)
      }
      setSearchQuery('')
      setShowResults(false)
    }
    previousPathnameRef.current = pathname
  }, [pathname, isExpanded, variant])

  // Close on click outside (but not when QuickBuyDrawer is open or clicking on product cards)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      // Don't close if clicking on QuickBuyDrawer (size selector, panel, etc.)
      const isDrawerElement = target.closest('[data-quick-buy-drawer]')
      if (isDrawerElement) {
        return // Don't close search overlay when interacting with the drawer
      }

      // Fallback: Headless UI Dialog (used by QuickBuyDrawer)
      const drawerDialog = document.querySelector('[role="dialog"]')
      const isLegacyDrawerElement = drawerDialog && (
        drawerDialog.contains(target) ||
        target === drawerDialog ||
        target.closest('.fixed.inset-0.bg-black\\/20')
      )
      if (isLegacyDrawerElement) {
        return
      }

      // Don't close if clicking on a Link (product card navigation)
      // Let the Link handle navigation first, then close via pathname change
      const isLinkClick = target.closest('a[href]')
      if (isLinkClick && searchContainerRef.current?.contains(target)) {
        // Let the link handle navigation, pathname change will close the search
        return
      }

      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        if (variant === 'default') {
          setIsExpanded(false)
        }
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [variant])

  // Handle Escape key - close drawer first, then search overlay
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Check if QuickBuyDrawer is open by looking for Dialog elements
        const drawerDialog = document.querySelector('[role="dialog"][data-headlessui-state]')
        if (drawerDialog) {
          // Drawer is open - let it handle Escape first
          // The drawer will close itself, we don't need to do anything
          return
        }

        // No drawer open, close search
        if (variant === 'default' && isExpanded) {
          setIsExpanded(false)
        }
        if (showResults) {
          setShowResults(false)
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isExpanded, showResults, variant])

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isExpanded])

  /**
   * Cap the preview at the real distance from the field band's underside to the
   * bottom of the viewport.
   *
   * The obvious `max-h-[calc(100vh-var(--nav-bar-h))]` - which the MENU panel
   * uses - is wrong here, and measurably so: nothing in the app ever sets
   * --nav-bar-h, so it resolves to the 73px fallback, which is the nav bar alone.
   * The sticky header also carries the promo band above the bar, so a panel so
   * capped starts ~98px down while being allowed to grow 827px, and its last
   * ~25px sit below the fold where nothing can scroll to them. The MENU panel
   * gets away with it because a category list rarely reaches the cap.
   *
   * Measured off the band rather than the nav or this button so the promo band,
   * the field row's own height, and any future row in the header are all
   * accounted for by construction. No circularity: the preview is absolutely
   * positioned and therefore out of flow, so its height can never feed back into
   * the band's. Layout effect, not effect, so the cap is in place for the first
   * paint - and only ever while open, so nothing is listening the rest of the time.
   */
  useLayoutEffect(() => {
    if (variant !== 'default' || !isExpanded) return

    const measure = () => {
      const band = bandRef.current
      if (!band) return
      const available = window.innerHeight - band.getBoundingClientRect().bottom
      // Half the viewport, never more. Fitting the preview to the space available
      // is not the same as it being a preview: at 1728x900 the eight cards come to
      // ~710px and simply reach the fold, which is how the open search ended up
      // reading as a collection page. Capping it at half leaves a real band of the
      // page in view underneath - the thing that makes it read as a panel over the
      // site rather than a replacement for it - and the second row is still one
      // scroll away, so all eight results are kept.
      setPanelMaxH(Math.max(0, Math.min(available, window.innerHeight * 0.5)))
    }

    measure()
    window.addEventListener('resize', measure)
    // The header is sticky, so its underside does not move while pinned - but it
    // does between scrollTop 0 and pinned if anything above it collapses.
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [isExpanded, variant])

  const handleSearchIconClick = () => {
    // Search icon only expands/collapses the search bar
    setIsExpanded(!isExpanded)
    if (isExpanded) {
      setSearchQuery('')
      setShowResults(false)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/${language}/collection?search=${encodeURIComponent(searchQuery.trim())}`)
      if (variant === 'default') {
        setIsExpanded(false)
      }
      setSearchQuery('')
      setShowResults(false)
    }
  }

  const handleSearchButtonClick = () => {
    if (searchQuery.trim()) {
      router.push(`/${language}/collection?search=${encodeURIComponent(searchQuery.trim())}`)
      if (variant === 'default') {
        setIsExpanded(false)
      }
      setSearchQuery('')
      setShowResults(false)
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setShowResults(false)
    inputRef.current?.focus()
  }


  const translations = {
    en: {
      search: 'Search products...',
      searchInline: 'Search for a brand name, products and more...',
      searchButton: 'Search',
      searching: 'Searching...',
      noResults: 'No products found',
      clear: 'Clear search',
      close: 'Close search',
      open: 'Search',
      resultsCount: (count: number) => `${count} result${count !== 1 ? 's' : ''} found, to see more products click here`
    },
    he: {
      search: 'חיפוש מוצרים...',
      searchInline: 'חפשו שם של מותג, מוצרים ועוד...',
      searchButton: 'חיפוש',
      searching: 'מחפש...',
      noResults: 'לא נמצאו מוצרים',
      clear: 'ניקוי החיפוש',
      close: 'סגירת החיפוש',
      open: 'חיפוש',
      resultsCount: (count: number) => `נמצאו ${count} תוצאות, לעוד מוצרים לחצו על כפתור החיפוש`
    }
  }

  const t = translations[language as keyof typeof translations] || translations.en

  /**
   * 12px label with the 1.2px tracking the ruled section header uses (438:3332):
   * the count sits at the reading start, the action opposite it, on a hairline.
   * The same row serves both variants, which is most of what makes the two read
   * as one component at two sizes.
   */
  const resultsHeader = (
    <div
      // No border-t: in both variants this is the first child of a panel that
      // already draws its own rule there, and the two would stack to 2px. The
      // grid below supplies the rule under this row.
      className="flex items-center justify-between gap-[16px] px-[16px] py-[14px]"
    >
      <p
        className="font-ploni text-[12px] leading-[1.2] tracking-[1.2px] text-text-secondary"
        role="status"
      >
        {t.resultsCount(searchResults.length)}
      </p>
      <button
        type="button"
        onClick={handleSearchButtonClick}
        className="shrink-0 whitespace-nowrap border-b border-sako-black pb-[2px] font-ploni text-[12px] font-semibold uppercase leading-[1.2] tracking-[1.2px] text-text-primary transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
      >
        {t.searchButton}
      </button>
    </div>
  )

  /**
   * Results body, shared by both variants. The grid is deliberately gapless and
   * full-bleed: ProductCard draws its own `border-b border-l`, so the cards butt
   * together and those rules become the lattice - exactly how the collection
   * grid is built (COLLECTION_GRID_ROW_GAP_PX is 0 for the same reason). Any gap
   * here reappears as a white hairline between cards and the panel stops looking
   * like the listing it is previewing.
   */
  const resultsBody = (
    <>
      {isLoading ? (
        <div className="flex flex-col items-center gap-[12px] px-[16px] py-[48px]">
          <Loader overlay={false} size={48} label={t.searching} />
          <p className="font-ploni text-[14px] leading-none text-text-secondary">{t.searching}</p>
        </div>
      ) : searchResults.length > 0 ? (
        <>
          {resultsHeader}
          {/* Four up in both variants. On desktop the preview is a fixed 681px, so
              the columns are fixed too - there is no viewport for them to respond
              to. 681/4 lands each card at ~170px, within a dozen pixels of the
              159px the phone gives it, which is the whole point: same card, same
              scale, two surfaces. */}
          <div
            className={cn(
              'grid border-t border-sako-black',
              variant === 'default' ? 'grid-cols-4' : 'grid-cols-2'
            )}
          >
            {searchResults.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                language={language as 'en' | 'he'}
                preselectedColorSlug={product.matchedColorSlug}
              />
            ))}
          </div>
        </>
      ) : searchQuery.trim() ? (
        <div className="flex flex-col items-center gap-[14px] px-[16px] py-[48px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SEARCH_ICON} width={32} height={32} alt="" aria-hidden="true" className="opacity-30" />
          <p className="font-ploni text-[16px] font-semibold leading-[23px] text-text-secondary">
            {t.noResults}
          </p>
        </div>
      ) : null}
    </>
  )

  // Inline variant for mobile navigation
  if (variant === 'inline') {
    return (
      <div ref={searchContainerRef} className="relative">
        <form onSubmit={handleSearchSubmit}>
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={handleClearSearch}
            placeholder={t.searchInline}
            inputRef={inputRef}
            submitLabel={t.searchButton}
            clearLabel={t.clear}
            className="w-full"
          />

          {/* Full-width CTA under the field once there is something to search for.
              54px and ink-900 with a paper label - the system's own CTA bar
              (438:7682 State=Filled), not a one-off button. Kept for the inline
              variant only: on a phone the magnifier is a 32px target inside the
              field, so the committing action deserves a bar of its own. Desktop
              submits from the magnifier or the results header. */}
          {searchQuery.trim() && (
            <button
              type="submit"
              className="mt-[8px] flex h-[54px] w-full items-center justify-center rounded-none border border-btn-primary-bg bg-btn-primary-bg px-[19px] font-ploni text-[16px] font-bold leading-none text-btn-primary-text transition-colors hover:bg-sako-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
            >
              {t.searchButton}
            </button>
          )}
        </form>

        {/* Results. Square, ruled, on the paper ground - the same surface the
            desktop panel uses, scaled down. The old treatment (rounded-lg,
            shadow-2xl, gray-200) is the one thing in this drawer that was still
            drawn in the pre-redesign style.

            min-h-0 on the scroller is load-bearing: a flex child's default
            min-height is auto, so without it the inner list grows past the 70vh
            cap instead of scrolling inside it. */}
        {showResults && (
          <div className="absolute inset-x-0 top-full z-50 mt-[8px] flex max-h-[70vh] flex-col overflow-hidden border border-sako-black bg-surface-secondary">
            <div className="min-h-0 overflow-y-auto">{resultsBody}</div>
          </div>
        )}
      </div>
    )
  }

  /**
   * Desktop.
   *
   * The header (438:4392) draws search as a bare magnifier and nothing else -
   * there is no expanded field anywhere in the file - so the open state is
   * composed rather than transcribed. It is built as the MENU panel
   * (Navigation.tsx, 2016:2578): a full-bleed band dropping from under the bar,
   * ruled on top, on the paper ground, height following its content and capped at
   * the viewport. That is the point - the bar has exactly two things that open,
   * and they should open the same surface. What was there before was a floating
   * rounded card with a shadow and a dimmed backdrop, three things this system
   * does not have.
   *
   * No scrim, for the same reason: the MENU panel does not dim the page either,
   * and click-outside already closes this one.
   */
  return (
    // Deliberately NOT `relative`. The panel below is `absolute ... top-full`, and
    // the ancestor it resolves against has to be the nav's bar row
    // (Navigation.tsx `relative flex ${NAV_BAR_H}`) so the band hangs off the bar
    // itself. The header is sticky and carries the promo band above it, so the
    // bar's distance from the viewport top is not a constant - which is what made
    // the old `fixed top-26` wrong: it detached from the header as soon as the
    // promo band was showing. LazySearchBar's slot drops its `relative` to match.
    <div ref={searchContainerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleSearchIconClick}
        // Same 32x36 box and 22px glyph as the favourites / account / cart links
        // beside it. It was a 36x36 p-2 button around a 20px lucide icon, so the
        // one icon in the cluster that was not the design's was also the only one
        // a different size.
        className="flex h-[36px] w-[32px] items-center justify-center transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        aria-label={isExpanded ? t.close : t.open}
        aria-expanded={isExpanded}
        aria-controls={panelId}
      >
        {isExpanded ? (
          // The control becomes its own dismiss while the panel is open - the
          // active state the frame never drew, built from the drawer's close
          // glyph (22px lucide X at 1.25) so it is not a new piece of vocabulary.
          <X className="h-[22px] w-[22px] text-text-primary" strokeWidth={1.25} aria-hidden="true" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={SEARCH_ICON} width={22} height={22} alt="" aria-hidden="true" />
        )}
      </button>

      {isExpanded && (
        <div
          id={panelId}
          // The bar forces dir="ltr" on itself because it holds no directional
          // text. This panel does, so it has to restate the real direction - the
          // MENU panel restates it for the same reason.
          dir={isRTL ? 'rtl' : 'ltr'}
          // -left/-right cancel the nav's 36px desktop gutter so the band runs
          // edge to edge. Physical, not logical, on purpose: they cancel a
          // physical padding and must not swap under RTL. Measured off the
          // parent rather than 100vw, which would overshoot by the scrollbar.
          // No overflow here any more: the band is only ever the field row now,
          // and the preview below is a positioned child that has to be allowed to
          // hang outside it.
          className="absolute -left-[36px] -right-[36px] top-full z-[70] border-t border-sako-black bg-surface-secondary"
        >
          <div ref={bandRef}>
            <form onSubmit={handleSearchSubmit} className="px-[36px] py-[24px]">
              <SearchField
                value={searchQuery}
                onChange={setSearchQuery}
                onClear={handleClearSearch}
                placeholder={t.search}
                inputRef={inputRef}
                submitLabel={t.searchButton}
                clearLabel={t.clear}
                // 681px is the system's form measure (checkout 438:2725). A field
                // stretched across a 1728px band is unreadable and reads as
                // chrome; this keeps it at the width the system already gives its
                // inputs.
                className="w-full max-w-[681px]"
              />
            </form>
          </div>

          {/* Results preview.

              A panel of its own hanging under the band rather than more band:
              eight full-width cards made the open search read as a collection
              page that had replaced the site. This is the phone's construction at
              desktop scale - square, ruled, on the paper ground - pinned to the
              field's own start edge and cut to the field's own width, so it reads
              as that field's preview and not as a second page.

              Because it is 681px and the band's bottom edge carries no rule, the
              page stays visible around and below it, which is the point.

              start-[36px] rather than left: it inherits the panel's dir, so it
              tracks the field to the right-hand gutter in Hebrew. The band's own
              bleed is physical (-left/-right) because that cancels a physical
              padding; this tracks content, so it is logical. */}
          {showResults && (
            <div
              // max-h-[50vh] is the static expression of the same rule, in case
              // this ever paints before the measurement lands.
              className="absolute top-full start-[36px] max-h-[50vh] w-[681px] max-w-[calc(100%-72px)] overflow-y-auto border border-sako-black bg-surface-secondary"
              style={panelMaxH !== null ? { maxHeight: panelMaxH } : undefined}
            >
              {resultsBody}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
