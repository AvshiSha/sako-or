import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  productExtensionsSchema,
  shoeFitSchema,
  bagSpecsSchema,
  seoSchema,
  zodErrorsToFieldMap,
} from '../product-schema'

describe('shoeFitSchema', () => {
  it('accepts a fully populated, valid shoe-fit object', () => {
    const result = shoeFitSchema.safeParse({
      sizeFit: 'true_to_size',
      footWidthFit: 'regular_wide',
      archFit: 'regular',
      adjustableFeatures: ['buckle', 'elastic'],
      recommendation_en: 'This style fits true to size.',
      recommendation_he: 'הדגם מידה במידה.',
    })
    assert.equal(result.success, true)
  })

  it('rejects an unsupported enum value', () => {
    const result = shoeFitSchema.safeParse({ sizeFit: 'extremely_small' })
    assert.equal(result.success, false)
  })

  it('rejects an unsupported adjustable feature', () => {
    const result = shoeFitSchema.safeParse({ adjustableFeatures: ['zipper'] })
    assert.equal(result.success, false)
  })

  it('defaults adjustableFeatures to an empty array when omitted', () => {
    const result = shoeFitSchema.parse({})
    assert.deepEqual(result.adjustableFeatures, [])
  })
})

describe('seoSchema', () => {
  it('rejects an empty string inside secondaryKeywords', () => {
    const result = seoSchema.safeParse({
      en: { secondaryKeywords: ['silver pumps', ''] },
    })
    assert.equal(result.success, false)
  })

  it('keeps Hebrew and English keyword lists separate', () => {
    const result = seoSchema.parse({
      he: { focusKeyword: 'נעלי סירה כסופות', secondaryKeywords: ['נעלי עקב כסופות'] },
      en: { focusKeyword: 'silver pumps for women', secondaryKeywords: ["women's silver heels"] },
    })
    assert.equal(result.he?.focusKeyword, 'נעלי סירה כסופות')
    assert.equal(result.en?.focusKeyword, 'silver pumps for women')
    assert.deepEqual(result.he?.secondaryKeywords, ['נעלי עקב כסופות'])
    assert.deepEqual(result.en?.secondaryKeywords, ["women's silver heels"])
  })

  it('rejects a slug with non-URL-safe characters', () => {
    const result = seoSchema.safeParse({ slug: 'silver pumps!' })
    assert.equal(result.success, false)
  })

  it('accepts a valid URL-safe slug', () => {
    const result = seoSchema.safeParse({ slug: 'silver-leather-pumps' })
    assert.equal(result.success, true)
  })
})

describe('productExtensionsSchema', () => {
  it('validates a legacy product with none of the new fields (safe defaults)', () => {
    const result = productExtensionsSchema.safeParse({})
    assert.equal(result.success, true)
    if (result.success) {
      assert.deepEqual(result.data.shoeFit, undefined)
      assert.deepEqual(result.data.seo, undefined)
    }
  })

  it('accepts bilingual toe shape / closure / heel type fields', () => {
    const result = productExtensionsSchema.safeParse({
      toeShape_en: 'Pointed',
      toeShape_he: 'מחודדת',
      closureType_en: 'Buckle',
      heelType_he: 'עקב מחט',
    })
    assert.equal(result.success, true)
  })

  it('accepts the dropdown-backed attribute fields', () => {
    const result = productExtensionsSchema.safeParse({
      upperMaterial: ['smooth_leather', 'suede'],
      lining: 'textile',
      insole: 'eva',
      outsole: 'rubber',
      soleType: 'wedge',
      toeShape: 'round',
      heelType: 'block_heel',
      closureType: 'zipper',
      heelHeight: '5',
    })
    assert.equal(result.success, true)
  })

  it('rejects an unsupported dropdown value', () => {
    const result = productExtensionsSchema.safeParse({ outsole: 'cardboard' })
    assert.equal(result.success, false)
  })

  it('rejects an unsupported upperMaterial entry', () => {
    const result = productExtensionsSchema.safeParse({ upperMaterial: ['smooth_leather', 'unobtainium'] })
    assert.equal(result.success, false)
  })

  it('rejects an out-of-range heel height', () => {
    const result = productExtensionsSchema.safeParse({ heelHeight: '13' })
    assert.equal(result.success, false)
  })

  it('defaults upperMaterial to an empty array when omitted', () => {
    const result = productExtensionsSchema.parse({})
    assert.deepEqual(result.upperMaterial, [])
  })
})

