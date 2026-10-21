'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, ClockIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

import { adminTheme } from '../_components/adminTheme'
import type { LocationAssignment } from '@/lib/staff/combine-stock'
import type { StaffApiError } from '@/lib/staff/api-types'
import type { StoredLocation } from '@/lib/staff/location-types'
import type { RoomRoutes } from '@/lib/staff/warehouse-config'
import { DRAWERS, ROOMS, defaultRoomRoutes } from '@/lib/staff/warehouse-config'
import { resolveColorName } from '@/lib/staff/combine-stock'
import { parseModelCode } from '@/lib/staff/model-code'
import { STAFF_EDIT_ERROR_CODES } from '@/lib/staff-session'

/**
 * Admin-side warehouse location management.
 *
 * Deliberately NOT a copy of the staff screen. This is the desk tool: English,
 * left-to-right, `adminTheme`, a table rather than cards, and **no manager PIN**
 * -- the admin session is the authorization. It calls the same
 * `lib/server/warehouse-locations.ts` service through
 * `/api/admin/warehouse-locations`, so validation, concurrency and the audit
 * trail are identical to the warehouse floor path.
 *
 * It is also the way out of a PIN lockout: five wrong PINs stop editing on the
 * iPad, and an admin can still make the change from here.
 *
 * Unlike the staff screen this does not call Verifone at all. It lists the
 * locations we have stored for a model, which is the thing an admin is here to
 * correct; stock belongs on the staff screen where it is read live.
 *
 * Auth is the admin session cookie on a same-origin fetch --
 * `requireAdminSession` accepts either that or a bearer token, and there is no
 * client Firebase session to mint a token from on this page.
 */

type HistoryEntry = {
  id: string
  colorCode: string
  previous: { room: number; route: number; drawer: number } | null
  next: { room: number; route: number; drawer: number }
  actorEmail: string | null
  actorRole: string
  viaPin: boolean
  changedAt: string
}

type Draft = { room: number; route: number; drawer: number; onFloor: boolean }

function describe(location: {
  room: number
  route: number
  drawer: number
  onFloor?: boolean
}): string {
  // Appended, matching the Hebrew screen: the floor is beneath that drawer.
  const base = `Room ${location.room} / Route ${location.route} / Drawer ${location.drawer}`
  return location.onFloor ? `${base} / Floor` : base
}

