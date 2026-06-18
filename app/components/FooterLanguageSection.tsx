'use client'

import { Suspense } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { languageMetadata } from '../../i18n/settings'

type FooterLanguageSectionProps = {
  lng: string
  languageLabel: string
  hebrewLabel: string
  englishLabel: string
}

function FooterLanguageSectionInner({
  lng,
  languageLabel,
  hebrewLabel,
  englishLabel,
}: FooterLanguageSectionProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleLanguageChange = (newLanguage: string) => {
    if (!pathname) return

    const pathSegments = pathname.split('/')
    if (pathSegments[1] && Object.keys(languageMetadata).includes(pathSegments[1])) {
      pathSegments[1] = newLanguage
    } else {
      pathSegments.splice(1, 0, newLanguage)
    }

    const queryString = searchParams?.toString() || ''
    const queryParams = queryString ? `?${queryString}` : ''

    router.push(pathSegments.join('/') + queryParams)
  }

  return (
    <details className="group border-b border-black/20">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center uppercase px-4 text-sm font-bold tracking-wide [&::-webkit-details-marker]:hidden">
        {`${languageLabel} / ${lng.toUpperCase()}`}
      </summary>
      <div className="px-4 pb-4">
        <ul className="space-y-3">
          <li>
            <button
              type="button"
              onClick={() => handleLanguageChange('he')}
              className={`block w-full text-sm text-right hover:opacity-70 transition-opacity ${lng === 'he' ? 'font-bold' : ''}`}
            >
              {hebrewLabel}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className={`block w-full text-sm text-right hover:opacity-70 transition-opacity ${lng === 'en' ? 'font-bold' : ''}`}
            >
              {englishLabel}
            </button>
          </li>
        </ul>
      </div>
    </details>
  )
}

function FooterLanguageSectionFallback({
  lng,
  languageLabel,
}: Pick<FooterLanguageSectionProps, 'lng' | 'languageLabel'>) {
  return (
    <details className="group border-b border-black/20">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center uppercase px-4 text-sm font-bold tracking-wide [&::-webkit-details-marker]:hidden">
        {`${languageLabel} / ${lng.toUpperCase()}`}
      </summary>
    </details>
  )
}

export default function FooterLanguageSection(props: FooterLanguageSectionProps) {
  return (
    <Suspense fallback={<FooterLanguageSectionFallback lng={props.lng} languageLabel={props.languageLabel} />}>
      <FooterLanguageSectionInner {...props} />
    </Suspense>
  )
}
