/**
 * Hebrew text normalization utilities.
 * Keep in sync with PostgreSQL function normalize_hebrew_search() in
 * prisma/migrations/20260606000000_hebrew_search_pg_trgm/migration.sql
 */

const MAX_SEARCH_TERMS = 20;

/**
 * Product type variations (Hebrew)
 */
const PRODUCT_TYPE_VARIATIONS: Record<string, string[]> = {
  'כפכפים': ['כפכף', 'כפכפ', 'קבקב', 'קבקבים'],
  'כפכף': ['כפכפים', 'קבקב', 'קבקבים'],
  'נעליים': ['נעל', 'נעלה', 'נעליה'],
  'נעל': ['נעליים', 'נעליות'],
  'נעלה': ['נעליים', 'נעליות'],
  'נעלי סירה': ['נעלי סירה', 'נעל סירה', 'נעלי סירות', 'נעל סירה'],
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
  'תיקים': ['תיק', 'תיקה'],
  'תיק': ['תיקים', 'תיקות'],
  'תיקה': ['תיקים', 'תיקות'],
  'מעילים': ['מעיל', 'מעילה'],
  'מעיל': ['מעילים', 'מעילות'],
  'מעילה': ['מעילים', 'מעילות'],
};

function pluralToSingular(word: string): string | null {
  if (PRODUCT_TYPE_VARIATIONS[word]) {
    const variations = PRODUCT_TYPE_VARIATIONS[word];
    for (const variant of variations) {
      if (!variant.endsWith('ים') && !variant.endsWith('ות')) {
        return variant;
      }
    }
  }

  if (word.endsWith('ים') && word.length > 2) {
    return word.slice(0, -2);
  }
  if (word.endsWith('ות') && word.length > 2) {
    return word.slice(0, -2) + 'ה';
  }
  return null;
}

function singularToPlural(word: string): string[] {
  const plurals: string[] = [];

  if (PRODUCT_TYPE_VARIATIONS[word]) {
    PRODUCT_TYPE_VARIATIONS[word].forEach((variant: string) => {
      if (variant.endsWith('ים') || variant.endsWith('ות') || variant.includes(' ')) {
        plurals.push(variant);
      }
    });
  }

  if (word.endsWith('ה')) {
    plurals.push(word.slice(0, -1) + 'ות');
  }

  plurals.push(word + 'ים');
  return plurals;
}

