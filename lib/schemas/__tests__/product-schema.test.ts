import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  productExtensionsSchema,
  shoeFitSchema,
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
