'use client'

import dynamic from 'next/dynamic'

type LazySearchBarProps = {
  language: string
  variant?: 'default' | 'inline'
}

/**
 * Placeholders shown while the SearchBar chunk is still downloading.
 *
 * next/dynamic renders *nothing* unless it is given a `loading` component, and
 * this component used to gate on a `mounted` flag as well. The two together
 * meant the search control existed in the server HTML, vanished the moment
 * hydration flipped `mounted`, and only came back once the chunk landed -
 * measured at ~110ms on a warm local connection and ~460ms on throttled 4G.
 *
 * That gap removed 52px (the 36px control plus the 16px `space-x-4` gap) from
 * the header's icon cluster. The desktop menu lives in a `flex-1 justify-center`
 * track between the logo and that cluster, so it slid 26px sideways and then
 * 26px back - the visible "jump", and two layout-shift entries per page load.
 *
 * These placeholders therefore have to keep the exact box of the real control.
 * They are prop-free because `loading` receives no props, so anything that
 * varies by language is deliberately left out rather than guessed at.
 */
function DefaultLoading() {
  return (
    <div
      className="flex h-[36px] w-[32px] items-center justify-center"
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/sako/search.svg" width={22} height={22} alt="" />
    </div>
  )
}

function InlineLoading() {
  return (
    // The real field, 2014:2509: 36px, square, 1px black rule, white ground, the
    // 22px magnifier in its 32px box at the reading end. Flex rather than an
    // absolutely placed icon for the same reason the real one is - it mirrors
    // under dir="rtl" by itself, so this needs no language prop either.
    <div
      className="flex h-[36px] w-full items-center border border-sako-black bg-surface-primary"
      aria-hidden="true"
    >
      <div className="h-full flex-1" />
      <div className="flex h-[29px] w-[32px] shrink-0 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/sako/search.svg" width={22} height={22} alt="" />
      </div>
    </div>
  )
}

// Two wrappers over the same module so each variant gets a correctly sized
// fallback. Webpack dedupes them into a single chunk.
const DefaultSearchBar = dynamic(() => import('./SearchBar'), {
  ssr: false,
  loading: DefaultLoading,
})

const InlineSearchBar = dynamic(() => import('./SearchBar'), {
  ssr: false,
  loading: InlineLoading,
})

export default function LazySearchBar({ language, variant = 'default' }: LazySearchBarProps) {
  if (variant === 'inline') {
    return (
      <div className="relative w-full">
        <InlineSearchBar language={language} variant="inline" />
      </div>
    )
  }

  // Fixed 32x36 slot - the design's icon box (438:4392), the same one the
  // favourites, account and cart links occupy. Belt and braces alongside the
  // `loading` placeholder: even if the chunk fails outright, or a future edit
  // changes what SearchBar renders, the header's icon cluster keeps its width
  // and the centred wordmark cannot move.
  //
  // No `relative`: SearchBar's desktop panel hangs off the nav's bar row with
  // `absolute ... top-full`, so nothing between the two may establish a
  // containing block or the band detaches from the header and loses its bleed.
  return (
    <div className="h-[36px] w-[32px] shrink-0">
      <DefaultSearchBar language={language} variant="default" />
    </div>
  )
}
