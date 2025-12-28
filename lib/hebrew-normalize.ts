/**
 * Hebrew text normalization utilities
 * Handles singular/plural forms, gender variations, and common morphological patterns
 */

/**
 * Common Hebrew plural endings
 */
const HEBREW_PLURAL_ENDINGS = ['ים', 'ות'];

/**
 * Product type variations (Hebrew)
 * Maps plural forms to singular and vice versa
 * Based on common product categories
 */
const PRODUCT_TYPE_VARIATIONS: Record<string, string[]> = {
  // Shoes and footwear
  'כפכפים': ['כפכף', 'כפכפ'],
  'כפכף': ['כפכפים'],
  'נעליים': ['נעל', 'נעלה', 'נעליה'],
  'נעל': ['נעליים', 'נעליות'],
  'נעלה': ['נעליים', 'נעליות'],
  'נעלי סירה': ['נעלי סירה', 'נעל סירה', 'נעלי סירות'],
  'נעל סירה': ['נעלי סירה', 'נעלי סירות'],
  'מגפיים': ['מגף', 'מגפה'],
  'מגף': ['מגפיים', 'מגפות'],
  'מגפונים': ['מגפון', 'מגפונה'],
  'מגפון': ['מגפונים', 'מגפונות'],
  'סניקרס': ['סניקר', 'סניקרה'],
  'סניקר': ['סניקרס', 'סניקרות'],
  'סנדלים': ['סנדל', 'סנדלה'],
  'סנדל': ['סנדלים', 'סנדלות'],
  'מוקסין': ['מוקסין', 'מוקסינים'],
  'בלרינה וסירות שטוחות': ['בלרינה וסירות שטוחות', 'בלרינה', 'סירות שטוחות', 'סירה שטוחה'],
  'בלרינה': ['בלרינה וסירות שטוחות', 'בלרינות'],
  'סירות שטוחות': ['בלרינה וסירות שטוחות', 'סירה שטוחה'],
  'סירה שטוחה': ['בלרינה וסירות שטוחות', 'סירות שטוחות'],
  'אוקספורד': ['אוקספורד', 'אוקספורדים'],
  // Accessories
  'תיקים': ['תיק', 'תיקה'],
  'תיק': ['תיקים', 'תיקות'],
  'תיקה': ['תיקים', 'תיקות'],
  'מעילים': ['מעיל', 'מעילה'],
  'מעיל': ['מעילים', 'מעילות'],
  'מעילה': ['מעילים', 'מעילות'],
};

/**
 * Generate singular from plural
 * כפכפים → כפכף
 * Note: This is a simplified approach - Hebrew morphology is complex
 */
function pluralToSingular(word: string): string | null {
  // Check product type variations first
  if (PRODUCT_TYPE_VARIATIONS[word]) {
    const variations = PRODUCT_TYPE_VARIATIONS[word];
    // Return the first singular form if available
    for (const variant of variations) {
      if (!variant.endsWith('ים') && !variant.endsWith('ות')) {
        return variant;
      }
    }
  }
  
  // Remove -ים ending (most common plural)
  if (word.endsWith('ים') && word.length > 2) {
    return word.slice(0, -2);
  }
  // Remove -ות ending and add ה (feminine plural)
  if (word.endsWith('ות') && word.length > 2) {
    return word.slice(0, -2) + 'ה';
  }
  return null;
}

/**
 * Generate plural from singular
 * כפכף → כפכפים
 */
function singularToPlural(word: string): string[] {
  const plurals: string[] = [];
  
  // Check product type variations first
  if (PRODUCT_TYPE_VARIATIONS[word]) {
    const variations = PRODUCT_TYPE_VARIATIONS[word];
    // Add all variations that are plural forms
    variations.forEach((variant: string) => {
      if (variant.endsWith('ים') || variant.endsWith('ות') || variant.includes(' ')) {
        plurals.push(variant);
      }
    });
  }
  
  // If ends with ה, replace with ות
  if (word.endsWith('ה')) {
    plurals.push(word.slice(0, -1) + 'ות');
  }
  
  // Always add -ים (most common)
  plurals.push(word + 'ים');
  
  return plurals;
}

/**
 * Hebrew color variations
 * Maps different forms of color words
 * Includes all colors from lib/colors.ts
 */
