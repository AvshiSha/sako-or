import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { languageMetadata } from '../../i18n/settings'

interface ProductLanguageSwitcherProps {
  currentLanguage: string;
  sku: string;
}

export default function ProductLanguageSwitcher({ currentLanguage, sku }: ProductLanguageSwitcherProps) {
  const searchParams = useSearchParams()
  
  // Preserve query parameters (size, color, etc.)
  const queryString = searchParams?.toString() || ''
  const queryParams = queryString ? `?${queryString}` : ''

  return (
    <div className="flex space-x-2">
      {Object.entries(languageMetadata).map(([code, meta]) => (
        <Link
          key={code}
          href={`/${code}/product/${sku}${queryParams}`}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
            currentLanguage === code
              ? 'bg-gray-900 text-white shadow-md'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
          }`}
          title={`${meta.name} - ${meta.nativeName}`}
        >
          <span className="mr-2">{meta.flag}</span>
          {code.toUpperCase()}
        </Link>
      ))}
    </div>
  )
}
