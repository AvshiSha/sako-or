'use client'

import { useTranslation } from 'react-i18next'
import { useParams } from 'next/navigation'

export default function About() {
  const { t } = useTranslation()
  const params = useParams()
  const lng = params.lng as string

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            {t('about.title')}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t('about.description')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 transform transition duration-300 hover:scale-105">
            <div className="flex flex-col items-center text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                {t('about.mission.title')}
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t('about.mission.description')}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8 transform transition duration-300 hover:scale-105">
            <div className="flex flex-col items-center text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                {t('about.vision.title')}
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t('about.vision.description')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-24 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              {t('about.heritage')}
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              {t('about.heritageText')}
            </p>
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">
              {t('about.craftsmanship')}
            </h3>
            <p className="text-lg text-gray-600 leading-relaxed">
              {t('about.craftsmanshipText')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 