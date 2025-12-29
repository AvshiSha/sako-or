/**
 * Test script for Hebrew normalization
 */

import { generateHebrewVariations, expandHebrewQuery } from '../lib/hebrew-normalize'

console.log('Testing Hebrew Normalization\n')

// Test cases
const testCases = [
  'כפכף',
  'כפכפים',
  'אדום',
  'אדומים',
  'נעלי סירה',
  'נעליים',
]

testCases.forEach(word => {
  console.log(`Input: "${word}"`)
  const variations = generateHebrewVariations(word)
  console.log(`Variations: [${variations.map(v => `"${v}"`).join(', ')}]`)
  console.log('')
})

// Test query expansion
console.log('\nTesting Query Expansion:\n')
const queries = [
  'כפכף אדום',
  'כפכפים אדומים',
  'נעלי סירה מידה 37',
]

queries.forEach(query => {
  console.log(`Query: "${query}"`)
  const expanded = expandHebrewQuery(query)
  console.log(`Expanded: [${expanded.map(v => `"${v}"`).join(', ')}]`)
  console.log('')
})


