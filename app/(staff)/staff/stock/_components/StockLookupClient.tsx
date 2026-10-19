'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { StaffApiError, StaffStockResponse, UnlockResponse } from '@/lib/staff/api-types'
import type { StaffColorCard } from '@/lib/staff/combine-stock'
import type { StoredLocation } from '@/lib/staff/location-types'
import { defaultRoomRoutes } from '@/lib/staff/warehouse-config'
import { MODEL_CODE_MESSAGES, staffText } from '@/lib/staff/messages'
import { isCompleteModelCode, parseModelCode } from '@/lib/staff/model-code'
import { staffTheme } from '../../../_components/staffTheme'
import ColorStockCard from './ColorStockCard'
import LocationEditDialog from './LocationEditDialog'
import ManagerPinDialog from './ManagerPinDialog'

/**
 * The warehouse lookup screen.
 *
 * ## Obsolete responses can never render under the wrong heading
 *
 * Three guards, because this is the failure the brief singles out. Every lookup
 * takes a sequence number and aborts the previous request; a response whose
 * sequence is no longer current is dropped; and a response whose `modelCode`
 * does not match what was asked for is dropped as well. The heading itself is
 * rendered from the response rather than from the input field, so even a bug in
 * all three could not label one model's stock with another's number.
 *
 * ## One lookup per complete number
 *
 * The debounce fires only once `isCompleteModelCode` is true, so an incomplete
 * or invalid number never reaches Verifone, and the button and Enter key share
 * the same path. Retries are explicit: there is no automatic retry anywhere
 * here, which is what keeps a busy period from turning into a request storm
 * against an upstream that is already struggling.
 *
 * ## Stale stock is labelled, not hidden and not zeroed
 *
 * If a refresh fails while good data is on screen, the good data stays with a
 * notice saying so and its own timestamp. It is never replaced by zeros, and
 * "last successful retrieval" always refers to a real successful call.
 */

/** Long enough to finish typing eight digits, short enough to feel immediate. */
const DEBOUNCE_MS = 400

type EditSession = {
  card: StaffColorCard
  grant: UnlockResponse
}

