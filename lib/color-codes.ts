/**
 * Verifone colour-code <-> website colour-slug mapping.
 *
 * Extracted out of `lib/inventory.ts` so it can be imported by pure, unit-
 * testable modules. That extraction is not cosmetic: `lib/inventory.ts`
 * imports `./firebase-admin` and `./verifone`, both of which `import
 * 'server-only'`, and `server-only` throws under plain `tsx` — which is how
 * `npm test` runs. Anything under test therefore has to reach the map from
 * here, not from there.
 *
 * `lib/inventory.ts` re-exports both constants, so every existing import site
 * keeps working and there is still exactly one definition.
 *
 * Codes are sparse and non-contiguous on purpose — they mirror whatever
 * Verifone actually emits, not a tidy sequence. The spellings `tabbacco`,
 * `capuchino` and `lyla` are deliberate: they match the slugs already stored
 * against products, and "fixing" them would break those joins.
 */

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
  '29': 'light-blue',
  '30': 'orange',
  '33': 'olive',
  '35': 'gray',
  '37': 'turquoise',
  '57': 'purple',
  '61': 'dark-gray',
  '69': 'camel',
  '89': 'natural',
  '91': 'multicolor',
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
