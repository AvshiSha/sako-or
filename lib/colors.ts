/**
 * Color translations and utilities
 * 
 * This file provides a centralized system for color names, hex codes, and translations.
 * All color slugs should be normalized (lowercase, spaces to hyphens) for consistency.
 */

export interface ColorTranslation {
  hex: string;
  en: string;
  he: string; // TODO: Fill in Hebrew translations
}

/**
 * Normalize color slug for consistent matching
 * Converts to lowercase and replaces spaces with hyphens
 */
export function normalizeColorSlug(slug: string): string {
  return slug.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
}

/**
 * Color translations mapping
 * Key: normalized color slug (lowercase, hyphens)
 * Value: translation object with hex, English name, and Hebrew name
 */
export const colorTranslations: Record<string, ColorTranslation> = {
  'black': { hex: '#000000', en: 'Black', he: 'שחור' },
  'white': { hex: '#FFFFFF', en: 'White', he: 'לבן' },
  'red': { hex: '#FF0000', en: 'Red', he: 'אדום' },
  'blue': { hex: '#0000FF', en: 'Blue', he: 'כחול' },
  'green': { hex: '#008000', en: 'Green', he: 'ירוק' },
  'yellow': { hex: '#FFFF00', en: 'Yellow', he: 'צהוב' },
  'purple': { hex: '#800080', en: 'Purple', he: 'סגול' },
  'pink': { hex: '#FFC0CB', en: 'Pink', he: 'ורוד' },
  'orange': { hex: '#FFA500', en: 'Orange', he: 'כתום' },
  'light-brown': { hex: '#b5651d', en: 'Light Brown', he: 'חום בהיר' },
  'dark-brown': { hex: '#654321', en: 'Dark Brown', he: 'חום כהה' },
  'gray': { hex: '#808080', en: 'Gray', he: 'אפור' },
  'grey': { hex: '#808080', en: 'Grey', he: 'אפור' },
  'navy': { hex: '#000080', en: 'Navy', he: 'כחול כהה' },
  'beige': { hex: '#F5F5DC', en: 'Beige', he: 'בז' },
  'gold': { hex: '#FFD700', en: 'Gold', he: 'זהב' },
  'silver': { hex: '#C0C0C0', en: 'Silver', he: 'כסף' },
  'off-white': { hex: '#f5f5f5', en: 'Off White', he: 'אוף וויט' },
  'light-blue': { hex: '#ADD8E6', en: 'Light Blue', he: 'תכלת' },
  'dark-blue': { hex: '#000080', en: 'Dark Blue', he: 'כחול כהה' },
  'bordeaux': { hex: '#800020', en: 'Bordeaux', he: 'בורדו' },
  'black-nail-polish': { hex: '#000000', en: 'Black Nail Polish', he: 'שחור לק' },
  'olive': { hex: '#808000', en: 'Olive', he: 'זית' },
  'multicolor': { hex: '#FF0000', en: 'Multicolor', he: 'מולטיקולור' },
  'black-white': { hex: '#000000', en: 'Black & White', he: 'שחור ולבן' },
  'black-and-white': { hex: '#000000', en: 'Black & White', he: 'שחור ולבן' },
  'transparent': { hex: '#FFFFFF', en: 'Transparent', he: 'שקוף' },
  'camel': { hex: '#C19A6B', en: 'Camel', he: 'כאמל' },
  'light-pink': { hex: '#FFB6C1', en: 'Light Pink', he: 'ורוד בהיר' },
  'caramel': { hex: '#b5651d', en: 'Caramel', he: 'קרמל' },
  'bronze': { hex: '#CD7F32', en: 'Bronze', he: 'ארד' },
  'black-red': { hex: '#420000', en: 'Black & Red', he: 'שחור ואדום' },
};

/**
 * Get the localized color name for a given color slug
 * @param colorSlug - The color slug (can be in any format)
 * @param language - The target language ('en' or 'he')
 * @returns The localized color name, or the original slug if not found
 */
export function getColorName(colorSlug: string, language: 'en' | 'he'): string {
  if (!colorSlug) return '';
  
  // Trim whitespace
  const trimmed = colorSlug.trim();
  if (!trimmed) return '';
  
  const normalized = normalizeColorSlug(trimmed);
  
  // Direct lookup in colorTranslations
  const translation = colorTranslations[normalized];
  
  if (translation && translation[language]) {
    return translation[language];
  }
  
  // Fallback: return the original slug if no translation found
  // This ensures we don't return undefined or empty strings
  return trimmed;
}

/**
 * Get the hex color code for a given color slug
 * @param colorSlug - The color slug (can be in any format)
 * @returns The hex color code, or '#CCCCCC' (light gray) if not found
 */
export function getColorHex(colorSlug: string): string {
  if (!colorSlug) return '#CCCCCC';
  
  const normalized = normalizeColorSlug(colorSlug);
  const translation = colorTranslations[normalized];
  
  if (translation) {
    return translation.hex;
  }
  
  // Fallback: return light gray if no color found
  return '#CCCCCC';
}

/**
 * Get the full color translation object for a given color slug
 * @param colorSlug - The color slug (can be in any format)
 * @returns The color translation object, or null if not found
 */
export function getColorTranslation(colorSlug: string): ColorTranslation | null {
  if (!colorSlug) return null;
  
  const normalized = normalizeColorSlug(colorSlug);
  return colorTranslations[normalized] || null;
}

/**
 * Check if a color slug has a translation
 * @param colorSlug - The color slug to check
 * @returns True if the color has a translation, false otherwise
 */
export function hasColorTranslation(colorSlug: string): boolean {
  if (!colorSlug) return false;
  
  const normalized = normalizeColorSlug(colorSlug);
  return normalized in colorTranslations;
}

/**
 * Get all available color slugs (normalized)
 * @returns Array of normalized color slugs
 */
export function getAllColorSlugs(): string[] {
  return Object.keys(colorTranslations);
}

/**
 * Get all color translations
 * @returns The full color translations object
 */
export function getAllColorTranslations(): Record<string, ColorTranslation> {
  return colorTranslations;
}

