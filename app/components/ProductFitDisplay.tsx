import {
  SIZE_FIT_OPTIONS,
  FOOT_WIDTH_FIT_OPTIONS,
  TOE_BOX_FIT_OPTIONS,
  INSTEP_FIT_OPTIONS,
  ARCH_FIT_OPTIONS,
  ADJUSTABLE_FEATURE_OPTIONS,
  getOptionLabel,
  isUndefinedFitValue,
  type SizeFit,
  type FootWidthFit,
  type ToeBoxFit,
  type InstepFit,
  type ArchFit,
  type AdjustableFeature,
} from '@/lib/product-enums'

export interface ProductFitDisplayData {
  sizeFit?: SizeFit
  footWidthFit?: FootWidthFit
  toeBoxFit?: ToeBoxFit
  instepFit?: InstepFit
  archFit?: ArchFit
  adjustableFeatures?: AdjustableFeature[]
  recommendation_en?: string
  recommendation_he?: string
  notes_en?: string
  notes_he?: string
}

interface ProductFitDisplayProps {
  fit: ProductFitDisplayData | null | undefined
  locale: 'en' | 'he'
}

const LABELS = {
  en: {
    heading: 'Fit & Sizing',
    sizeFit: 'Size fit',
    recommendedWidth: 'Recommended width',
    toeBoxFit: 'Toe-box fit',
    instepFit: 'Instep fit',
    archFit: 'Arch fit',
    adjustableFeatures: 'Adjustable features',
    recommendation: 'Recommendation',
    notes: 'Notes',
  },
  he: {
    heading: 'התאמה ומידות',
    sizeFit: 'התאמת מידה',
    recommendedWidth: 'רוחב מומלץ',
    toeBoxFit: 'מבנה קדמי',
    instepFit: 'התאמת גב כף הרגל',
    archFit: 'התאמת קשת כף הרגל',
    adjustableFeatures: 'אפשרויות התאמה',
    recommendation: 'המלצה',
    notes: 'הערות',
  },
} as const

/**
 * Reusable customer-facing shoe-fit summary. Not currently wired into the live
 * product page — built so the underlying data/API shape is ready to display
 * later without another database redesign. Rows whose value is "not yet
 * defined" (or empty) are omitted rather than shown to customers.
 */
export default function ProductFitDisplay({ fit, locale }: ProductFitDisplayProps) {
  if (!fit) return null

  const labels = LABELS[locale]
  const dir = locale === 'he' ? 'rtl' : 'ltr'

  const rows: { label: string; value: string }[] = []

  const sizeFitLabel = getOptionLabel(SIZE_FIT_OPTIONS, fit.sizeFit, locale)
  if (sizeFitLabel && !isUndefinedFitValue(fit.sizeFit)) {
    rows.push({ label: labels.sizeFit, value: sizeFitLabel })
  }

  const footWidthLabel = getOptionLabel(FOOT_WIDTH_FIT_OPTIONS, fit.footWidthFit, locale)
  if (footWidthLabel && !isUndefinedFitValue(fit.footWidthFit)) {
    rows.push({ label: labels.recommendedWidth, value: footWidthLabel })
  }

  const toeBoxLabel = getOptionLabel(TOE_BOX_FIT_OPTIONS, fit.toeBoxFit, locale)
  if (toeBoxLabel && !isUndefinedFitValue(fit.toeBoxFit)) {
    rows.push({ label: labels.toeBoxFit, value: toeBoxLabel })
  }

  const instepLabel = getOptionLabel(INSTEP_FIT_OPTIONS, fit.instepFit, locale)
  if (instepLabel && !isUndefinedFitValue(fit.instepFit)) {
    rows.push({ label: labels.instepFit, value: instepLabel })
  }

  const archLabel = getOptionLabel(ARCH_FIT_OPTIONS, fit.archFit, locale)
  if (archLabel && !isUndefinedFitValue(fit.archFit)) {
    rows.push({ label: labels.archFit, value: archLabel })
  }

  const adjustableFeatureLabels = (fit.adjustableFeatures ?? [])
    .filter((feature) => feature !== 'no_adjustment')
    .map((feature) => getOptionLabel(ADJUSTABLE_FEATURE_OPTIONS, feature, locale))
    .filter((label): label is string => !!label)
  if (adjustableFeatureLabels.length > 0) {
    rows.push({ label: labels.adjustableFeatures, value: adjustableFeatureLabels.join(locale === 'he' ? ', ' : ', ') })
  }

  const recommendation = locale === 'he' ? fit.recommendation_he : fit.recommendation_en
  if (recommendation) {
    rows.push({ label: labels.recommendation, value: recommendation })
  }

  const notes = locale === 'he' ? fit.notes_he : fit.notes_en
  if (notes) {
    rows.push({ label: labels.notes, value: notes })
  }

  if (rows.length === 0) return null

  return (
    <section dir={dir} className="border-t border-gray-200 pt-4 mt-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{labels.heading}</h3>
      <dl className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-2 text-sm">
            <dt className="text-gray-500 shrink-0">{row.label}:</dt>
            <dd className="text-gray-800">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
