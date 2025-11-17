/**
 * Sale Price Update Utility
 * 
 * Handles CSV parsing, validation, and bulk updates of sale prices
 * for end-of-season sales.
 */

import { db } from './firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Product } from './firebase';

/**
 * Configuration for price validation
 */
export const PRICE_VALIDATION_CONFIG = {
  // Percentage difference threshold for CSV price vs DB price warning
  priceDifferenceThreshold: 0.15, // 15%
  // Minimum discount amount to warn about (in currency units)
  minDiscountWarning: 1,
  // Firestore batch write limit
  batchSize: 400,
} as const;

/**
 * CSV row structure
 */
export interface SalePriceCsvRow {
  sku: string;
  price: number;
  salePrice: number;
}

/**
 * Validation result for a single row
 */
export interface SalePriceValidationResult {
  isValid: boolean;
  willUpdate: boolean;
  reason?: string;
  warning?: string;
  productId?: string;
  currentPrice?: number;
  currentSalePrice?: number;
  csvPrice?: number;
  csvSalePrice?: number;
}

/**
 * Processed row with validation
 */
export interface ProcessedSalePriceRow extends SalePriceCsvRow {
  validation: SalePriceValidationResult;
  rowNumber: number;
}

/**
 * Update result summary
 */
export interface SalePriceUpdateResult {
  total: number;
  updated: number;
  skipped: number;
  errors: string[];
  skippedByReason: Record<string, number>;
  details: ProcessedSalePriceRow[];
  warnings: string[];
}

/**
 * Validate SKU format (xxxx-xxxx)
 */
export function validateSkuFormat(sku: string): boolean {
  if (!sku || typeof sku !== 'string') return false;
  const trimmed = sku.trim();
  // Pattern: exactly 4 digits, dash, exactly 4 digits
  return /^\d{4}-\d{4}$/.test(trimmed);
}

/**
 * Parse numeric value from CSV
 */
function parseNumericValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  if (typeof value !== 'string') return null;
  
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'NULL') return null;
  
  const parsed = parseFloat(trimmed);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Validate and process a single CSV row
 */
export async function validateSalePriceRow(
  row: SalePriceCsvRow,
  rowNumber: number,
  productMap: Map<string, { id: string; price: number; salePrice?: number }>
): Promise<ProcessedSalePriceRow> {
  const validation: SalePriceValidationResult = {
    isValid: false,
    willUpdate: false,
  };

  // 1. Validate SKU format
  if (!validateSkuFormat(row.sku)) {
    validation.reason = 'Invalid SKU format';
    return { ...row, validation, rowNumber };
  }

  const trimmedSku = row.sku.trim();

  // 2. Parse numeric values
  const price = parseNumericValue(row.price);
  const salePrice = parseNumericValue(row.salePrice);

  if (price === null) {
    validation.reason = 'Invalid numeric value for price';
    return { ...row, validation, rowNumber };
  }

  // 3. Check if product exists
  const product = productMap.get(trimmedSku);
  if (!product) {
    validation.reason = 'No product with this SKU';
    return { ...row, validation, rowNumber };
  }

  validation.productId = product.id;
  validation.currentPrice = product.price;
  validation.currentSalePrice = product.salePrice;
  validation.csvPrice = price;
  validation.csvSalePrice = salePrice ?? null;

  // 4. Skip if sale price is empty, null, or zero
  if (salePrice === null || salePrice === 0) {
    validation.reason = 'Sale price empty or zero';
    validation.isValid = true; // Valid row, just won't update
    return { ...row, validation, rowNumber };
  }

  // 5. Skip if sale price > original price
  if (salePrice > price) {
    validation.reason = 'Sale price greater than original price';
    return { ...row, validation, rowNumber };
  }

  // 6. Skip if original price <= 0
  if (price <= 0) {
    validation.reason = 'Invalid original price (<= 0)';
    return { ...row, validation, rowNumber };
  }

  // 7. Optional: Check price consistency between CSV and DB
  const priceDifference = Math.abs(product.price - price) / product.price;
  if (priceDifference > PRICE_VALIDATION_CONFIG.priceDifferenceThreshold) {
    validation.warning = `DB price (${product.price}) differs significantly from CSV price (${price})`;
    // Still allow update, but warn
  }

  // 8. Check for very small discount
  const discount = price - salePrice;
  if (discount < PRICE_VALIDATION_CONFIG.minDiscountWarning) {
    validation.warning = `Very small discount: ${discount} (price: ${price}, sale: ${salePrice})`;
  }

  // 9. Check if overwriting existing salePrice
  if (product.salePrice !== null && product.salePrice !== undefined) {
    validation.warning = `Overwriting existing salePrice: ${product.salePrice} → ${salePrice}`;
  }

  // All checks passed
  validation.isValid = true;
  validation.willUpdate = true;

  return {
    ...row,
    price,
    salePrice,
    validation,
    rowNumber,
  };
}

