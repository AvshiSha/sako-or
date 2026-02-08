/**
 * Inventory Management Utility
 * 
 * Handles SKU parsing and inventory updates for both Firebase and Neon databases.
 * 
 * SKU Format: PPPP-PPPPCCSS
 * - PPPP-PPPP: Product base SKU (8 digits with dash, e.g., "4925-0301")
 * - CC: Color code (2 digits, e.g., "01" for black)
 * - SS: Size (2 digits, e.g., "35")
 * 
 * Example: "4925-03010135"
 *   -> Product: "4925-0301"
 *   -> Color: "01" (black)
 *   -> Size: "35"
 */

import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { prisma } from './prisma';
import { getStockByModel } from './verifone';

// Color code to slug mapping
// This maps 2-digit codes to their color slugs used in the database
export const COLOR_CODE_MAP: Record<string, string> = {
  '01': 'black',
  '02': 'white',
  '03': 'dark-brown',
  '04': 'light-brown',
  '05': 'zebra',
  '06': 'coffee',
  '07': 'off-white',
  '08': 'beige',
  '09': 'caramel',
  '10': 'dark-blue',
  '11': 'red',
  '12': 'green',
  '13': 'bordeaux',
  '14': 'black-lack',
  '15': 'white-lack',
  '16': 'yellow',
  '17': 'tabbacco',
  '18': 'capuchino',
  '19': 'light-pink',
  '20': 'lyla',
  '21': 'silver',
  '22': 'gold',
  '26': 'pink',
  '29': 'ligh-blue',
  '33': 'olive',
  '35': 'gray',
  '37': 'turquoise',
  '57': 'purple',
  '61': 'dark-gray',
  '69': 'camel',
  '89': 'natural',
  '91': 'multi-color',
  '95': 'black-white',
  '99': 'nude'
};

// Reverse map for encoding
export const COLOR_SLUG_TO_CODE: Record<string, string> = Object.entries(COLOR_CODE_MAP).reduce(
  (acc, [code, slug]) => {
    acc[slug] = code;
    return acc;
  },
  {} as Record<string, string>
);

export interface ParsedInventorySku {
  fullSku: string;
  productSku: string; // Base product SKU (e.g., "4925-0301")
  colorCode: string; // 2-digit color code (e.g., "01")
  colorSlug: string; // Color slug (e.g., "black")
  size: string; // Size (e.g., "35")
  isValid: boolean;
  error?: string;
}

export interface InventoryUpdateRow {
  sku: string;
  quantity: number;
  parsed?: ParsedInventorySku;
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

export interface InventoryUpdateResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
  details: InventoryUpdateRow[];
}

/**
 * Parse an inventory SKU into its components
 * Format: PPPP-PPPPCCSS (e.g., "4925-03010135")
 */
export function parseInventorySku(sku: string): ParsedInventorySku {
  const trimmedSku = sku.trim();

  // Validate SKU format (should be at least 12 characters: 8 for product + 2 for color + 2 for size)
  if (!trimmedSku || trimmedSku.length < 12) {
    return {
      fullSku: trimmedSku,
      productSku: '',
      colorCode: '',
      colorSlug: '',
      size: '',
      isValid: false,
      error: 'SKU too short. Expected format: PPPP-PPPPCCSS (min 12 chars)',
    };
  }

  // Extract product SKU (first 9 characters including dash: "4925-0301")
  const productSku = trimmedSku.substring(0, 9);

  // Validate product SKU has dash in correct position
  if (productSku[4] !== '-') {
    return {
      fullSku: trimmedSku,
      productSku: '',
      colorCode: '',
      colorSlug: '',
      size: '',
      isValid: false,
      error: 'Invalid product SKU format. Expected dash at position 5 (e.g., "4925-0301")',
    };
  }

  // Extract color code (2 digits after product SKU)
  const colorCode = trimmedSku.substring(9, 11);

  // Validate color code is numeric
  if (!/^\d{2}$/.test(colorCode)) {
    return {
      fullSku: trimmedSku,
      productSku,
      colorCode: '',
      colorSlug: '',
      size: '',
      isValid: false,
      error: `Invalid color code: "${colorCode}". Expected 2 digits`,
    };
  }

  // Map color code to slug
  const colorSlug = COLOR_CODE_MAP[colorCode];
  if (!colorSlug) {
    return {
      fullSku: trimmedSku,
      productSku,
      colorCode,
      colorSlug: '',
      size: '',
      isValid: false,
      error: `Unknown color code: "${colorCode}". Please add to COLOR_CODE_MAP`,
    };
  }

  // Extract size (last 2 digits)
  const size = trimmedSku.substring(11, 13);

  // Validate size is numeric
  if (!/^\d{2}$/.test(size)) {
    return {
      fullSku: trimmedSku,
      productSku,
      colorCode,
      colorSlug,
      size: '',
      isValid: false,
      error: `Invalid size: "${size}". Expected 2 digits`,
    };
  }

  return {
    fullSku: trimmedSku,
    productSku,
    colorCode,
    colorSlug,
    size,
    isValid: true,
  };
}

