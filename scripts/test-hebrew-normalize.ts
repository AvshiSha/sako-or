/**
 * Test script for Hebrew normalization
 */

import {
  buildSearchQueryTerms,
  generateHebrewVariations,
  expandHebrewQuery,
  normalizeHebrewForSearch,
} from '../lib/hebrew-normalize'

console.log('Testing Hebrew Normalization\n')

const normalizationCases = [
  ['Sofit final kaf', 'מלך', 'מלכ'],
  ['Sofit final mem', 'שלום', 'שלומ'],
  ['Niqqud', 'כְּפִכָּף', 'כפכפ'],
  ['Mixed', 'כפכף red', normalizeHebrewForSearch('כפכף red')],
  ['Punctuation', 'נעלי-סירה', 'נעלי סירה'],
]

console.log('=== Normalization ===\n')
normalizationCases.forEach(([label, input, expected]) => {
  const result = normalizeHebrewForSearch(input)
  const pass = result === expected
  console.log(`${pass ? '✓' : '✗'} ${label}: "${input}" → "${result}" (expected "${expected}")`)
})

const testCases = [
  'כפכף',
  'כפכפים',
  'אדום',
  'אדומים',
  'נעלי סירה',
  'נעליים',
  'מגפ',
]

console.log('\n=== Variations ===\n')
testCases.forEach((word) => {
  console.log(`Input: "${word}"`)
  const variations = generateHebrewVariations(word)
  console.log(`Variations: [${variations.map((v) => `"${v}"`).join(', ')}]`)
  console.log('')
})

console.log('\n=== Query Expansion ===\n')
const queries = [
  'כפכף אדום',
  'כפכפים אדומים',
  'נעלי סירה מידה 37',
  'sandals black',
  'מגפ',
]

queries.forEach((query) => {
  console.log(`Query: "${query}"`)
  const expanded = expandHebrewQuery(query)
  console.log(`Expanded: [${expanded.slice(0, 8).map((v) => `"${v}"`).join(', ')}${expanded.length > 8 ? ', ...' : ''}]`)
  const terms = buildSearchQueryTerms(query)
  console.log(`Search terms (${terms.length}): [${terms.map((v) => `"${v}"`).join(', ')}]`)
  console.log('')
})