/**
 * Parse CSV content into rows
 */
export function parseSalePriceCsv(csvContent: string): SalePriceCsvRow[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  // Parse header - handle various column name formats
  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/[_\s]/g, ''));

  // Find column indices (flexible matching)
  const skuIndex = headers.findIndex((h) => h === 'sku');
  const priceIndex = headers.findIndex((h) => h === 'price');
  const salePriceIndex = headers.findIndex(
    (h) => h === 'saleprice' || h === 'sale_price' || h === 'saleprice'
  );

  if (skuIndex === -1) {
    throw new Error('CSV must have a "sku" column');
  }
  if (priceIndex === -1) {
    throw new Error('CSV must have a "price" column');
  }
  if (salePriceIndex === -1) {
    throw new Error('CSV must have a "sale_price" or "sale price" column');
  }

  // Parse data rows
  const rows: SalePriceCsvRow[] = [];
  const skuMap = new Map<string, number>(); // Track duplicates

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());

    if (values.length < Math.max(skuIndex, priceIndex, salePriceIndex) + 1) {
      console.warn(`Row ${i + 1}: Not enough columns, skipping`);
      continue;
    }

    const sku = values[skuIndex];
    const priceStr = values[priceIndex];
    const salePriceStr = values[salePriceIndex];

    if (!sku) {
      console.warn(`Row ${i + 1}: Missing SKU, skipping`);
      continue;
    }

    // Track duplicate SKUs (will use last occurrence)
    if (skuMap.has(sku)) {
      console.warn(`Row ${i + 1}: Duplicate SKU "${sku}", will use last occurrence`);
    }
    skuMap.set(sku, i);

    const price = parseNumericValue(priceStr);
    const salePrice = parseNumericValue(salePriceStr);

    if (price === null) {
      console.warn(`Row ${i + 1}: Invalid price "${priceStr}", skipping`);
      continue;
    }

    rows.push({
      sku: sku.trim(),
      price: price,
      salePrice: salePrice ?? 0, // Default to 0 if null
    });
  }

  // Handle duplicates: keep only the last occurrence
  const uniqueRows: SalePriceCsvRow[] = [];
  const seenSkus = new Set<string>();

  // Process in reverse to keep last occurrence
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (!seenSkus.has(row.sku)) {
      uniqueRows.unshift(row); // Add to beginning to maintain order
      seenSkus.add(row.sku);
    }
  }

  return uniqueRows;
}

/**
 * Fetch products by SKUs and create a map
 */
export async function fetchProductsBySkus(skus: string[]): Promise<
  Map<string, { id: string; price: number; salePrice?: number }>
> {
  const productMap = new Map<string, { id: string; price: number; salePrice?: number }>();

  // Firestore has a limit of 10 items in 'in' queries, so we need to batch
  const batchSize = 10;
  for (let i = 0; i < skus.length; i += batchSize) {
    const batch = skus.slice(i, i + batchSize);
    const q = query(collection(db, 'products'), where('sku', 'in', batch));
    const querySnapshot = await getDocs(q);

    querySnapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data() as Product;
      productMap.set(data.sku, {
        id: docSnapshot.id,
        price: data.price,
        salePrice: data.salePrice,
      });
    });
  }

  return productMap;
}

