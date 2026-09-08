import {
  ADJUSTABLE_FEATURE_OPTIONS,
  ARCH_FIT_OPTIONS,
  CLOSURE_TYPE_OPTIONS,
  FOOT_WIDTH_FIT_OPTIONS,
  HEEL_TYPE_OPTIONS,
  INSOLE_OPTIONS,
  LINING_OPTIONS,
  OUTSOLE_OPTIONS,
  SIZE_FIT_OPTIONS,
  SOLE_TYPE_OPTIONS,
  TOE_SHAPE_OPTIONS,
  UPPER_MATERIAL_OPTIONS,
  getOptionLabel,
  getOptionLabels,
  isUndefinedFitValue,
  optionsForGroup,
  type EnumOption,
} from '@/lib/product-enums'

/**
 * The public enum surface of the Chatbase product API.
 *
 * These are not new values: they are the project's own stored enums from
 * lib/product-enums.ts, which already keeps stable machine values apart from
 * `label_en`/`label_he` display text. This module exists so there is exactly
 * one place that decides which of them a Chatbase caller may filter on, and one
 * place that rejects everything else.
 *
 * `toeBoxFit` and `instepFit` are deliberately absent. The Postgres columns
 * exist but nothing populates them (0 of 270 products) and they are not in the
 * Firestore `shoeFit` shape at all, so exposing them would only ever return
 * nothing.
 */

/** Filters whose accepted values come straight from a stored enum. */
export const SPEC_FILTERS = {
  upperMaterials: { options: UPPER_MATERIAL_OPTIONS, column: 'upperMaterial', kind: 'array' },
  liningMaterials: { options: LINING_OPTIONS, column: 'lining', kind: 'single' },
  insoleMaterials: { options: INSOLE_OPTIONS, column: 'insole', kind: 'single' },
  outsoleMaterials: { options: OUTSOLE_OPTIONS, column: 'outsole', kind: 'single' },
  soleTypes: { options: SOLE_TYPE_OPTIONS, column: 'soleType', kind: 'single' },
  heelTypes: { options: HEEL_TYPE_OPTIONS, column: 'heelType', kind: 'single' },
  toeShapes: { options: TOE_SHAPE_OPTIONS, column: 'toeShape', kind: 'single' },
  // A shoe never has a turn-lock: narrow the shared closure vocabulary to the
  // footwear options, so a bag-only value is rejected rather than silently
  // matching nothing.
  closureTypes: {
    options: optionsForGroup(CLOSURE_TYPE_OPTIONS, 'shoes'),
    column: 'closureType',
    kind: 'single',
  },
  sizeFits: { options: SIZE_FIT_OPTIONS, column: 'sizeFit', kind: 'single' },
  footWidthFits: { options: FOOT_WIDTH_FIT_OPTIONS, column: 'footWidthFit', kind: 'single' },
  archFits: { options: ARCH_FIT_OPTIONS, column: 'archFit', kind: 'single' },
  adjustableFeatures: {
    options: ADJUSTABLE_FEATURE_OPTIONS,
    column: 'adjustableFeatures',
    kind: 'array',
  },
} as const satisfies Record<
  string,
  { options: EnumOption<string>[]; column: string; kind: 'single' | 'array' }
>

export type SpecFilterKey = keyof typeof SPEC_FILTERS

export const SPEC_FILTER_KEYS = Object.keys(SPEC_FILTERS) as SpecFilterKey[]

/**
 * `'undefined'` is a real stored value on the fit fields meaning "nobody has
 * filled this in". Accepting it as a filter would turn "suits a wide foot" into
 * "suits a wide foot, or nobody checked" - exactly the false positive this API
 * exists to prevent. Filtering by it is rejected like any unknown value.
 */
function selectableValues(options: EnumOption<string>[]): string[] {
  return options.map((option) => option.value).filter((value) => !isUndefinedFitValue(value))
}

let valueIndex: Map<SpecFilterKey, Set<string>> | null = null

function getValueIndex(): Map<SpecFilterKey, Set<string>> {
  if (valueIndex) return valueIndex
  const index = new Map<SpecFilterKey, Set<string>>()
  for (const key of SPEC_FILTER_KEYS) {
    index.set(key, new Set(selectableValues([...SPEC_FILTERS[key].options])))
  }
  valueIndex = index
  return index
}

