'use client'

// ProductLink, not next/link: the PDP now has a loading boundary, and prefetching
// a dynamic route that has one intermittently renders an empty page instead of the
// skeleton. See ProductLink - do not swap this back. Enforced by eslint.
import ProductLink from '@/app/components/ProductLink'
import { useSearchParams } from 'next/navigation'
import { languageMetadata } from '../../i18n/settings'
import { Suspense } from 'react'

interface ProductLanguageSwitcherProps {
  currentLanguage: string;
  sku: string;
}

function ProductLanguageSwitcherInner({ currentLanguage, sku }: ProductLanguageSwitcherProps) {
  const searchParams = useSearchParams()
  
  // Preserve query parameters (size, color, etc.)
  const queryString = searchParams?.toString() || ''
  const queryParams = queryString ? `?${queryString}` : ''

  return (
    <div className="flex space-x-2">
      {Object.entries(languageMetadata).map(([code, meta]) => (
        <ProductLink
          key={code}
          href={`/${code}/product/${sku}${queryParams}`}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
            currentLanguage === code
              ? 'bg-gray-900 text-white shadow-md'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
          }`}
          title={`${meta.name} - ${meta.nativeName}`}
        >
          {code.toUpperCase()}
        </ProductLink>
      ))}
    </div>
  )
}

export default function ProductLanguageSwitcher({ currentLanguage, sku }: ProductLanguageSwitcherProps) {
  return (
    <Suspense fallback={
      <div className="flex space-x-2">
        {Object.entries(languageMetadata).map(([code, meta]) => (
          <ProductLink
            key={code}
            href={`/${code}/product/${sku}`}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
              currentLanguage === code
                ? 'bg-gray-900 text-white shadow-md'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
            }`}
            title={`${meta.name} - ${meta.nativeName}`}
          >
            {code.toUpperCase()}
          </ProductLink>
        ))}
      </div>
    }>
      <ProductLanguageSwitcherInner currentLanguage={currentLanguage} sku={sku} />
    </Suspense>
  )
}
