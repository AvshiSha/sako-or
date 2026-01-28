import Link from 'next/link'
import { languageMetadata } from '../../i18n/settings'

interface LanguageSwitcherProps {
  currentLanguage: string;
}

export default function LanguageSwitcher({ currentLanguage }: LanguageSwitcherProps) {
  return (
    <div className="flex space-x-2">
      {Object.entries(languageMetadata).map(([code, meta]) => (
        <Link
          key={code}
          href={`/${code}`}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
            currentLanguage === code
              ? 'bg-gray-900 text-white shadow-md'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
          }`}
          title={`${meta.name} - ${meta.nativeName}`}
        >
          {code.toUpperCase()}
        </Link>
      ))}
    </div>
  )
} 