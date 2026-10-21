import { z } from 'zod'

import { parseModelCode } from '@/lib/staff/model-code'
import {
  MAX_DRAWER,
  MAX_ROOM,
  MAX_ROUTE,
  MIN_DRAWER,
  MIN_ROOM,
  MIN_ROUTE,
} from '@/lib/staff/warehouse-config'
import { MAX_PIN_LENGTH, MIN_PIN_LENGTH } from '@/lib/staff/pin-hash'

/**
 * Request schemas for the staff warehouse API.
 *
 * Kept in `lib/schemas/` with the other zod schemas, and used with `safeParse`
 * in the route so `issues` can be returned to the client -- the shape
 * `issuesToFieldMap` in `lib/admin/faq-client.ts` already consumes.
 *
 * These are the OUTER bound. They stop malformed input early and keep the
 * Verifone argument to eight digits, which is also why the SOAP envelope in
 * `lib/verifone.ts` cannot be injected into despite interpolating `itemCode`
 * without escaping. The authoritative location check is still
 * `validateLocation` in the service, because only it knows which routes exist
 * in which room.
 */

/**
 * A model number in either accepted form, normalised to canonical `XXXX-XXXX`.
 *
 * `transform` after validation, so every downstream consumer -- the Verifone
 * call, the database key, the response body -- sees one representation.
 */
export const modelCodeSchema = z
  .string()
  .min(1)
  .max(32)
  .superRefine((value, ctx) => {
    const parsed = parseModelCode(value)
    if (!parsed.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid model number (${parsed.reason})`,
      })
    }
  })
  .transform((value) => {
    const parsed = parseModelCode(value)
    // superRefine has already rejected anything unparseable.
    return parsed.ok ? parsed.canonical : value
  })

/**
 * Verifone's own two-character colour code, which is the stable join key.
 *
 * Not restricted to the codes in `COLOR_CODE_MAP`: a colour Verifone knows
 * about but the website does not must still be assignable to a drawer, which is
 * the whole reason the code rather than the slug is the key.
 */
export const colorCodeSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{2}$/, 'Colour code must be two alphanumeric characters')

export const stockQuerySchema = z.object({
  model: modelCodeSchema,
})

export const unlockLocationSchema = z.object({
  modelCode: modelCodeSchema,
  colorCode: colorCodeSchema,
  pin: z.string().min(MIN_PIN_LENGTH).max(MAX_PIN_LENGTH),
})

export const saveLocationSchema = z.object({
  modelCode: modelCodeSchema,
  colorCode: colorCodeSchema,
  room: z.number().int().min(MIN_ROOM).max(MAX_ROOM),
  route: z.number().int().min(MIN_ROUTE).max(MAX_ROUTE),
  /**
   * Null for a floor placement. The consistency rule between these two is
   * enforced by the `superRefine` below, by `validateLocation` in the service,
   * and by a CHECK constraint in the database -- three layers, because two
   * different stored shapes meaning the same location is the kind of thing that
   * is very hard to unpick later.
   */
  drawer: z.number().int().min(MIN_DRAWER).max(MAX_DRAWER).nullable(),
  placement: z.enum(['DRAWER', 'FLOOR']),
  /**
   * The version the client was shown, or null when it was shown "unassigned".
   * Required -- not optional -- so a client cannot omit it and get
   * last-write-wins by accident.
   */
  expectedVersion: z.number().int().min(0).nullable(),
  /** The manager grant to spend. Absent on the admin path. */
  grantId: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  if (value.placement === 'FLOOR' && value.drawer !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['drawer'],
      message: 'A floor placement carries no drawer number',
    })
  }
  if (value.placement === 'DRAWER' && value.drawer === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['drawer'],
      message: 'A drawer placement requires a drawer number',
    })
  }
})

/**
 * The admin path takes no manager grant -- the admin session is the
 * authorization. Declared via `innerType().omit(...)` because `superRefine`
 * returns a ZodEffects, which has no `.omit`; the refinement is re-applied so
 * the drawer/placement consistency rule still holds on this path.
 */
export const adminSaveLocationSchema = saveLocationSchema
  .innerType()
  .omit({ grantId: true })
  .superRefine((value, ctx) => {
    if (value.placement === 'FLOOR' && value.drawer !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['drawer'],
        message: 'A floor placement carries no drawer number',
      })
    }
    if (value.placement === 'DRAWER' && value.drawer === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['drawer'],
        message: 'A drawer placement requires a drawer number',
      })
    }
  })

export const historyQuerySchema = z.object({
  modelCode: modelCodeSchema,
  colorCode: colorCodeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export type StockQuery = z.infer<typeof stockQuerySchema>
export type UnlockLocationInput = z.infer<typeof unlockLocationSchema>
export type SaveLocationRequest = z.infer<typeof saveLocationSchema>