/** Every value a caller may send for one filter, for schemas and error messages. */
export function allowedValuesFor(key: SpecFilterKey): string[] {
  return [...(getValueIndex().get(key) ?? [])].sort()
}

export function isAllowedValue(key: SpecFilterKey, value: string): boolean {
  return getValueIndex().get(key)?.has(value) ?? false
}

/**
 * Values the caller sent that this filter does not accept. An empty array means
 * everything was recognised. Callers turn a non-empty result into a 400 - an
 * unknown filter is never silently dropped, because dropping it would widen the
 * search past what the customer asked for.
 */
export function unknownValuesFor(key: SpecFilterKey, values: readonly string[]): string[] {
  return values.filter((value) => !isAllowedValue(key, value))
}

/** Localised label for a stored value, or undefined when there is no translation. */
export function labelFor(
  key: SpecFilterKey,
  value: string | null | undefined,
  locale: 'en' | 'he'
): string | undefined {
  if (isUndefinedFitValue(value)) return undefined
  return getOptionLabel([...SPEC_FILTERS[key].options], value, locale)
}

/** Comma-joined labels for an array-valued spec, or undefined when none resolve. */
export function labelsFor(
  key: SpecFilterKey,
  values: readonly string[] | null | undefined,
  locale: 'en' | 'he'
): string | undefined {
  return getOptionLabels([...SPEC_FILTERS[key].options], values, locale)
}

/**
 * Plain-language foot width, expanded server-side into the stored values that
 * accommodate it.
 *
 * The agent otherwise has to reproduce a four-value enum list exactly, in
 * order, to answer "I have wide feet" - one word it can get right is far more
 * reliable than four values it can mistype. `most_widths` and `adjustable`
 * appear in every set because a shoe declared to suit most widths, or to adjust,
 * genuinely suits a wide foot and a narrow one alike.
 */
export const FOOT_WIDTH_EXPANSIONS = {
  wide: ['most_widths', 'regular_wide', 'wide', 'adjustable'],
  narrow: ['narrow', 'narrow_regular', 'most_widths', 'adjustable'],
  regular: ['regular', 'narrow_regular', 'regular_wide', 'most_widths', 'adjustable'],
} as const satisfies Record<string, readonly string[]>

export type FootWidthRequest = keyof typeof FOOT_WIDTH_EXPANSIONS

export const FOOT_WIDTH_REQUEST_VALUES = Object.keys(
  FOOT_WIDTH_EXPANSIONS
) as FootWidthRequest[]

export function isFootWidthRequest(value: string): value is FootWidthRequest {
  return value in FOOT_WIDTH_EXPANSIONS
}

export function expandFootWidth(value: FootWidthRequest): string[] {
  return [...FOOT_WIDTH_EXPANSIONS[value]]
}

/**
 * Plain-language arch height, expanded the same way. `most_arch_types` suits
 * any arch, so it belongs in every set.
 */
export const ARCH_HEIGHT_EXPANSIONS = {
  low: ['low', 'most_arch_types'],
  regular: ['regular', 'most_arch_types'],
  high: ['high', 'most_arch_types'],
} as const satisfies Record<string, readonly string[]>

export type ArchHeightRequest = keyof typeof ARCH_HEIGHT_EXPANSIONS

export const ARCH_HEIGHT_REQUEST_VALUES = Object.keys(
  ARCH_HEIGHT_EXPANSIONS
) as ArchHeightRequest[]

export function isArchHeightRequest(value: string): value is ArchHeightRequest {
  return value in ARCH_HEIGHT_EXPANSIONS
}

export function expandArchHeight(value: ArchHeightRequest): string[] {
  return [...ARCH_HEIGHT_EXPANSIONS[value]]
}

/**
 * Heel height is stored as a whole-centimetre string enum ('0'..'12'), not a
 * float, so a request for 2.5 cm can only be honoured as 2. Returns null when
 * the stored value is absent or not numeric - callers must treat null as
 * "unknown", never as 0.
 */
export function heelHeightCm(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export { isUndefinedFitValue }
