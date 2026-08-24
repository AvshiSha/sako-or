'use client'

import dynamic from 'next/dynamic'
import { Search } from 'lucide-react'

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
    <div className="relative">
      <div
        className="text-gray-700 p-2 rounded-md flex items-center justify-center"
        aria-hidden="true"
      >
        <Search className="h-5 w-5" />
      </div>
    </div>
  )
}

function InlineLoading() {
  return (
    <div className="relative">
      <input
        type="text"
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        // Mirrors the real input's box: same padding, border and radius. The
        // icon uses `start-3` rather than left/right so it lands correctly
        // under both dir="ltr" and dir="rtl" without needing the language prop.
        className="w-full bg-gray-100 border border-gray-300 rounded-md py-2.5 ps-10 pe-4 text-gray-700 outline-none"
      />
      <span
        className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-500"
        aria-hidden="true"
      >
        <Search className="h-5 w-5" />
      </span>
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

  // Fixed 36x36 slot. Belt and braces alongside the `loading` placeholder: even
  // if the chunk fails outright, or a future edit changes what SearchBar
  // renders, the header's icon cluster keeps its width and the centred menu
  // cannot move.
  return (
    <div className="relative h-9 w-9 shrink-0">
      <DefaultSearchBar language={language} variant="default" />
    </div>
  )
}