export default function AdminWarehouseLocationsPage() {
  const [model, setModel] = useState('')
  const [loadedModel, setLoadedModel] = useState<string | null>(null)
  const [locations, setLocations] = useState<LocationAssignment[]>([])
  const [roomRoutes, setRoomRoutes] = useState<RoomRoutes>(defaultRoomRoutes())
  const [configError, setConfigError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ room: 1, route: 1, drawer: 1, onFloor: false })
  const inFlight = useRef(false)

  const load = useCallback(async (modelCode: string) => {
    setLoading(true)
    setNotice(null)
    setHistory(null)

    try {
      const response = await fetch(
        `/api/admin/warehouse-locations?modelCode=${encodeURIComponent(modelCode)}`
      )
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setNotice({ type: 'error', message: payload?.error || 'Could not load locations' })
        return
      }

      setLoadedModel(payload.modelCode)
      setLocations(payload.locations ?? [])
      setRoomRoutes(payload.warehouse?.roomRoutes ?? defaultRoomRoutes())
      setConfigError(payload.warehouse?.configError ?? null)
    } catch {
      setNotice({ type: 'error', message: 'Could not load locations' })
    } finally {
      setLoading(false)
    }
  }, [])

  function search() {
    const parsed = parseModelCode(model)
    if (!parsed.ok) {
      setNotice({
        type: 'error',
        message: 'Model number must be 8 digits, as XXXXXXXX or XXXX-XXXX',
      })
      return
    }
    void load(parsed.canonical)
  }

  async function loadHistory() {
    if (!loadedModel) return
    setLoading(true)
    try {
      const response = await fetch(
        `/api/admin/warehouse-locations?history=1&modelCode=${encodeURIComponent(loadedModel)}`
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setNotice({ type: 'error', message: payload?.error || 'Could not load history' })
        return
      }
      setHistory(payload.history ?? [])
    } finally {
      setLoading(false)
    }
  }

  function startEdit(assignment: LocationAssignment) {
    setEditing(assignment.colorCode)
    setDraft({
      room: assignment.room,
      route: assignment.route,
      drawer: assignment.drawer,
      onFloor: assignment.onFloor,
    })
    setNotice(null)
  }

  async function save(assignment: LocationAssignment) {
    if (inFlight.current || !loadedModel) return
    inFlight.current = true
    setLoading(true)

    try {
      const response = await fetch('/api/admin/warehouse-locations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelCode: loadedModel,
          colorCode: assignment.colorCode,
          room: draft.room,
          route: draft.route,
          drawer: draft.drawer,
          onFloor: draft.onFloor,
          // The version this row was rendered with. A mismatch is a 409 rather
          // than an overwrite of someone else's newer value.
          expectedVersion: assignment.version,
        }),
      })

      const payload: { location?: StoredLocation } | StaffApiError = await response
        .json()
        .catch(() => ({ error: 'unparseable' }))

      if (!response.ok) {
        const failure = payload as StaffApiError
        setNotice({
          type: 'error',
          message:
            failure.code === STAFF_EDIT_ERROR_CODES.CONFLICT
              ? `Changed by someone else${
                  failure.current ? ` - it is now ${describe(failure.current)}` : ''
                }. Reload and try again.`
              : failure.error || 'Could not save',
        })
        return
      }

      const saved = (payload as { location: StoredLocation }).location
      setLocations((prev) =>
        prev.map((row) =>
          row.colorCode === saved.colorCode
            ? {
                colorCode: saved.colorCode,
                room: saved.room,
                route: saved.route,
                drawer: saved.drawer,
                onFloor: saved.onFloor,
                version: saved.version,
                updatedAt: saved.updatedAt,
                updatedBy: saved.updatedBy,
              }
            : row
        )
      )
      setEditing(null)
      setNotice({ type: 'success', message: `Saved ${describe(saved)}` })
    } catch {
      setNotice({ type: 'error', message: 'Could not save' })
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }

  // Keep the drafted route valid for the drafted room.
  useEffect(() => {
    const allowed = roomRoutes[draft.room] ?? []
    if (allowed.length > 0 && !allowed.includes(draft.route)) {
      setDraft((prev) => ({ ...prev, route: allowed[0] }))
    }
  }, [draft.room, draft.route, roomRoutes])

  return (
    <div className={adminTheme.pageBg}>
      <div className={`${adminTheme.card} border-0 rounded-none shadow-sm`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/admin" className={`${adminTheme.link} inline-flex items-center gap-1 text-sm`}>
            <ArrowLeftIcon className="h-4 w-4" />
            Back to dashboard
          </Link>
          <h1 className={`${adminTheme.title} mt-2`}>Warehouse Locations</h1>
          <p className={adminTheme.subtitle}>
            Room, route and drawer per model and colour. The warehouse iPad reads the same
            records at /staff/stock, where a manager PIN is required to change them.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`${adminTheme.card} p-4 sm:p-6`}>
          <label htmlFor="admin-model" className="block text-sm font-medium text-black">
            Model number
          </label>
          <div className="mt-2 flex gap-3">
            <input
              id="admin-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  search()
                }
              }}
              placeholder="4925-0301"
              className={adminTheme.input}
            />
            <button type="button" onClick={search} disabled={loading} className={adminTheme.buttonPrimary}>
              <MagnifyingGlassIcon className="h-4 w-4 mr-1" />
              Load
            </button>
          </div>

          {configError && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {configError}
            </p>
          )}

          {notice && (
            <p
              className={`mt-3 rounded-md px-3 py-2 text-sm ${
                notice.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {notice.message}
            </p>
          )}
        </div>

        {loadedModel && (
          <div className={`${adminTheme.card} mt-6`}>
            <div className={`${adminTheme.cardHeader} flex items-center justify-between px-4 py-3`}>
              <h2 className="font-medium text-black">
                {loadedModel}
                <span className={`ml-2 text-sm ${adminTheme.subtitle}`}>
                  {locations.length} assigned colour{locations.length === 1 ? '' : 's'}
                </span>
              </h2>
              <button type="button" onClick={loadHistory} className={adminTheme.buttonSecondary}>
                <ClockIcon className="h-4 w-4 mr-1" />
                Change log
              </button>
            </div>

            {locations.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[#856D55]">
                No colour of this model has a location yet. Assignments are created from the
                warehouse screen, where the colours Verifone returns are listed; this page edits
                the ones that already exist.
              </p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={adminTheme.tableHead}>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">Colour</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">Location</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">Updated</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {locations.map((assignment) => {
                    const { colorName } = resolveColorName(assignment.colorCode)
                    const isEditing = editing === assignment.colorCode
                    const allowed = roomRoutes[draft.room] ?? []

                    return (
                      <tr key={assignment.colorCode} className={adminTheme.tableRowHover}>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-mono">{assignment.colorCode}</span>
                          <span className="ml-2 text-[#856D55]">{colorName}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <select
                                aria-label="Room"
                                value={draft.room}
                                onChange={(event) =>
                                  setDraft((prev) => ({ ...prev, room: Number(event.target.value) }))
                                }
                                className={adminTheme.select}
                              >
                                {ROOMS.map((value) => (
                                  <option key={value} value={value}>
                                    Room {value}
                                  </option>
                                ))}
                              </select>
                              <select
                                aria-label="Route"
                                value={draft.route}
                                onChange={(event) =>
                                  setDraft((prev) => ({ ...prev, route: Number(event.target.value) }))
                                }
                                className={adminTheme.select}
                              >
                                {allowed.map((value) => (
                                  <option key={value} value={value}>
                                    Route {value}
                                  </option>
                                ))}
                              </select>
                              <select
                                aria-label="Drawer"
                                value={draft.drawer}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    drawer: Number(event.target.value),
                                  }))
                                }
                                className={adminTheme.select}
                              >
                                {DRAWERS.map((value) => (
                                  <option key={value} value={value}>
                                    Drawer {value}
                                  </option>
                                ))}
                              </select>
                              {/* After the selectors, matching the staff screen. */}
                              <button
                                type="button"
                                aria-pressed={draft.onFloor}
                                onClick={() =>
                                  setDraft((prev) => ({ ...prev, onFloor: !prev.onFloor }))
                                }
                                className={
                                  draft.onFloor
                                    ? adminTheme.buttonPrimary
                                    : adminTheme.buttonSecondary
                                }
                              >
                                Floor
                              </button>
                            </div>
                          ) : (
                            describe(assignment)
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#856D55]">
                          {assignment.updatedAt
                            ? new Date(assignment.updatedAt).toLocaleString('en-GB')
                            : '—'}
                          {assignment.updatedBy && (
                            <span className="block text-xs">{assignment.updatedBy}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => save(assignment)}
                                disabled={loading}
                                className={adminTheme.buttonPrimary}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing(null)}
                                className={adminTheme.buttonSecondary}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEdit(assignment)}
                              className={adminTheme.buttonSecondary}
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {history && (
          <div className={`${adminTheme.card} mt-6`}>
            <div className={`${adminTheme.cardHeader} px-4 py-3`}>
              <h2 className="font-medium text-black">Change log</h2>
              <p className={`text-xs ${adminTheme.subtitle}`}>
                With a shared warehouse account the actor is the account, not the individual
                operator. &quot;via PIN&quot; means the change came from the warehouse screen.
              </p>
            </div>

            {history.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[#856D55]">No changes recorded.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {history.map((entry) => (
                  <li key={entry.id} className="px-4 py-3 text-sm">
                    <span className="font-mono">{entry.colorCode}</span>
                    {': '}
                    {entry.previous ? describe(entry.previous) : 'unassigned'}
                    {' → '}
                    {describe(entry.next)}
                    <span className="block text-xs text-[#856D55]">
                      {new Date(entry.changedAt).toLocaleString('en-GB')}
                      {' · '}
                      {entry.actorEmail || 'unknown account'}
                      {' · '}
                      {entry.actorRole}
                      {entry.viaPin ? ' · via PIN' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