describe('bagSpecsSchema', () => {
  it('accepts a fully populated bag', () => {
    const result = bagSpecsSchema.safeParse({
      bagType: 'crossbody',
      intendedUse: ['everyday', 'work'],
      carryingOptions: ['crossbody', 'shoulder'],
      bagStyle: ['classic'],
      bagStructure: 'semi_structured',
      strapType: 'leather_strap',
      strapDropCm: 55,
      adjustableStrap: true,
      removableStrap: false,
      mainCompartments: 1,
      internalPockets: 2,
      externalPockets: 0,
      hardwareColor: 'gold',
      baseFeet: null,
      fitsLaptopInches: 13,
    })
    assert.equal(result.success, true)
  })

  it('accepts an entirely empty bag — nothing is required at the schema level', () => {
    const result = bagSpecsSchema.safeParse({})
    assert.equal(result.success, true)
  })

  it('keeps an unknown boolean as null rather than coercing it to false', () => {
    const result = bagSpecsSchema.parse({ baseFeet: null, adjustableStrap: null })
    assert.equal(result.baseFeet, null)
    assert.equal(result.adjustableStrap, null)
    assert.notEqual(result.baseFeet, false)
  })

  it('leaves an omitted boolean undefined, never false', () => {
    const result = bagSpecsSchema.parse({})
    assert.equal(result.removableStrap, undefined)
    assert.notEqual(result.removableStrap, false)
  })

  it('allows zero pockets but not a zero measurement', () => {
    assert.equal(bagSpecsSchema.safeParse({ externalPockets: 0 }).success, true)
    // A 0cm strap drop is not a real measurement, it's a mis-entry.
    assert.equal(bagSpecsSchema.safeParse({ strapDropCm: 0 }).success, false)
  })

  it('defaults the multi-select arrays to empty', () => {
    const result = bagSpecsSchema.parse({})
    assert.deepEqual(result.intendedUse, [])
    assert.deepEqual(result.carryingOptions, [])
    assert.deepEqual(result.bagStyle, [])
  })

  it('rejects an unknown bag type', () => {
    assert.equal(bagSpecsSchema.safeParse({ bagType: 'jetpack' }).success, false)
  })

  it('rejects an unknown intended use', () => {
    assert.equal(bagSpecsSchema.safeParse({ intendedUse: ['everyday', 'spelunking'] }).success, false)
  })

  it('rejects a laptop size that is not one of the supported values', () => {
    assert.equal(bagSpecsSchema.safeParse({ fitsLaptopInches: 17 }).success, false)
    assert.equal(bagSpecsSchema.safeParse({ fitsLaptopInches: null }).success, true)
  })

  it('rejects negative and out-of-range measurements', () => {
    assert.equal(bagSpecsSchema.safeParse({ strapDropCm: -5 }).success, false)
    assert.equal(bagSpecsSchema.safeParse({ strapDropCm: 500 }).success, false)
    assert.equal(bagSpecsSchema.safeParse({ internalPockets: 99 }).success, false)
  })
})

describe('specificationsAdditionsSchema — measurements', () => {
  it('accepts centimetre and gram measurements', () => {
    const result = productExtensionsSchema.safeParse({
      heightCm: 18,
      widthCm: 25,
      depthCm: 13,
      weightGrams: 620,
    })
    assert.equal(result.success, true)
  })

  it('preserves null as "not measured" rather than 0', () => {
    const result = productExtensionsSchema.parse({ heightCm: null })
    assert.equal(result.heightCm, null)
    assert.notEqual(result.heightCm, 0)
  })

  it('rejects a zero or negative measurement', () => {
    assert.equal(productExtensionsSchema.safeParse({ heightCm: 0 }).success, false)
    assert.equal(productExtensionsSchema.safeParse({ widthCm: -3 }).success, false)
  })

  it('rejects a fractional weight — grams are whole numbers', () => {
    assert.equal(productExtensionsSchema.safeParse({ weightGrams: 620.5 }).success, false)
  })
})

describe('productExtensionsSchema — bagSpecs integration', () => {
  it('carries bagSpecs through as an optional group', () => {
    const result = productExtensionsSchema.parse({ bagSpecs: { bagType: 'tote' } })
    assert.equal(result.bagSpecs?.bagType, 'tote')
  })

  it('reports bagSpecs issues under a bagSpecs.* path', () => {
    const result = productExtensionsSchema.safeParse({ bagSpecs: { bagType: 'nonsense' } })
    assert.equal(result.success, false)
    if (!result.success) {
      const fieldMap = zodErrorsToFieldMap(result.error)
      assert.ok(Object.keys(fieldMap).some((key) => key.startsWith('bagSpecs')))
    }
  })
})

describe('zodErrorsToFieldMap', () => {
  it('maps issues to a flat field->message record', () => {
    const result = productExtensionsSchema.safeParse({ seo: { slug: 'not a valid slug!' } })
    assert.equal(result.success, false)
    if (!result.success) {
      const fieldMap = zodErrorsToFieldMap(result.error)
      assert.equal(typeof fieldMap['seo.slug'], 'string')
    }
  })
})
