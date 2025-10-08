/**
 * Test script for SKU parser
 * Run with: node scripts/test-sku-parser.js
 */

// Simple SKU parser (same logic as lib/sku-parser.ts)
function parseSku(fullSku) {
  if (!fullSku) {
    return {
      baseSku: '',
      colorName: null,
      size: null,
      fullSku: '',
    };
  }

  const parts = fullSku.split('-');

  if (parts.length >= 4) {
    const size = parts[parts.length - 1];
    const colorName = parts[parts.length - 2];
    const baseSku = parts.slice(0, -2).join('-');

    return {
      baseSku,
      colorName,
      size,
      fullSku,
    };
  }

  return {
    baseSku: fullSku,
    colorName: null,
    size: null,
    fullSku,
  };
}

// Test cases
const testCases = [
  '0000-0000-black-35',
  '1234-5678-red-M',
  '9999-8888-blue-42',
  '0000-0000-white-S',
  'SIMPLE-SKU',
  '123-456',
];

console.log('🧪 Testing SKU Parser\n');
console.log('='.repeat(80));

testCases.forEach(sku => {
  const parsed = parseSku(sku);
  console.log(`\nInput:  ${sku}`);
  console.log(`Output:`);
  console.log(`  ├─ Base SKU:  ${parsed.baseSku}`);
  console.log(`  ├─ Color:     ${parsed.colorName || '(none)'}`);
  console.log(`  └─ Size:      ${parsed.size || '(none)'}`);
});

console.log('\n' + '='.repeat(80));
console.log('\n✅ SKU Parser Test Complete\n');

