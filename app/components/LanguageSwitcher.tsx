import Link from 'next/link'

interface LanguageSwitcherProps {
  currentLanguage: string;
}

export default function LanguageSwitcher({ currentLanguage }: LanguageSwitcherProps) {
  return (
    <div className="flex space-x-2">
      <Link
        href={`/en`}
        className={`px-2 py-1 text-sm font-medium rounded-md ${
          currentLanguage === 'en'
            ? 'bg-gray-900 text-white'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
        }`}
      >
        EN
      </Link>
      <Link
        href={`/he`}
        className={`px-2 py-1 text-sm font-medium rounded-md ${
          currentLanguage === 'he'
            ? 'bg-gray-900 text-white'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
        }`}
      >
        HE
      </Link>
    </div>
  )
} 