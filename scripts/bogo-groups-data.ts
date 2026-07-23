/** Single source of truth for active BOGO group membership, shared by the
 * Postgres pricing sync (assign-bogo-groups.ts) and the Firestore tag sync
 * (sync-bogo-tags.ts) so the two systems can't drift apart again. */

export const GROUP_SKUS: Record<string, string[]> = {
  'Group 600': [
    '5024-0019',
    '5024-0020',
    '5024-9681',
    '5025-1509',
    '5025-2510',
    '5025-2705',
    '5025-2716',
    '5025-3417',
    '5025-3418',
    '5025-3509',
    '5025-3513',
    '5025-3517',
    '5025-4009',
    '5025-4010',
    '5025-4201',
    '5025-4204',
    '5025-7802',
    '5025-7821',
    '5025-7825',
    '5026-2503',
    '5029-9989',
  ],
  'Group 700': [
    '5024-0017',
    '5024-3218',
    '5025-2901',
    '5025-2911',
    '5025-2917',
    '5025-4011',
    '5025-7826',
    '5029-7060',
    '5025-1305',
    '5025-3516',
  ],
}

/** pairPriceIls per group name (number extracted from "Group 600" -> 600) */
export const GROUP_PAIR_PRICES: Record<string, number> = {
  'Group 600': 600,
  'Group 700': 700,
}

/** Firestore product tag per group (drives what shows on /collection/campaign?slug=bogoXXX). */
export const GROUP_TAGS: Record<string, string> = {
  'Group 600': 'bogo600',
  'Group 700': 'bogo700',
}

/** Tags for groups that have been disabled; any product still carrying these gets untagged. */
export const DISABLED_GROUP_TAGS: string[] = ['bogo450', 'bogo500', 'bogo800']