/**
 * Update inventory from CSV data
 * Updates both Firebase and Neon databases
 */
export async function updateInventoryFromCsv(
  rows: InventoryUpdateRow[]
): Promise<InventoryUpdateResult> {
  const result: InventoryUpdateResult = {
    total: rows.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  // Parse all SKUs first
  const parsedRows = rows.map((row) => {
    const parsed = parseInventorySku(row.sku);


    return {
      ...row,
      parsed,
      status: parsed.isValid ? ('pending' as const) : ('error' as const),
      error: parsed.error,
    };
  });

  // Group by product SKU for batch updates
  const productGroups = new Map<string, InventoryUpdateRow[]>();

  for (const row of parsedRows) {
    if (row.parsed?.isValid) {
      const productSku = row.parsed.productSku;
      if (!productGroups.has(productSku)) {
        productGroups.set(productSku, []);
      }
      productGroups.get(productSku)!.push(row);
    } else {
      result.failed++;
      result.errors.push(`Skipped invalid SKU: ${row.sku} - ${row.error}`);
      result.details.push(row);
    }
  }

  // Process each product
  for (const [productSku, productRows] of productGroups.entries()) {
    try {
      // Update Firebase
      await updateFirebaseInventory(productSku, productRows);

      // Update Neon (PostgreSQL)
      await updateNeonInventory(productSku, productRows);

      // Mark all rows for this product as success
      for (const row of productRows) {
        row.status = 'success';
        result.success++;
      }

      result.details.push(...productRows);
    } catch (error) {
      // Mark all rows for this product as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      for (const row of productRows) {
        row.status = 'error';
        row.error = errorMessage;
        result.failed++;
      }

      result.errors.push(`Failed to update product ${productSku}: ${errorMessage}`);
      result.details.push(...productRows);
    }
  }

  return result;
}

/**
 * Update Firebase inventory for a product
 */
async function updateFirebaseInventory(
  productSku: string,
  rows: InventoryUpdateRow[]
): Promise<void> {
  try {
    // Query Firestore for the product with this SKU
    const { query, collection, where, getDocs } = await import('firebase/firestore');
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('sku', '==', productSku));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error(`Product not found in Firebase: ${productSku}`);
    }

    const productDoc = querySnapshot.docs[0];
    const productData = productDoc.data();

    // Get existing colorVariants
    const colorVariants = productData.colorVariants || {};

    // Update stock for each row
    for (const row of rows) {
      const { colorSlug, size } = row.parsed!;


      // Initialize color variant if it doesn't exist
      if (!colorVariants[colorSlug]) {
        const availableColors = Object.keys(colorVariants).join(', ') || 'none';
        throw new Error(
          `Color variant "${colorSlug}" not found for product ${productSku}. Available colors: ${availableColors}`
        );
      }

      // Initialize stockBySize if it doesn't exist
      if (!colorVariants[colorSlug].stockBySize) {
        colorVariants[colorSlug].stockBySize = {};
      }

      // Update stock for this size
      colorVariants[colorSlug].stockBySize[size] = row.quantity;
    }


    // Update the product document
    const productRef = doc(db, 'products', productDoc.id);
    await updateDoc(productRef, {
      colorVariants,
      updatedAt: new Date(),
    });

  } catch (error) {
    console.error(`❌ Firebase: Failed to update product ${productSku}:`, error);
    throw error;
  }
}

