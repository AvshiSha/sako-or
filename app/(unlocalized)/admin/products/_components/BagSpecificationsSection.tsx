'use client'

import EnumSelect from './EnumSelect'
import MultiSelectChips from './MultiSelectChips'
import NumberField from './NumberField'
import TriStateToggle from './TriStateToggle'
import DerivedValueHint from './DerivedValueHint'
import {
  BAG_TYPE_OPTIONS,
  BAG_INTENDED_USE_OPTIONS,
  CARRYING_OPTION_OPTIONS,
  BAG_STYLE_OPTIONS,
  BAG_STRUCTURE_OPTIONS,
  BAG_SIZE_CATEGORY_OPTIONS,
  STRAP_TYPE_OPTIONS,
  HARDWARE_COLOR_OPTIONS,
  getOptionLabel,
  type BagType,
  type BagIntendedUse,
  type CarryingOption,
  type BagStyle,
  type BagStructure,
  type BagSizeCategory,
  type StrapType,
  type HardwareColor,
  type FitsLaptopInches,
} from '@/lib/product-enums'
import { deriveBagFacts } from '@/lib/bag-derived'

export interface BagSpecsValues {
  bagType?: BagType
  intendedUse: BagIntendedUse[]
  carryingOptions: CarryingOption[]
  bagStyle: BagStyle[]
  bagStructure?: BagStructure
  strapType?: StrapType
  strapDropCm?: number | null
  adjustableStrap?: boolean | null
  removableStrap?: boolean | null
  mainCompartments?: number | null
  internalPockets?: number | null
  externalPockets?: number | null
  hardwareColor?: HardwareColor
  baseFeet?: boolean | null
  // Derived — set only when overriding the computed value.
  bagSizeCategory?: BagSizeCategory
  fitsA4?: boolean | null
  fitsTablet?: boolean | null
  fitsLaptopInches?: FitsLaptopInches | null
}

interface BagSpecificationsSectionProps {
  values: BagSpecsValues
  onChange: <K extends keyof BagSpecsValues>(field: K, value: BagSpecsValues[K]) => void
  /** Dimensions live in the shared Product Specifications section; they're passed
   * in so the derived hints here reflect what's currently typed there. */
  dimensions: {
    heightCm?: number | null
    widthCm?: number | null
    depthCm?: number | null
  }
  /** True while creating a product, where bagType + intendedUse are required. */
  isCreate?: boolean
  errors?: Partial<Record<'bagType' | 'intendedUse', string>>
}

/** The fields the completeness meter counts. Derived values are excluded — they
 * fill themselves in and would inflate the score without anyone doing work. */
const TRACKED_FIELDS: (keyof BagSpecsValues)[] = [
  'bagType',
  'intendedUse',
  'carryingOptions',
  'bagStyle',
  'bagStructure',
  'strapType',
  'strapDropCm',
  'adjustableStrap',
  'removableStrap',
  'mainCompartments',
  'internalPockets',
  'externalPockets',
  'hardwareColor',
  'baseFeet',
]

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

function describeLaptop(inches: FitsLaptopInches | null): string {
  return inches === null ? 'No laptop fits' : `Up to ${inches}"`
}

/**
 * Bag attributes — only rendered when the selected category resolves to the
 * 'bags' field group (see getCategoryFieldGroup in lib/product-enums.ts), the
 * same gate ShoeFitSection uses. Values persist while hidden, so re-categorising
 * a product never silently deletes them.
 *
 * Deliberately absent from this section: material, lining, closure type, care
 * instructions and the height/width/depth/weight inputs. Those are shared with
 * other product types and stay in ProductSpecificationsSection — duplicating
 * them here would create two places to edit one fact.
 *
 * Size category, fits-A4, fits-tablet and fits-laptop are computed from the
 * dimensions rather than typed. Each shows its computed value and accepts an
 * override for the cases the geometry can't know about.
 */