const HEBREW_COLOR_VARIATIONS: Record<string, string[]> = {
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

export function generateHebrewVariations(word: string): string[] {
  if (!word || !/[\u0590-\u05FF]/.test(word)) {
    return word ? [word] : []
  }

  const variations = new Set<string>([word]);
  const isPlural = word.endsWith('ים') || word.endsWith('ות');

  if (isPlural) {
    const singular = pluralToSingular(word);
    if (singular) {
      variations.add(singular);
    }
  } else {
    singularToPlural(word).forEach((plural) => variations.add(plural));
  }

  const lowerWord = word.toLowerCase();
  if (HEBREW_COLOR_VARIATIONS[lowerWord]) {
    HEBREW_COLOR_VARIATIONS[lowerWord].forEach((variant) => variations.add(variant));
  }

  for (const [base, variants] of Object.entries(HEBREW_COLOR_VARIATIONS)) {
    if (variants.includes(lowerWord) || variants.includes(word)) {
      variations.add(base);
      variants.forEach((v) => variations.add(v));
    }
  }

  if (PRODUCT_TYPE_VARIATIONS[word]) {
    PRODUCT_TYPE_VARIATIONS[word].forEach((variant: string) => variations.add(variant));
  }

  for (const [base, variants] of Object.entries(PRODUCT_TYPE_VARIATIONS)) {
    if ((variants as string[]).includes(word)) {
      variations.add(base);
      (variants as string[]).forEach((v: string) => variations.add(v));
    }
  }

  return Array.from(variations).filter((v) => v.length > 0);
}

export function expandHebrewQuery(query: string): string[] {
  if (!query || typeof query !== 'string') {
    return [];
  }

  const words = query.split(/\s+/).filter((w) => w && typeof w === 'string' && w.length > 0);
  const expandedWords: string[] = [];

  words.forEach((word) => {
    if (word && typeof word === 'string') {
      generateHebrewVariations(word).forEach((v) => {
        if (v && typeof v === 'string' && v.length > 0) {
          expandedWords.push(v);
        }
      });
    }
  });

  if (words.length > 1) {
    expandedWords.push(query);

    const firstWordVariations = generateHebrewVariations(words[0]);
    const lastWordVariations =
      words.length > 1 ? generateHebrewVariations(words[words.length - 1]) : [];

    firstWordVariations.slice(0, 3).forEach((v1) => {
      if (v1 && typeof v1 === 'string') {
        expandedWords.push(`${v1} ${words.slice(1).join(' ')}`);
      }
    });

    lastWordVariations.slice(0, 3).forEach((vLast) => {
      if (vLast && typeof vLast === 'string') {
        expandedWords.push(`${words.slice(0, -1).join(' ')} ${vLast}`);
      }
    });
  } else if (words.length === 1) {
    expandedWords.push(query);
  }

  return Array.from(new Set(expandedWords)).filter(
    (v) => v && typeof v === 'string' && v.trim().length > 0
  );
}

/**
 * Normalize text for search: sofit letters, niqqud, punctuation, whitespace.
 */
export function normalizeHebrewForSearch(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .trim()
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/ם/g, 'מ')
    .replace(/ן/g, 'נ')
    .replace(/ץ/g, 'צ')
    .replace(/ף/g, 'פ')
    .replace(/ך/g, 'כ')
    .replace(/[''"״׳]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * Build deduplicated search terms from a query (normalized + morphological variants).
 */
export function buildSearchQueryTerms(query: string): string[] {
  if (!query?.trim()) {
    return [];
  }

  const terms = new Set<string>();
  const trimmed = query.trim();
  const normalized = normalizeHebrewForSearch(trimmed);

  terms.add(trimmed);
  if (normalized) {
    terms.add(normalized);
  }

  expandHebrewQuery(trimmed).forEach((t) => {
    terms.add(t);
    const n = normalizeHebrewForSearch(t);
    if (n) {
      terms.add(n);
    }
  });

  if (normalized !== trimmed) {
    expandHebrewQuery(normalized).forEach((t) => terms.add(t));
  }

  const tokens = normalized.split(/\s+/).filter((w) => w.length > 0);
  tokens.forEach((token) => {
    terms.add(token);
    if (/[\u0590-\u05FF]/.test(token)) {
      generateHebrewVariations(token).forEach((v) => {
        terms.add(v);
        const n = normalizeHebrewForSearch(v);
        if (n) {
          terms.add(n);
        }
      });
    }
  });

  return Array.from(terms)
    .filter((t) => t && t.trim().length > 0)
    .slice(0, MAX_SEARCH_TERMS);
}

/**
 * Extract normalized color search text from colorVariants JSON.
 */
export function extractColorsSearchNorm(colorVariants: unknown): string {
  if (!colorVariants || typeof colorVariants !== 'object') {
    return '';
  }

  const parts = new Set<string>();
  for (const [slug, data] of Object.entries(colorVariants as Record<string, unknown>)) {
    if (slug) {
      const normalizedSlug = normalizeHebrewForSearch(slug);
      if (normalizedSlug) {
        parts.add(normalizedSlug);
      }
    }
    if (data && typeof data === 'object') {
      const variant = data as Record<string, unknown>;
      if (variant.colorSlug) {
        const n = normalizeHebrewForSearch(String(variant.colorSlug));
        if (n) parts.add(n);
      }
      if (variant.colorName) {
        const n = normalizeHebrewForSearch(String(variant.colorName));
        if (n) parts.add(n);
      }
    }
  }

  return Array.from(parts).join(' ');
}