/**
 * Update Neon (PostgreSQL) inventory for a product
 */
async function updateNeonInventory(
  productSku: string,
  rows: InventoryUpdateRow[]
): Promise<void> {
  try {
    // Find the product in Neon
    const product = await prisma.product.findFirst({
      where: { sku: productSku },
      select: {
        id: true,
        sku: true,
        colorVariants: true,
      },
    });

    if (!product) {
      throw new Error(`Product not found in Neon: ${productSku}`);
    }

    // Get existing colorVariants JSON
    const colorVariants = (product.colorVariants as any) || {};

    // Update stock for each row
    for (const row of rows) {
      const { colorSlug, size } = row.parsed!;


      // Check if color variant exists, create if it doesn't
      if (!colorVariants[colorSlug]) {
        const availableColors = Object.keys(colorVariants).join(', ') || 'none';
        throw new Error(
          `Color variant "${colorSlug}" not found in Neon for product ${productSku}. Available colors: ${availableColors}`
        );
      }

      // Initialize stockBySize if it doesn't exist
      if (!colorVariants[colorSlug].stockBySize) {
        colorVariants[colorSlug].stockBySize = {};
      }

      // Update stock for this size
      colorVariants[colorSlug].stockBySize[size] = row.quantity;
    }

    // Update the product with modified colorVariants
    await prisma.product.update({
      where: { id: product.id },
      data: {
        colorVariants,
        updatedAt: new Date(),
      },
    });

  } catch (error) {
    console.error(`❌ Neon: Failed to update product ${productSku}:`, error);
    throw error;
  }
}

/**
 * Parse CSV content into inventory update rows
 */
export function parseCsvContent(csvContent: string): InventoryUpdateRow[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  // Parse header
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  const skuIndex = headers.indexOf('sku');
  const quantityIndex = headers.indexOf('quantity');

  if (skuIndex === -1) {
    throw new Error('CSV must have a "sku" column');
  }

  if (quantityIndex === -1) {
    throw new Error('CSV must have a "quantity" column');
  }

  // Parse data rows
  const rows: InventoryUpdateRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());

    if (values.length < Math.max(skuIndex, quantityIndex) + 1) {
      console.warn(`Row ${i + 1}: Not enough columns, skipping`);
      continue;
    }

    const sku = values[skuIndex];
    const quantity = parseInt(values[quantityIndex], 10);

    if (!sku) {
      console.warn(`Row ${i + 1}: Missing SKU, skipping`);
      continue;
    }

    if (isNaN(quantity) || quantity < 0) {
      console.warn(`Row ${i + 1}: Invalid quantity "${values[quantityIndex]}", skipping`);
      continue;
    }

    rows.push({ sku, quantity });
  }

  return rows;
}

/**
 * Build a full inventory SKU from components
 */
export function buildInventorySku(
  productSku: string,
  colorSlug: string,
  size: string
): string | null {
  const colorCode = COLOR_SLUG_TO_CODE[colorSlug];
  if (!colorCode) {
    console.error(`Unknown color slug: ${colorSlug}`);
    return null;
  }

  // Ensure size is 2 digits
  const paddedSize = size.padStart(2, '0');

  return `${productSku}${colorCode}${paddedSize}`;
}

/**
 * Sync inventory from Verifone SOAP API for all products
 * Iterates over all products in Neon and updates inventory from Verifone
 */
