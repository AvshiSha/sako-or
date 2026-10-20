/**
 * Every string the staff warehouse screen renders.
 *
 * One module-level object, which is this repository's convention for UI copy:
 * `next-intl` is not installed, the i18next setup in `app/i18n.ts` is dead
 * code with zero `useTranslation` call sites, and admin screens use exactly
 * this shape (see `admin/coupons/_components/CouponForm.tsx`). Keeping the copy
 * here rather than inline means the Hebrew can be reviewed in one place and the
 * error states can be unit tested.
 *
 * This surface is Hebrew-only -- it is an internal tool for an Israeli
 * warehouse -- so there is no locale key and no `lng` ternary.
 */

import type { ModelCodeReason } from './model-code'
import type { LocationValidationError } from './warehouse-config'

/** Separator between the three parts of a location, as the brief specifies. */
const LOCATION_SEPARATOR = ' · '

export const staffText = {
  // --- shell -------------------------------------------------------------
  appName: 'מלאי ומיקומים',
  pageTitle: 'מלאי ומיקומים במחסן',
  signOut: 'יציאה',

  // --- lookup ------------------------------------------------------------
  modelLabel: 'מספר דגם',
  modelHint: '8 ספרות, לדוגמה 4925-0301',
  searchAction: 'חיפוש',
  refreshAction: 'רענון מלאי',
  refreshing: 'מרענן...',
  // Kept short deliberately: it sits inside the Search button, and a long
  // label would resize the button and reflow the row mid-search.
  searching: 'מחפש...',
  lastUpdatedPrefix: 'עודכן לאחרונה',
  emptyPrompt: 'הזינו מספר דגם כדי לראות מלאי ומיקום',

  // --- results -----------------------------------------------------------
  colorsHeading: 'צבעים',
  sizeColumn: 'מידה',
  quantityColumn: 'מלאי',
  totalLabel: 'סך הכל',
  oneSize: 'מידה אחת',
  roomLabel: 'חדר',
  routeLabel: 'מסלול',
  drawerLabel: 'מגירה',
  editLocation: 'עריכת מיקום',

  // --- distinct states ---------------------------------------------------
  /** A model/colour with no assignment yet. A valid state, not an error. */
  noLocation: 'טרם הוגדר מיקום',
  /** Verifone unreachable, timed out, or returned a failure. Never shown as 0. */
  stockUnavailable: 'לא ניתן לקבל מלאי כרגע',
  /**
   * Verifone answered successfully with no rows. Deliberately NOT phrased as
   * "model not found": the response shape cannot tell the two apart, so
   * claiming it would be a guess dressed up as a fact.
   */
  stockEmpty: 'לא התקבלו נתוני מלאי לדגם זה',
  /** Our own database failed. Must never be shown as "no location assigned". */
  locationUnavailable: 'שגיאה בטעינת המיקומים',
  /** Stock kept on screen from an earlier, successful lookup. */
  stockStale: 'מוצגים נתוני מלאי קודמים',
  /** A size we cannot trust, rather than a plausible-looking wrong one. */
  sizeUnknown: 'מידה לא תקינה',
  retryAction: 'נסו שוב',

  // --- manager PIN -------------------------------------------------------
  pinDialogTitle: 'אישור מנהל',
  pinDialogIntro: 'עריכת מיקום דורשת קוד מנהל',
  pinLabel: 'קוד מנהל',
  pinSubmit: 'אישור',
  pinWrong: 'קוד מנהל שגוי',
  pinMissing: 'הזינו קוד מנהל',
  pinNotConfigured: 'קוד מנהל לא הוגדר במערכת. פנו למנהל המערכת.',
  pinInsecure: 'קוד המנהל שהוגדר אינו בטוח ויש להחליפו. פנו למנהל המערכת.',

  // --- editing -----------------------------------------------------------
  editDialogTitle: 'עריכת מיקום',
  currentLocationLabel: 'מיקום נוכחי',
  saveAction: 'שמירה',
  cancelAction: 'ביטול',
  saving: 'שומר...',
  saveSucceeded: 'המיקום נשמר',
  /** A newer location exists. Never silently overwritten. */
  saveConflict: 'המיקום עודכן על ידי מישהו אחר. רעננו ונסו שוב.',
  saveFailed: 'שמירת המיקום נכשלה',
  editPermissionExpired: 'ההרשאה לעריכה פגה. הזינו קוד מנהל שוב.',
  editForbidden: 'אין הרשאה לעדכן מיקום',
  allSizesNote: 'המיקום חל על כל המידות של הצבע הזה',

  // --- sign in -----------------------------------------------------------
  loginTitle: 'כניסת צוות',
  loginSubtitle: 'מלאי ומיקומים במחסן',
  loginEmail: 'דואר אלקטרוני',
  loginPassword: 'סיסמה',
  loginSubmit: 'כניסה',
  loginWorking: 'מתחבר...',
  loginInvalid: 'הכניסה נכשלה. בדקו את הפרטים ונסו שוב.',
  loginNoAccess: 'לחשבון הזה אין הרשאת גישה למחסן',
  loginDisabled: 'החשבון חסום',
  loginTurnstile: 'אימות האבטחה נכשל. נסו שוב.',
  loginThrottled: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.',
  loginGeneric: 'שגיאה בכניסה. נסו שוב.',
} as const

/** Validation copy for the model-number field, keyed by parser reason. */
export const MODEL_CODE_MESSAGES: Record<ModelCodeReason, string> = {
  EMPTY: 'הזינו מספר דגם',
  NON_DIGIT: 'מספר דגם מכיל ספרות בלבד',
  TOO_SHORT: 'מספר דגם חייב להכיל 8 ספרות',
  TOO_LONG: 'מספר דגם חייב להכיל 8 ספרות',
}

/** Server-side location validation failures, for display. */
export const LOCATION_ERROR_MESSAGES: Record<LocationValidationError, string> = {
  ROOM_OUT_OF_RANGE: 'חדר לא חוקי',
  ROUTE_OUT_OF_RANGE: 'מסלול לא חוקי',
  ROUTE_NOT_IN_ROOM: 'המסלול הזה לא קיים בחדר שנבחר',
  DRAWER_OUT_OF_RANGE: 'מגירה לא חוקית',
}

/**
 * `חדר 2 · מסלול 1 · מגירה 18` -- the format named in the brief.
 *
 * The numbers are plain digits inside an RTL string. Digits are neutral in the
 * bidi algorithm and single numbers render correctly either way, which is why
 * only the model number (which contains a dash and would reorder) needs an
 * explicit `dir="ltr"` in the markup.
 */
export function formatLocation(location: {
  room: number
  route: number
  drawer: number
}): string {
  return [
    `${staffText.roomLabel} ${location.room}`,
    `${staffText.routeLabel} ${location.route}`,
    `${staffText.drawerLabel} ${location.drawer}`,
  ].join(LOCATION_SEPARATOR)
}

/** Lockout copy, including the escape hatch so nobody is left stuck. */
export function pinLockedOutMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60))
  return `יותר מדי ניסיונות שגויים. נסו שוב בעוד ${minutes} דקות. בינתיים מנהל יכול לעדכן מיקום דרך ממשק הניהול.`
}

/** Label for a Verifone colour code we have no name for. */
export function unknownColorLabel(colorCode: string): string {
  return `גוון ${colorCode}`
}