const HEBREW_COLOR_VARIATIONS: Record<string, string[]> = {
  // Basic colors
  'אדום': ['אדומים', 'אדומה', 'אדומות', 'אד'],
  'שחור': ['שחורים', 'שחורה', 'שחורות', 'שח'],
  'לבן': ['לבנים', 'לבנה', 'לבנות', 'לב'],
  'כחול': ['כחולים', 'כחולה', 'כחולות', 'כח'],
  'ירוק': ['ירוקים', 'ירוקה', 'ירוקות', 'יר'],
  'צהוב': ['צהובים', 'צהובה', 'צהובות', 'צה'],
  'חום': ['חומים', 'חומה', 'חומות'],
  'אפור': ['אפורים', 'אפורה', 'אפורות'],
  'ורוד': ['ורודים', 'ורודה', 'ורודות'],
  'סגול': ['סגולים', 'סגולה', 'סגולות'],
  'כתום': ['כתומים', 'כתומה', 'כתומות'],
  // Additional colors from colors.ts
  'חום בהיר': ['חום בהיר', 'חומים בהירים', 'חומה בהירה', 'חומות בהירות'],
  'חום כהה': ['חום כהה', 'חומים כהים', 'חומה כהה', 'חומות כהות'],
  'כחול כהה': ['כחול כהה', 'כחולים כהים', 'כחולה כהה', 'כחולות כהות'],
  'בז': ['בז', 'בזים', 'בזה', 'בזות'],
  'זהב': ['זהב', 'זהבים', 'זהבה', 'זהבות'],
  'כסף': ['כסף', 'כספים', 'כספה', 'כספות'],
  'אוף וויט': ['אוף וויט'],
  'תכלת': ['תכלת', 'תכלות'],
  'בורדו': ['בורדו', 'בורדואים', 'בורדואה', 'בורדואות'],
  'שחור לק': ['שחור לק', 'שחורים לק', 'שחורה לק', 'שחורות לק'],
  'זית': ['זית', 'זיתים', 'זיתה', 'זיתות'],
  'מולטיקולור': ['מולטיקולור', 'מולטיקולורים'],
  'שחור ולבן': ['שחור ולבן', 'שחורים ולבנים', 'שחורה ולבנה', 'שחורות ולבנות'],
  'שקוף': ['שקוף', 'שקופים', 'שקופה', 'שקופות'],
  'כאמל': ['כאמל', 'כאמלים', 'כאמלה', 'כאמלות'],
  'ורוד בהיר': ['ורוד בהיר', 'ורודים בהירים', 'ורודה בהירה', 'ורודות בהירות'],
  'קרמל': ['קרמל', 'קרמלים', 'קרמלה', 'קרמלות'],
  'ארד': ['ארד', 'ארדים', 'ארדה', 'ארדות'],
  'שחור ואדום': ['שחור ואדום', 'שחורים ואדומים', 'שחורה ואדומה', 'שחורות ואדומות'],
};

/**
 * Generate search variations for a Hebrew word
 * Returns array of possible forms (singular, plural, base)
 */
export function generateHebrewVariations(word: string): string[] {
  const variations = new Set<string>([word]); // Always include original
  
  // Check if word is plural (ends with ים or ות)
  const isPlural = word.endsWith('ים') || word.endsWith('ות');
  
  if (isPlural) {
    // Generate singular form
    const singular = pluralToSingular(word);
    if (singular) {
      variations.add(singular);
    }
  } else {
    // Generate plural forms
    const plurals = singularToPlural(word);
    plurals.forEach(plural => variations.add(plural));
  }
  
  // Handle color variations
  const lowerWord = word.toLowerCase();
  if (HEBREW_COLOR_VARIATIONS[lowerWord]) {
    HEBREW_COLOR_VARIATIONS[lowerWord].forEach(variant => {
      variations.add(variant);
    });
  }
  
  // Also check reverse - if word is a variant, add base form
  for (const [base, variants] of Object.entries(HEBREW_COLOR_VARIATIONS)) {
    if (variants.includes(lowerWord) || variants.includes(word)) {
      variations.add(base);
      variants.forEach(v => variations.add(v));
    }
  }
  
  // Handle product type variations
  if (PRODUCT_TYPE_VARIATIONS[word]) {
    PRODUCT_TYPE_VARIATIONS[word].forEach((variant: string) => {
      variations.add(variant);
    });
  }
  
  // Also check reverse - if word is a product type variant, add all variations
  for (const [base, variants] of Object.entries(PRODUCT_TYPE_VARIATIONS)) {
    if ((variants as string[]).includes(word)) {
      variations.add(base);
      (variants as string[]).forEach((v: string) => variations.add(v));
    }
  }
  
  return Array.from(variations).filter(v => v.length > 0);
}

/**
 * Expand a Hebrew search query to include morphological variations
 * Example: "כפכף אדום" → ["כפכף", "כפכפים", "אדום", "אדומים", "אדומה", "אד"]
 * 
 * For multi-word queries, we generate variations for each word and also
 * try to match the phrase as a whole (important for category names like "נעלי סירה")
 */
export function expandHebrewQuery(query: string): string[] {
  if (!query || typeof query !== 'string') {
    return [];
  }
  
  const words = query.split(/\s+/).filter(w => w && typeof w === 'string' && w.length > 0);
  const expandedWords: string[] = [];
  
  // Generate variations for each word
  words.forEach(word => {
    if (word && typeof word === 'string') {
      const variations = generateHebrewVariations(word);
      variations.forEach(v => {
        if (v && typeof v === 'string' && v.length > 0) {
          expandedWords.push(v);
        }
      });
    }
  });
  
  // Also generate variations for the entire phrase (important for category names)
  // For "כפכף אדום", we want to try "כפכפים אדומים" as well
  if (words.length > 1) {
    // Try all combinations of word variations
    expandedWords.push(query); // Always include original
    
    // Generate a few common combinations
    const firstWordVariations = generateHebrewVariations(words[0]);
    const lastWordVariations = words.length > 1 ? generateHebrewVariations(words[words.length - 1]) : [];
    
    // Add combinations: first word variations + rest, or last word variations
    firstWordVariations.slice(0, 3).forEach(v1 => {
      if (v1 && typeof v1 === 'string') {
        const rest = words.slice(1).join(' ');
        expandedWords.push(`${v1} ${rest}`);
      }
    });
    
    if (lastWordVariations.length > 0) {
      lastWordVariations.slice(0, 3).forEach(vLast => {
        if (vLast && typeof vLast === 'string') {
          const beginning = words.slice(0, -1).join(' ');
          expandedWords.push(`${beginning} ${vLast}`);
        }
      });
    }
  } else if (words.length === 1) {
    // Single word - just add original
    expandedWords.push(query);
  }
  
  // Remove duplicates and filter out invalid values
  return Array.from(new Set(expandedWords)).filter(v => v && typeof v === 'string' && v.trim().length > 0);
}

/**
 * Normalize Hebrew text for search (removes common suffixes/prefixes)
 * This helps with partial matches
 */
export function normalizeHebrewForSearch(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .toLowerCase();
}