/**
 * Update sale prices in Firestore
 */
export async function updateSalePrices(
  rows: ProcessedSalePriceRow[],
  dryRun: boolean = false
): Promise<SalePriceUpdateResult> {
  const result: SalePriceUpdateResult = {
    total: rows.length,
    updated: 0,
    skipped: 0,
    errors: [],
    skippedByReason: {},
    details: [],
    warnings: [],
  };

  // Filter rows that will be updated
  const rowsToUpdate = rows.filter((r) => r.validation.willUpdate);

  if (dryRun) {
    // Dry run: just return validation results
    rows.forEach((row) => {
      result.details.push(row);
      if (row.validation.willUpdate) {
        result.updated++;
      } else {
        result.skipped++;
        const reason = row.validation.reason || 'Unknown';
        result.skippedByReason[reason] = (result.skippedByReason[reason] || 0) + 1;
      }
      if (row.validation.warning) {
        result.warnings.push(`Row ${row.rowNumber}: ${row.validation.warning}`);
      }
    });
    return result;
  }

  // Actual update: process in batches
  const batches: ProcessedSalePriceRow[][] = [];
  for (let i = 0; i < rowsToUpdate.length; i += PRICE_VALIDATION_CONFIG.batchSize) {
    batches.push(rowsToUpdate.slice(i, i + PRICE_VALIDATION_CONFIG.batchSize));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const firestoreBatch = writeBatch(db);

    for (const row of batch) {
      if (!row.validation.productId) {
        result.errors.push(`Row ${row.rowNumber}: Missing product ID`);
        continue;
      }

      try {
        const productRef = doc(db, 'products', row.validation.productId);
        firestoreBatch.update(productRef, {
          salePrice: row.salePrice,
          updatedAt: new Date(),
        });
      } catch (error) {
        result.errors.push(
          `Row ${row.rowNumber} (SKU: ${row.sku}): ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    try {
      await firestoreBatch.commit();
      result.updated += batch.length;
    } catch (error) {
      result.errors.push(
        `Batch ${batchIndex + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Add all rows to details
  rows.forEach((row) => {
    result.details.push(row);
    if (!row.validation.willUpdate) {
      result.skipped++;
      const reason = row.validation.reason || 'Unknown';
      result.skippedByReason[reason] = (result.skippedByReason[reason] || 0) + 1;
    }
    if (row.validation.warning) {
      result.warnings.push(`Row ${row.rowNumber}: ${row.validation.warning}`);
    }
  });

  return result;
}

/**
 * Process CSV and update sale prices
 */
export async function processSalePriceCsv(
  csvContent: string,
  dryRun: boolean = false
): Promise<SalePriceUpdateResult> {
  // Parse CSV
  const csvRows = parseSalePriceCsv(csvContent);

  if (csvRows.length === 0) {
    return {
      total: 0,
      updated: 0,
      skipped: 0,
      errors: ['No valid rows found in CSV'],
      skippedByReason: {},
      details: [],
      warnings: [],
    };
  }

  // Get unique SKUs
  const uniqueSkus = Array.from(new Set(csvRows.map((r) => r.sku.trim())));

  // Fetch products
  const productMap = await fetchProductsBySkus(uniqueSkus);

  // Validate each row
  const processedRows: ProcessedSalePriceRow[] = [];
  for (let i = 0; i < csvRows.length; i++) {
    const row = csvRows[i];
    const processed = await validateSalePriceRow(row, i + 2, productMap); // +2 because row 1 is header, and we're 0-indexed
    processedRows.push(processed);
  }

  // Update sale prices
  const result = await updateSalePrices(processedRows, dryRun);

  return result;
}