export async function syncInventoryFromVerifone(): Promise<InventoryUpdateResult> {
  const result: InventoryUpdateResult = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  console.log('[INVENTORY_SYNC] Starting inventory sync from Verifone...');

  try {
    // Fetch all products from Neon (only SKU field needed)
    const products = await prisma.product.findMany({
      select: {
        sku: true,
      },
    });

    console.log(`[INVENTORY_SYNC] Found ${products.length} products to sync`);

    if (products.length === 0) {
      console.warn('[INVENTORY_SYNC] No products found in database');
      return result;
    }

    // Collect all inventory rows from all products
    const allInventoryRows: InventoryUpdateRow[] = [];

    // Process each product
    for (const product of products) {
      const productSku = product.sku;

      if (!productSku) {
        console.warn(`[INVENTORY_SYNC] Skipping product with empty SKU`);
        result.skipped++;
        continue;
      }

      try {
        // Call Verifone SOAP API to get stock for this product
        const verifoneResult = await getStockByModel(productSku);

        if (!verifoneResult.success) {
          const errorMsg = `Failed to get stock from Verifone for SKU ${productSku}: ${verifoneResult.statusDescription || 'Unknown error'}`;
          console.error(`[INVENTORY_SYNC] ${errorMsg}`);
          result.failed++;
          result.errors.push(errorMsg);
          continue;
        }

        // If no items returned, skip (product might not exist in Verifone)
        if (!verifoneResult.items || verifoneResult.items.length === 0) {
          console.log(`[INVENTORY_SYNC] No inventory items found for SKU ${productSku}`);
          result.skipped++;
          continue;
        }

        // Convert Verifone items to InventoryUpdateRow format
        for (const item of verifoneResult.items) {
          // Build full SKU: productSku + colorCode + size
          const fullSku = `${item.sku}${item.colorCode}${item.size}`;

          // Validate and parse the SKU
          const parsed = parseInventorySku(fullSku);

          if (!parsed.isValid) {
            const errorMsg = `Invalid SKU format for ${fullSku}: ${parsed.error}`;
            console.warn(`[INVENTORY_SYNC] ${errorMsg}`);
            result.failed++;
            result.errors.push(errorMsg);
            continue;
          }

          // Add to inventory rows
          allInventoryRows.push({
            sku: fullSku,
            quantity: item.quantity,
            parsed,
            status: 'pending',
          });
        }

        console.log(
          `[INVENTORY_SYNC] Processed ${verifoneResult.items.length} inventory items for SKU ${productSku}`
        );
      } catch (error) {
        const errorMsg = `Error processing product ${productSku}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[INVENTORY_SYNC] ${errorMsg}`, error);
        result.failed++;
        result.errors.push(errorMsg);
        // Continue with next product
        continue;
      }
    }

    result.total = allInventoryRows.length;

    if (allInventoryRows.length === 0) {
      console.log('[INVENTORY_SYNC] No inventory rows to update');
      return result;
    }

    // Group inventory rows by product SKU for batch updates
    const productGroups = new Map<string, InventoryUpdateRow[]>();

    for (const row of allInventoryRows) {
      if (row.parsed?.isValid) {
        const productSku = row.parsed.productSku;
        if (!productGroups.has(productSku)) {
          productGroups.set(productSku, []);
        }
        productGroups.get(productSku)!.push(row);
      } else {
        result.failed++;
        const errorMsg = `Skipped invalid SKU: ${row.sku} - ${row.parsed?.error || 'Unknown error'}`;
        result.errors.push(errorMsg);
        result.details.push(row);
      }
    }

    console.log(
      `[INVENTORY_SYNC] Processing ${productGroups.size} product groups for update`
    );

    // Process each product group
    for (const [productSku, productRows] of productGroups.entries()) {
      try {
        // Update Firebase
        await updateFirebaseInventory(productSku, productRows);

        // Update Neon (PostgreSQL)
        await updateNeonInventory(productSku, productRows);

        // Mark all rows for this product as success
        for (const row of productRows) {
          row.status = 'success';
          result.success++;
        }

        result.details.push(...productRows);

        console.log(
          `[INVENTORY_SYNC] Successfully updated inventory for product ${productSku} (${productRows.length} variants)`
        );
      } catch (error) {
        // Mark all rows for this product as failed
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        for (const row of productRows) {
          row.status = 'error';
          row.error = errorMessage;
          result.failed++;
        }

        const errorMsg = `Failed to update product ${productSku}: ${errorMessage}`;
        result.errors.push(errorMsg);
        result.details.push(...productRows);

        console.error(`[INVENTORY_SYNC] ${errorMsg}`);
        // Continue with next product
        continue;
      }
    }

    console.log('[INVENTORY_SYNC] Inventory sync completed', {
      total: result.total,
      success: result.success,
      failed: result.failed,
      skipped: result.skipped,
    });

    return result;
  } catch (error) {
    const errorMsg = `Fatal error during inventory sync: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`[INVENTORY_SYNC] ${errorMsg}`, error);
    result.errors.push(errorMsg);
    return result;
  }
}