export default function BagSpecificationsSection({
  values,
  onChange,
  dimensions,
  isCreate = false,
  errors,
}: BagSpecificationsSectionProps) {
  const derived = deriveBagFacts({
    heightCm: dimensions.heightCm,
    widthCm: dimensions.widthCm,
    depthCm: dimensions.depthCm,
    bagStructure: values.bagStructure ?? null,
  })

  const filledCount = TRACKED_FIELDS.filter((field) => isFilled(values[field])).length
  const completeness = Math.round((filledCount / TRACKED_FIELDS.length) * 100)

  const requiredHint = isCreate ? ' (required)' : ''

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-lg font-medium text-gray-900">Bag Specifications</h2>
        <div className="text-right shrink-0">
          <span className="text-sm text-gray-600">
            Bag data: {filledCount}/{TRACKED_FIELDS.length}
          </span>
          <div className="mt-1 h-1.5 w-32 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                completeness >= 75 ? 'bg-green-500' : completeness >= 40 ? 'bg-amber-500' : 'bg-gray-400'
              }`}
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Only shown for bag products. Leave anything you haven&apos;t checked as unset — a blank field
        is treated as unknown, and a guessed one becomes a wrong answer for customers.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <EnumSelect
            id="bagType"
            label={`Bag Type${requiredHint}`}
            locale="en"
            showBothLanguages
            value={values.bagType}
            onChange={(value) => onChange('bagType', value)}
            options={BAG_TYPE_OPTIONS}
            placeholder="Select bag type"
            error={errors?.bagType}
          />
        </div>

        <div>
          <EnumSelect
            id="bagStructure"
            label="Structure"
            locale="en"
            showBothLanguages
            value={values.bagStructure}
            onChange={(value) => onChange('bagStructure', value)}
            options={BAG_STRUCTURE_OPTIONS}
            placeholder="Select structure"
          />
        </div>

        <div className="sm:col-span-2">
          <MultiSelectChips
            label={`Intended Use${requiredHint}`}
            locale="en"
            showBothLanguages
            values={values.intendedUse}
            onChange={(value) => onChange('intendedUse', value)}
            options={BAG_INTENDED_USE_OPTIONS}
            helperText="What the customer would buy this bag for. Pick every use that genuinely applies."
          />
          {errors?.intendedUse && <p className="mt-1 text-sm text-red-600">{errors.intendedUse}</p>}
        </div>

        <div className="sm:col-span-2">
          <MultiSelectChips
            label="Carrying Options"
            locale="en"
            showBothLanguages
            values={values.carryingOptions}
            onChange={(value) => onChange('carryingOptions', value)}
            options={CARRYING_OPTION_OPTIONS}
            helperText="Every way the bag can actually be carried."
          />
        </div>

        <div className="sm:col-span-2">
          <MultiSelectChips
            label="Style"
            locale="en"
            showBothLanguages
            values={values.bagStyle}
            onChange={(value) => onChange('bagStyle', value)}
            options={BAG_STYLE_OPTIONS}
          />
        </div>

        {/* Strap */}
        <EnumSelect
          id="strapType"
          label="Strap Type"
          locale="en"
          showBothLanguages
          value={values.strapType}
          onChange={(value) => onChange('strapType', value)}
          options={STRAP_TYPE_OPTIONS}
          placeholder="Select strap type"
        />

        <NumberField
          id="strapDropCm"
          label="Strap Drop"
          unit="cm"
          min={0}
          max={150}
          step={0.5}
          value={values.strapDropCm}
          onChange={(value) => onChange('strapDropCm', value)}
          helperText="Distance from the top of the strap to the top of the bag."
        />

        <TriStateToggle
          id="adjustableStrap"
          label="Adjustable Strap"
          value={values.adjustableStrap}
          onChange={(value) => onChange('adjustableStrap', value)}
        />

        <TriStateToggle
          id="removableStrap"
          label="Removable Strap"
          value={values.removableStrap}
          onChange={(value) => onChange('removableStrap', value)}
        />

        {/* Compartments */}
        <NumberField
          id="mainCompartments"
          label="Main Compartments"
          min={0}
          max={5}
          step={1}
          value={values.mainCompartments}
          onChange={(value) => onChange('mainCompartments', value)}
        />

        <NumberField
          id="internalPockets"
          label="Internal Pockets"
          min={0}
          max={10}
          step={1}
          value={values.internalPockets}
          onChange={(value) => onChange('internalPockets', value)}
        />

        <NumberField
          id="externalPockets"
          label="External Pockets"
          min={0}
          max={10}
          step={1}
          value={values.externalPockets}
          onChange={(value) => onChange('externalPockets', value)}
        />

        <EnumSelect
          id="hardwareColor"
          label="Hardware Colour"
          locale="en"
          showBothLanguages
          value={values.hardwareColor}
          onChange={(value) => onChange('hardwareColor', value)}
          options={HARDWARE_COLOR_OPTIONS}
          placeholder="Select hardware colour"
          helperText="Product default. A colour variant can override this below."
        />

        <TriStateToggle
          id="baseFeet"
          label="Protective Base Feet"
          value={values.baseFeet}
          onChange={(value) => onChange('baseFeet', value)}
        />
      </div>

      {/* Calculated from the dimensions in Product Specifications */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <h3 className="text-sm font-medium text-gray-900">Calculated from dimensions</h3>
        <p className="text-sm text-gray-500 mb-4">
          Filled in automatically from height, width and depth. Override only when the calculation is
          wrong for this particular bag.
        </p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <span className="block text-sm font-medium text-gray-700">Capacity</span>
            <p className="mt-1 text-sm text-gray-900">
              {derived.bagCapacityLiters === null ? '—' : `${derived.bagCapacityLiters} L`}
            </p>
            <DerivedValueHint
              computed={derived.bagCapacityLiters === null ? null : `${derived.bagCapacityLiters} L`}
              isOverridden={false}
              onClearOverride={() => {}}
            />
          </div>

          <div>
            <EnumSelect
              id="bagSizeCategory"
              label="Size Category"
              locale="en"
              showBothLanguages
              value={values.bagSizeCategory ?? derived.bagSizeCategory ?? undefined}
              onChange={(value) => onChange('bagSizeCategory', value)}
              options={BAG_SIZE_CATEGORY_OPTIONS}
              placeholder="Not enough data"
            />
            <DerivedValueHint
              computed={
                derived.bagSizeCategory
                  ? (getOptionLabel(BAG_SIZE_CATEGORY_OPTIONS, derived.bagSizeCategory, 'en') ?? null)
                  : null
              }
              isOverridden={!!values.bagSizeCategory && values.bagSizeCategory !== derived.bagSizeCategory}
              onClearOverride={() => onChange('bagSizeCategory', undefined)}
            />
          </div>

          <div>
            <TriStateToggle
              id="fitsA4"
              label="Fits A4"
              value={values.fitsA4 ?? derived.fitsA4}
              onChange={(value) => onChange('fitsA4', value)}
            />
            <DerivedValueHint
              computed={derived.fitsA4 === null ? null : derived.fitsA4 ? 'Yes' : 'No'}
              // `!= null` on purpose: null is the tri-state's "not specified",
              // which means "use the calculated value", not "override it".
              isOverridden={values.fitsA4 != null && values.fitsA4 !== derived.fitsA4}
              onClearOverride={() => onChange('fitsA4', undefined)}
              requires="height and width"
            />
          </div>

          <div>
            <TriStateToggle
              id="fitsTablet"
              label="Fits a Tablet"
              value={values.fitsTablet ?? derived.fitsTablet}
              onChange={(value) => onChange('fitsTablet', value)}
            />
            <DerivedValueHint
              computed={derived.fitsTablet === null ? null : derived.fitsTablet ? 'Yes' : 'No'}
              isOverridden={values.fitsTablet != null && values.fitsTablet !== derived.fitsTablet}
              onClearOverride={() => onChange('fitsTablet', undefined)}
              requires="height and width"
            />
          </div>

          <div>
            <label htmlFor="fitsLaptopInches" className="block text-sm font-medium text-gray-700">
              Fits Laptop
            </label>
            <select
              id="fitsLaptopInches"
              value={values.fitsLaptopInches ?? derived.fitsLaptopInches ?? ''}
              onChange={(event) => {
                const raw = event.target.value
                onChange('fitsLaptopInches', raw === '' ? null : (Number(raw) as FitsLaptopInches))
              }}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700"
            >
              {/* Empty means "not specified", i.e. fall back to the calculated
                  value below — which is itself null when no laptop fits. */}
              <option value="">Not specified</option>
              <option value="13">Up to 13&quot;</option>
              <option value="14">Up to 14&quot;</option>
              <option value="15">Up to 15&quot;</option>
              <option value="16">Up to 16&quot;</option>
            </select>
            <DerivedValueHint
              computed={
                dimensions.heightCm && dimensions.widthCm
                  ? describeLaptop(derived.fitsLaptopInches)
                  : null
              }
              isOverridden={
                values.fitsLaptopInches != null &&
                values.fitsLaptopInches !== derived.fitsLaptopInches
              }
              onClearOverride={() => onChange('fitsLaptopInches', undefined)}
              requires="height and width"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Empty bag specs, for initialising a new product's form state. */
export function createEmptyBagSpecs(): BagSpecsValues {
  return {
    intendedUse: [],
    carryingOptions: [],
    bagStyle: [],
  }
}
