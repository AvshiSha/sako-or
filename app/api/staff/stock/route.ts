import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

import { getStockByModel } from '@/lib/verifone'
import { requireStaffRequest } from '@/lib/server/staff-request'
import {
  getWarehouseConfig,
  listLocationsForModel,
} from '@/lib/server/warehouse-locations'
import { loadStaffCatalogEnrichment } from '@/lib/server/staff-catalog'
import {
  combineStock,
  locationOnlyCards,
  type StaffColorCard,
  type StaffCatalogEnrichment,
} from '@/lib/staff/combine-stock'
import { stockQuerySchema } from '@/lib/schemas/staff-stock-schema'

/**
 * Stock and warehouse locations for one model.
 *
 * Authenticate -> validate -> fetch Verifone, our locations and (optionally) the
 * catalog -> combine. Verifone credentials never leave the server and stock is
 * strictly read-only here.
 *
 * ## The three results are fetched together and reported separately
 *
 * `Promise.allSettled`, not a sequence: Verifone can take up to ten seconds and
 * there is no reason for the database read to queue behind it. More importantly
 * it lets each result be reported for what it is. The states this endpoint must
 * keep distinct, per the brief:
 *
 *  - Verifone failed or timed out        -> `stock.state: 'unavailable'`
 *  - Verifone succeeded with no rows     -> `stock.state: 'empty'`
 *  - a real zero for a size              -> an ordinary row with quantity 0
 *  - our location read failed            -> `locations.state: 'error'`
 *  - no location assigned                -> `location: null` on the card
 *
 * A failure of any kind must never surface as a quantity of zero, and a
 * location read failure must never surface as "no location assigned". Those are
 * separate fields here precisely so the UI cannot conflate them.
 *
 * ## On "model not found"
 *
 * There is deliberately no such state. `lib/verifone-stock-parse.ts` answers
 * `{ success: true, items: [] }` on five different missing-node paths, so a
 * model that does not exist and a model with no stock rows are indistinguishable
 * in the response. Reporting "not found" would be a guess presented as a fact,
 * so an empty result is reported as an empty result. See
 * docs/staff-stock-lookup.md.
 */

export const dynamic = 'force-dynamic'

/**
 * `checkRevoked: false` is NOT used here, for the record: the shared session is
 * verified with revocation checking on every call, via
 * `verifyStaffSessionCookie`. One Google round trip is noise next to a SOAP call
 * that can take ten seconds, and a lost iPad needs to stop working the moment
 * the account is revoked rather than up to an hour later.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffRequest(request)
  if (auth instanceof NextResponse) return auth

  const parsed = stockQuerySchema.safeParse({
    model: request.nextUrl.searchParams.get('model') ?? '',
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid model number', code: 'INVALID_MODEL', issues: parsed.error.issues },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const modelCode = parsed.data.model

  const [stockResult, locationsResult, catalogResult] = await Promise.allSettled([
    getStockByModel(modelCode),
    listLocationsForModel(modelCode),
    loadStaffCatalogEnrichment(modelCode),
  ])

  // --- locations -----------------------------------------------------------
  let assignments: Awaited<ReturnType<typeof listLocationsForModel>> = []
  let locationsState: 'ok' | 'error' = 'ok'

  if (locationsResult.status === 'fulfilled') {
    assignments = locationsResult.value
  } else {
    locationsState = 'error'
    Sentry.captureException(locationsResult.reason)
    console.error('[STAFF_STOCK] location read failed', locationsResult.reason)
  }

  // --- catalog (optional; a failure is never fatal) ------------------------
  let catalog: StaffCatalogEnrichment | null = null
  if (catalogResult.status === 'fulfilled') {
    catalog = catalogResult.value
  } else {
    // Not reported to the user at all: a missing name or image is exactly the
    // degraded state this feature is required to work in.
    Sentry.captureException(catalogResult.reason)
    console.warn('[STAFF_STOCK] catalog enrichment failed, continuing', catalogResult.reason)
  }

  // --- stock ---------------------------------------------------------------
  let stockState: 'ok' | 'empty' | 'unavailable' = 'unavailable'
  let stockDetail: string | null = null
  let colors: StaffColorCard[] = []
  let totalQuantity: number | null = null

  if (stockResult.status === 'rejected') {
    Sentry.captureException(stockResult.reason)
    console.error('[STAFF_STOCK] Verifone call threw', stockResult.reason)
  } else if (!stockResult.value.success) {
    // Verifone said no, or we could not reach it. `statusDescription` is kept
    // for support but is upstream wording, so the UI shows its own Hebrew copy.
    stockDetail = stockResult.value.statusDescription ?? null
    console.error('[STAFF_STOCK] Verifone reported failure', {
      modelCode,
      status: stockResult.value.status,
      statusDescription: stockDetail,
    })
  } else {
    const items = stockResult.value.items ?? []
    const combined = combineStock({ modelCode, items, assignments, catalog })

    colors = combined.colors
    totalQuantity = combined.totalQuantity
    stockState = combined.colors.length > 0 ? 'ok' : 'empty'

    if (combined.foreignRowsDropped > 0 || combined.duplicateRowsDropped > 0) {
      console.warn('[STAFF_STOCK] dropped unexpected rows', {
        modelCode,
        foreign: combined.foreignRowsDropped,
        duplicate: combined.duplicateRowsDropped,
      })
    }
  }

  // Verifone is down but we still know where the recorded colours live. Showing
  // that is strictly better than showing nothing, and each card is flagged
  // `stockKnown: false` so no quantity is rendered.
  if (stockState === 'unavailable' && locationsState === 'ok' && assignments.length > 0) {
    colors = locationOnlyCards(assignments, catalog)
  }

  const warehouse = getWarehouseConfig()

  return NextResponse.json(
    {
      modelCode,
      productName: catalog?.productName ?? null,
      fetchedAt: new Date().toISOString(),
      stock: { state: stockState, detail: stockDetail },
      locations: { state: locationsState },
      colors,
      // Null rather than 0 whenever stock is not known, so a client bug cannot
      // turn a failure into "no stock".
      totalQuantity,
      warehouse: {
        roomRoutes: warehouse.roomRoutes,
        configError: warehouse.configError,
      },
    },
    {
      // Freshness is the whole point of the screen: the three-hourly cron is
      // what the storefront reads, and this must not be another cached copy.
      // `fetchedAt` is therefore always the moment of the actual upstream call.
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
