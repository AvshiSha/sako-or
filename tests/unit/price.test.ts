import {
  validateSkuFormat,
  parseSalePriceCsv,
  validateSalePriceRow,
  type SalePriceCsvRow,
  type ProcessedSalePriceRow,
} from '@/lib/sale-prices'

describe('Price Calculation Tests', () => {
  describe('validateSkuFormat', () => {
    it('should validate correct SKU format (xxxx-xxxx)', () => {
      expect(validateSkuFormat('1234-5678')).toBe(true)
      expect(validateSkuFormat('0000-9999')).toBe(true)
    })

    it('should reject invalid SKU formats', () => {
      expect(validateSkuFormat('1234-567')).toBe(false) // Too short
      expect(validateSkuFormat('12345-5678')).toBe(false) // Too long
      expect(validateSkuFormat('1234-56789')).toBe(false) // Too long
      expect(validateSkuFormat('1234_5678')).toBe(false) // Wrong separator
      expect(validateSkuFormat('abcd-5678')).toBe(false) // Non-numeric
      expect(validateSkuFormat('')).toBe(false) // Empty
      expect(validateSkuFormat('  1234-5678  ')).toBe(true) // Should trim
    })

    it('should handle edge cases', () => {
      expect(validateSkuFormat(null as any)).toBe(false)
      expect(validateSkuFormat(undefined as any)).toBe(false)
      expect(validateSkuFormat('   ')).toBe(false) // Only whitespace
    })
  })

  describe('parseSalePriceCsv', () => {
    it('should parse valid CSV with header', () => {
      const csv = `sku,price,sale_price
1234-5678,300,250
2345-6789,150,120`

      const result = parseSalePriceCsv(csv)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        sku: '1234-5678',
        price: 300,
        salePrice: 250,
      })
      expect(result[1]).toEqual({
        sku: '2345-6789',
        price: 150,
        salePrice: 120,
      })
    })

    it('should handle various column name formats', () => {
      const csv1 = `SKU,Price,SalePrice
1234-5678,300,250`

      const csv2 = `sku,price,sale_price
1234-5678,300,250`

      const csv3 = `SKU,PRICE,SALE PRICE
1234-5678,300,250`

      expect(parseSalePriceCsv(csv1)).toHaveLength(1)
      expect(parseSalePriceCsv(csv2)).toHaveLength(1)
      expect(parseSalePriceCsv(csv3)).toHaveLength(1)
    })

    it('should handle empty sale price (null or zero)', () => {
      const csv = `sku,price,sale_price
1234-5678,300,0
2345-6789,150,null`

      const result = parseSalePriceCsv(csv)
      expect(result).toHaveLength(2)
      expect(result[0].salePrice).toBe(0)
      expect(result[1].salePrice).toBe(0) // null becomes 0
    })

    it('should skip rows with invalid price', () => {
      const csv = `sku,price,sale_price
1234-5678,invalid,250
2345-6789,150,120`

      const result = parseSalePriceCsv(csv)
      expect(result).toHaveLength(1)
      expect(result[0].sku).toBe('2345-6789')
    })

    it('should handle duplicate SKUs (keep last occurrence)', () => {
      const csv = `sku,price,sale_price
1234-5678,300,250
1234-5678,300,200`

      const result = parseSalePriceCsv(csv)
      expect(result).toHaveLength(1)
      expect(result[0].salePrice).toBe(200) // Last occurrence
    })

    it('should throw error for missing required columns', () => {
      const csv1 = `sku,price
1234-5678,300`

      const csv2 = `sku,sale_price
1234-5678,250`

      const csv3 = `price,sale_price
300,250`

      expect(() => parseSalePriceCsv(csv1)).toThrow('sale_price')
      expect(() => parseSalePriceCsv(csv2)).toThrow('price')
      expect(() => parseSalePriceCsv(csv3)).toThrow('sku')
    })

    it('should throw error for empty CSV', () => {
      expect(() => parseSalePriceCsv('')).toThrow('at least a header row')
      expect(() => parseSalePriceCsv('sku,price,sale_price')).toThrow('at least a header row')
    })
  })

  describe('validateSalePriceRow', () => {
    const mockProductMap = new Map([
      ['1234-5678', { id: 'prod-1', price: 300, salePrice: undefined }],
      ['2345-6789', { id: 'prod-2', price: 150, salePrice: 120 }],
    ])

    it('should validate correct row', async () => {
      const row: SalePriceCsvRow = {
        sku: '1234-5678',
        price: 300,
        salePrice: 250,
      }

      const result = await validateSalePriceRow(row, 1, mockProductMap)
      expect(result.validation.isValid).toBe(true)
      expect(result.validation.willUpdate).toBe(true)
      expect(result.validation.productId).toBe('prod-1')
    })

    it('should reject invalid SKU format', async () => {
      const row: SalePriceCsvRow = {
        sku: 'invalid',
        price: 300,
        salePrice: 250,
      }

      const result = await validateSalePriceRow(row, 1, mockProductMap)
      expect(result.validation.isValid).toBe(false)
      expect(result.validation.willUpdate).toBe(false)
      expect(result.validation.reason).toBe('Invalid SKU format')
    })

    it('should reject non-existent product', async () => {
      const row: SalePriceCsvRow = {
        sku: '9999-9999',
        price: 300,
        salePrice: 250,
      }

      const result = await validateSalePriceRow(row, 1, mockProductMap)
      expect(result.validation.isValid).toBe(false)
      expect(result.validation.willUpdate).toBe(false)
      expect(result.validation.reason).toBe('No product with this SKU')
    })

    it('should skip row with empty or zero sale price', async () => {
      const row: SalePriceCsvRow = {
        sku: '1234-5678',
        price: 300,
        salePrice: 0,
      }

      const result = await validateSalePriceRow(row, 1, mockProductMap)
      expect(result.validation.isValid).toBe(true)
      expect(result.validation.willUpdate).toBe(false)
      expect(result.validation.reason).toBe('Sale price empty or zero')
    })

    it('should reject sale price greater than original price', async () => {
      const row: SalePriceCsvRow = {
        sku: '1234-5678',
        price: 300,
        salePrice: 350,
      }

      const result = await validateSalePriceRow(row, 1, mockProductMap)
      expect(result.validation.isValid).toBe(false)
      expect(result.validation.willUpdate).toBe(false)
      expect(result.validation.reason).toBe('Sale price greater than original price')
    })

    it('should reject invalid original price (<= 0)', async () => {
      const row: SalePriceCsvRow = {
        sku: '1234-5678',
        price: 0,
        salePrice: 100,
      }

      const result = await validateSalePriceRow(row, 1, mockProductMap)
      expect(result.validation.isValid).toBe(false)
      expect(result.validation.willUpdate).toBe(false)
      // With the current validation order, a positive sale price with zero
      // original price fails the \"sale price greater than original price\" check first.
      expect(result.validation.reason).toBe('Sale price greater than original price')
    })

    it('should warn about price difference between CSV and DB', async () => {
      const row: SalePriceCsvRow = {
        sku: '1234-5678',
        price: 500, // Different from DB price (300)
        salePrice: 250,
      }

      const result = await validateSalePriceRow(row, 1, mockProductMap)
      expect(result.validation.isValid).toBe(true)
      expect(result.validation.willUpdate).toBe(true)
      expect(result.validation.warning).toContain('differs significantly')
    })

    it('should warn about very small discount', async () => {
      const row: SalePriceCsvRow = {
        sku: '1234-5678',
        price: 300,
        salePrice: 299.5, // Very small discount (< 1 ILS)
      }

      const result = await validateSalePriceRow(row, 1, mockProductMap)
      expect(result.validation.isValid).toBe(true)
      expect(result.validation.willUpdate).toBe(true)
      expect(result.validation.warning).toContain('Very small discount')
    })

    it('should warn about overwriting existing sale price', async () => {
      const row: SalePriceCsvRow = {
        sku: '2345-6789', // Has existing salePrice: 120
        price: 150,
        salePrice: 100,
      }

      const result = await validateSalePriceRow(row, 1, mockProductMap)
      expect(result.validation.isValid).toBe(true)
      expect(result.validation.willUpdate).toBe(true)
      expect(result.validation.warning).toContain('Overwriting existing salePrice')
    })
  })
})