export default function StockLookupClient() {
  const [input, setInput] = useState('')
  const [validation, setValidation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<StaffStockResponse | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [lastStockOkAt, setLastStockOkAt] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)

  const [pinTarget, setPinTarget] = useState<StaffColorCard | null>(null)
  const [editSession, setEditSession] = useState<EditSession | null>(null)

  const sequence = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  /**
   * The latest result, read inside `runLookup`.
   *
   * A ref rather than the state value because `runLookup` is handed to a
   * `setTimeout` by the debounce. If it closed over `result` directly, a lookup
   * that resolved during the 400ms wait would leave the pending callback
   * holding a stale snapshot, and the "keep the last good stock" decision below
   * would be made against the wrong data.
   */
  const resultRef = useRef<StaffStockResponse | null>(null)
  useEffect(() => {
    resultRef.current = result
  }, [result])

  const runLookup = useCallback(
    async (modelCode: string) => {
      const seq = ++sequence.current

      // Cancel whatever is still in flight. On a tablet, someone correcting a
      // digit generates several of these in a second.
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      setSavedNotice(null)

      try {
        const response = await fetch(
          `/api/staff/stock?model=${encodeURIComponent(modelCode)}`,
          { signal: controller.signal, headers: { Accept: 'application/json' } }
        )

        // Guard 1: a newer lookup has started since this one.
        if (seq !== sequence.current) return

        const payload: StaffStockResponse | StaffApiError = await response
          .json()
          .catch(() => ({ error: 'unparseable' }))

        if (seq !== sequence.current) return

        if (!response.ok || !('colors' in payload)) {
          const failure = payload as StaffApiError
          setRequestError(
            failure.code === 'INVALID_MODEL'
              ? MODEL_CODE_MESSAGES.TOO_SHORT
              : staffText.stockUnavailable
          )
          return
        }

        // Guard 2: the answer must be about the model we asked for.
        if (payload.modelCode !== modelCode) {
          console.error('[STAFF_STOCK_UI] discarding mismatched response', {
            asked: modelCode,
            got: payload.modelCode,
          })
          return
        }

        const previous = resultRef.current
        const hadGoodStock =
          previous?.modelCode === modelCode && previous.stock.state === 'ok'

        if (payload.stock.state === 'unavailable' && hadGoodStock) {
          // Keep the last good stock on screen, clearly marked. Replacing it
          // with nothing would be less useful, and replacing it with zeros
          // would be a lie.
          setStale(true)
          setRequestError(staffText.stockUnavailable)
          return
        }

        setResult(payload)
        setStale(false)
        setRequestError(
          payload.stock.state === 'unavailable' ? staffText.stockUnavailable : null
        )

        if (payload.stock.state === 'ok' || payload.stock.state === 'empty') {
          setLastStockOkAt(payload.fetchedAt)
        }
      } catch (error) {
        // An abort is the expected outcome of typing another digit.
        if ((error as { name?: string })?.name === 'AbortError') return
        if (seq !== sequence.current) return
        console.error('[STAFF_STOCK_UI] lookup failed', error)
        setRequestError(staffText.stockUnavailable)
      } finally {
        if (seq === sequence.current) setLoading(false)
      }
    },
    []
  )

  // Debounced automatic lookup once the number is complete.
  useEffect(() => {
    const trimmed = input.trim()
    if (!trimmed) {
      setValidation(null)
      return
    }

    const parsed = parseModelCode(trimmed)

    if (!parsed.ok) {
      // Only definite mistakes are flagged while typing. "Too short" is the
      // normal state of a field someone is halfway through, and nagging about
      // it after the first digit teaches people to ignore the message.
      setValidation(
        parsed.reason === 'NON_DIGIT' || parsed.reason === 'TOO_LONG'
          ? MODEL_CODE_MESSAGES[parsed.reason]
          : null
      )
      return
    }

    setValidation(null)

    const timer = setTimeout(() => {
      void runLookup(parsed.canonical)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [input, runLookup])

  /** The search button and the Enter key. Validates out loud. */
  function submitSearch() {
    const parsed = parseModelCode(input)
    if (!parsed.ok) {
      setValidation(MODEL_CODE_MESSAGES[parsed.reason])
      return
    }
    setValidation(null)
    void runLookup(parsed.canonical)
  }

  function refresh() {
    if (!result) return
    void runLookup(result.modelCode)
  }

  /** Releases the manager grant, putting the shared device back in viewer mode. */
  const releaseGrant = useCallback(async () => {
    try {
      await fetch('/api/staff/locations/revoke', { method: 'POST' })
    } catch {
      // The grant expires on its own within minutes regardless.
    }
  }, [])

  function cancelPin() {
    setPinTarget(null)
  }

  function cancelEdit() {
    setEditSession(null)
    void releaseGrant()
  }

  function applySavedLocation(location: StoredLocation, changed: boolean) {
    setResult((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        colors: prev.colors.map((card) =>
          card.colorCode === location.colorCode
            ? {
                ...card,
                location: {
                  room: location.room,
                  route: location.route,
                  drawer: location.drawer,
                  version: location.version,
                  updatedAt: location.updatedAt,
                  updatedBy: location.updatedBy,
                },
              }
            : card
        ),
      }
    })

    // The grant is spent by the save, so the device is already back in viewer
    // mode; no revoke call is needed.
    setEditSession(null)
    setSavedNotice(changed ? staffText.saveSucceeded : null)
  }

  const roomRoutes = useMemo(
    () => result?.warehouse.roomRoutes ?? defaultRoomRoutes(),
    [result]
  )

  const lastUpdatedLabel = useMemo(() => {
    if (!lastStockOkAt) return null
    const when = new Date(lastStockOkAt)
    if (Number.isNaN(when.getTime())) return null
    return when.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  }, [lastStockOkAt])

  return (
    <main className={staffTheme.container}>
      <h1 className="sr-only">{staffText.pageTitle}</h1>

      <form
        className={staffTheme.searchRow}
        onSubmit={(event) => {
          event.preventDefault()
          submitSearch()
        }}
      >
        <div className="flex-1">
          <label htmlFor="staff-model" className={staffTheme.label}>
            {staffText.modelLabel}
          </label>
          <input
            id="staff-model"
            name="model"
            // A numeric keyboard, but `type="text"` so leading zeros survive and
            // the dash is allowed. `type="number"` would strip both.
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            // Latin digits read in the correct order inside the RTL page.
            dir="ltr"
            placeholder="XXXX-XXXX"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className={`${staffTheme.input} ${validation ? staffTheme.inputInvalid : ''}`}
            aria-invalid={validation ? true : undefined}
            aria-describedby={validation ? 'staff-model-error' : 'staff-model-hint'}
            data-testid="staff-model-input"
          />
          {validation ? (
            <p id="staff-model-error" className={staffTheme.fieldError} data-testid="staff-model-error">
              {validation}
            </p>
          ) : (
            <p id="staff-model-hint" className={staffTheme.hint}>
              {staffText.modelHint}
            </p>
          )}
        </div>

        <button
          type="submit"
          className={staffTheme.buttonPrimary}
          disabled={loading && !isCompleteModelCode(input)}
          data-testid="staff-search"
        >
          {loading ? staffText.searching : staffText.searchAction}
        </button>
      </form>

      {/* --- result heading, always from the response, never from the field --- */}
      {result && (
        <section className="mt-6" data-testid="staff-result">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-[24px] font-black tabular-nums" dir="ltr" data-testid="staff-result-model">
                {result.modelCode}
              </p>
              {result.productName && (
                <p className="text-[17px] font-bold" data-testid="staff-product-name">
                  {result.productName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {lastUpdatedLabel && (
                <span className={staffTheme.meta} data-testid="staff-last-updated">
                  {staffText.lastUpdatedPrefix} {lastUpdatedLabel}
                </span>
              )}
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className={staffTheme.buttonSecondary}
                data-testid="staff-refresh"
              >
                {loading ? staffText.refreshing : staffText.refreshAction}
              </button>
            </div>
          </div>

          {result.warehouse.configError && (
            <p className={`${staffTheme.notice} ${staffTheme.noticeWarn} mt-3`}>
              {result.warehouse.configError}
            </p>
          )}

          {stale && (
            <p
              className={`${staffTheme.notice} ${staffTheme.noticeWarn} mt-3`}
              data-testid="staff-stale-notice"
            >
              {staffText.stockStale}
            </p>
          )}

          {requestError && (
            <p
              className={`${staffTheme.notice} ${staffTheme.noticeError} mt-3`}
              data-testid="staff-stock-error"
            >
              {requestError}
            </p>
          )}

          {result.locations.state === 'error' && (
            <p
              className={`${staffTheme.notice} ${staffTheme.noticeError} mt-3`}
              data-testid="staff-locations-error"
            >
              {staffText.locationUnavailable}
            </p>
          )}

          {savedNotice && (
            <p
              className={`${staffTheme.notice} ${staffTheme.noticeSuccess} mt-3`}
              data-testid="staff-saved-notice"
            >
              {savedNotice}
            </p>
          )}

          {/* A successful but empty response. Reported as empty, NOT as "model
              not found": the Verifone contract cannot distinguish the two. */}
          {result.stock.state === 'empty' && result.colors.length === 0 && (
            <p
              className={`${staffTheme.notice} ${staffTheme.noticeWarn} mt-3`}
              data-testid="staff-stock-empty"
            >
              {staffText.stockEmpty}
            </p>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {result.colors.map((card) => (
              <ColorStockCard
                key={card.colorCode}
                card={card}
                locationsState={result.locations.state}
                editDisabled={Boolean(pinTarget) || Boolean(editSession)}
                onEditLocation={(target) => {
                  setSavedNotice(null)
                  setPinTarget(target)
                }}
              />
            ))}
          </div>
        </section>
      )}

      {!result && !loading && (
        <p className={`${staffTheme.meta} mt-8 text-[16px]`}>{staffText.emptyPrompt}</p>
      )}

      <ManagerPinDialog
        open={Boolean(pinTarget)}
        modelCode={result?.modelCode ?? ''}
        colorCode={pinTarget?.colorCode ?? ''}
        colorName={pinTarget?.colorName ?? ''}
        onCancel={cancelPin}
        onUnlocked={(grant) => {
          const card = pinTarget
          setPinTarget(null)
          if (card) setEditSession({ card, grant })
        }}
      />

      <LocationEditDialog
        open={Boolean(editSession)}
        card={editSession?.card ?? null}
        modelCode={result?.modelCode ?? ''}
        grantId={editSession?.grant.grantId ?? null}
        roomRoutes={roomRoutes}
        onCancel={cancelEdit}
        onSaved={applySavedLocation}
      />
    </main>
  )
}
