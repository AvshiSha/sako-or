/**
 * SKU Parser Utility
 * Parses SKUs in format: baseSku-color-size (e.g., "0000-0000-black-35")
 * into separate components
 */

export interface ParsedSku {
  baseSku: string;      // e.g., "0000-0000"
  colorName: string | null;  // e.g., "black"
  size: string | null;       // e.g., "35"
  fullSku: string;      // original SKU
}

/**
 * Parse a full SKU into its components
 * Expected format: baseSku-color-size
 * Examples:
 *   "0000-0000-black-35" -> { baseSku: "0000-0000", colorName: "black", size: "35" }
 *   "1234-5678-red-M" -> { baseSku: "1234-5678", colorName: "red", size: "M" }
 *   "0000-0000" -> { baseSku: "0000-0000", colorName: null, size: null }
 */
export function parseSku(fullSku: string): ParsedSku {
  if (!fullSku) {
    return {
      baseSku: '',
      colorName: null,
      size: null,
      fullSku: '',
    };
  }

  // Split by dash
  const parts = fullSku.split('-');

  // If we have at least 4 parts, assume format is: part1-part2-color-size
  // where baseSku is the first parts joined (e.g., "0000-0000")
  if (parts.length >= 4) {
    // The last two parts are size and color
    const size = parts[parts.length - 1];
    const colorName = parts[parts.length - 2];
    
    // Everything before the last two parts is the base SKU
    const baseSku = parts.slice(0, -2).join('-');

    return {
      baseSku,
      colorName,
      size,
      fullSku,
    };
  }

  // If format doesn't match, return the whole thing as baseSku
  return {
    baseSku: fullSku,
    colorName: null,
    size: null,
    fullSku,
  };
}

/**
 * Build a full SKU from components
 */
export function buildSku(baseSku: string, colorName?: string | null, size?: string | null): string {
  let sku = baseSku;
  
  if (colorName) {
    sku += `-${colorName}`;
  }
  
  if (size) {
    sku += `-${size}`;
  }
  
  return sku;
}

/**
 * Test if a SKU is in the combined format
 */
export function isFullSku(sku: string): boolean {
  const parts = sku.split('-');
  return parts.length >= 4;
}

/**
 * Extract just the base SKU (without color and size)
 */
export function getBaseSku(fullSku: string): string {
  return parseSku(fullSku).baseSku;
}

/**
 * Extract just the color from a full SKU
 */
export function getColorFromSku(fullSku: string): string | null {
  return parseSku(fullSku).colorName;
}

/**
 * Extract just the size from a full SKU
 */
export function getSizeFromSku(fullSku: string): string | null {
  return parseSku(fullSku).size;
}

