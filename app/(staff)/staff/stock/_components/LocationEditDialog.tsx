'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'

import type { StaffColorCard } from '@/lib/staff/combine-stock'
import type { SaveLocationResponse, StaffApiError } from '@/lib/staff/api-types'
import type { StoredLocation } from '@/lib/staff/location-types'
import type { RoomRoutes } from '@/lib/staff/warehouse-config'
import {
  DRAWERS,
  FLOOR_OPTION,
  MIN_ROOM,
  ROOMS,
  type WarehousePlacement,
} from '@/lib/staff/warehouse-config'
import {
  LOCATION_ERROR_MESSAGES,
  formatLocation,
  staffText,
} from '@/lib/staff/messages'
import { STAFF_EDIT_ERROR_CODES } from '@/lib/staff-session'
import { staffTheme } from '../../../_components/staffTheme'

/**
 * Edits one model/colour location, with a manager grant already in hand.
 *
 * Controlled selectors only -- room, route and drawer are each a closed list,
 * so a free-text drawer number is impossible from the UI. The server validates
 * the same three values again against the same `validateLocation`, because a UI
 * constraint is not a constraint.
 *
 * Native `<select>` rather than a custom listbox. On the shared iPad that gives
 * the iOS wheel picker, which is faster and far more accurate standing up than
 * any scrolling div, and it sidesteps the portal-and-direction problem that
 * custom listboxes have inside a dialog.
 *
 * Saving sends the `expectedVersion` the card was rendered with, so a location
 * someone else changed in the meantime comes back as a conflict rather than
 * being overwritten.
 */
export default function LocationEditDialog({
  open,
  card,
  modelCode,
  grantId,
  roomRoutes,
  onCancel,
  onSaved,
}: {
  open: boolean
  card: StaffColorCard | null
  modelCode: string
  grantId: string | null
  roomRoutes: RoomRoutes
  onCancel: () => void
  onSaved: (location: StoredLocation, changed: boolean) => void
}) {
  const current = card?.location ?? null

  const [room, setRoom] = useState<number>(current?.room ?? MIN_ROOM)
  const [route, setRoute] = useState<number>(current?.route ?? 1)
  /**
   * The drawer selector holds either a drawer number or the floor sentinel, so
   * one control covers both. It is split back into `{drawer, placement}` at
   * save time, which is the shape the API and the database use.
   */
  const [drawerChoice, setDrawerChoice] = useState<number | typeof FLOOR_OPTION>(
    current?.placement === 'FLOOR' ? FLOOR_OPTION : current?.drawer ?? 1
  )
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<StoredLocation | null>(null)
  const [working, setWorking] = useState(false)
  const inFlight = useRef(false)

  // Re-seed from the card each time the dialog opens, so editing a second
  // colour never starts from the first one's values.
  useEffect(() => {
    if (!open) return
    setRoom(current?.room ?? MIN_ROOM)
    setRoute(current?.route ?? 1)
    setDrawerChoice(current?.placement === 'FLOOR' ? FLOOR_OPTION : current?.drawer ?? 1)
    setError(null)
    setConflict(null)
    setWorking(false)
    inFlight.current = false
    // `card` identity is what changes between openings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card])

  const availableRoutes = roomRoutes[room] ?? []

  // Keep the route valid when the room changes: a room may not have the route
  // that was selected for the previous one.
  useEffect(() => {
    if (availableRoutes.length === 0) return
    if (!availableRoutes.includes(route)) setRoute(availableRoutes[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, availableRoutes.join(',')])

  async function save() {
    if (inFlight.current || !card || !grantId) return
    inFlight.current = true
    setWorking(true)
    setError(null)
    setConflict(null)

    try {
      const response = await fetch('/api/staff/locations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelCode,
          colorCode: card.colorCode,
          room,
          route,
          // Exactly one of these two shapes, never both.
          drawer: drawerChoice === FLOOR_OPTION ? null : drawerChoice,
          placement: (drawerChoice === FLOOR_OPTION
            ? 'FLOOR'
            : 'DRAWER') satisfies WarehousePlacement,
          // Null when the card showed "not yet assigned". The server refuses to
          // create over a row this client never saw.
          expectedVersion: current?.version ?? null,
          grantId,
        }),
      })

      const payload: SaveLocationResponse | StaffApiError = await response
        .json()
        .catch(() => ({ error: 'unparseable' }))

      if (response.ok && 'location' in payload) {
        onSaved(payload.location, payload.changed)
        return
      }

      const failure = payload as StaffApiError

      if (failure.code === STAFF_EDIT_ERROR_CODES.CONFLICT) {
        setConflict(failure.current ?? null)
        setError(staffText.saveConflict)
      } else if (failure.code === STAFF_EDIT_ERROR_CODES.GRANT_EXPIRED) {
        setError(staffText.editPermissionExpired)
      } else if (failure.code === STAFF_EDIT_ERROR_CODES.FORBIDDEN) {
        setError(staffText.editForbidden)
      } else if (failure.code === STAFF_EDIT_ERROR_CODES.INVALID_LOCATION) {
        const reason = failure.reason as keyof typeof LOCATION_ERROR_MESSAGES | undefined
        setError(
          (reason && LOCATION_ERROR_MESSAGES[reason]) || staffText.saveFailed
        )
      } else {
        setError(staffText.saveFailed)
      }
    } catch {
      setError(staffText.saveFailed)
    } finally {
      setWorking(false)
      inFlight.current = false
    }
  }

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onCancel}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className={staffTheme.dialogOverlay} />
        </Transition.Child>

        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              {/* dir on the panel: Headless UI portals it out of the layout. */}
              <Dialog.Panel dir="rtl" className={staffTheme.dialogPanel}>
                <Dialog.Title className={staffTheme.dialogTitle}>
                  {staffText.editDialogTitle}
                </Dialog.Title>

                <p className={`${staffTheme.meta} mt-1`}>
                  {card?.colorName}{' '}
                  <span dir="ltr" className="inline-block tabular-nums">
                    {modelCode}
                  </span>
                </p>

                <p className={`${staffTheme.meta} mt-2`}>
                  {staffText.currentLocationLabel}:{' '}
                  {current ? formatLocation(current) : staffText.noLocation}
                </p>

                <form
                  className="mt-4 grid grid-cols-3 gap-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void save()
                  }}
                >
                  <div>
                    <label htmlFor="staff-room" className={staffTheme.label}>
                      {staffText.roomLabel}
                    </label>
                    <select
                      id="staff-room"
                      value={room}
                      onChange={(event) => setRoom(Number(event.target.value))}
                      className={staffTheme.select}
                      data-testid="staff-room-select"
                    >
                      {ROOMS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="staff-route" className={staffTheme.label}>
                      {staffText.routeLabel}
                    </label>
                    <select
                      id="staff-route"
                      value={route}
                      onChange={(event) => setRoute(Number(event.target.value))}
                      className={staffTheme.select}
                      data-testid="staff-route-select"
                    >
                      {availableRoutes.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="staff-drawer" className={staffTheme.label}>
                      {staffText.drawerLabel}
                    </label>
                    <select
                      id="staff-drawer"
                      value={drawerChoice}
                      onChange={(event) =>
                        setDrawerChoice(
                          event.target.value === FLOOR_OPTION
                            ? FLOOR_OPTION
                            : Number(event.target.value)
                        )
                      }
                      className={staffTheme.select}
                      data-testid="staff-drawer-select"
                    >
                      {/* First, so it is reachable without scrolling past 50
                          drawers on a touch wheel. */}
                      <option value={FLOOR_OPTION}>{staffText.floorLabel}</option>
                      {DRAWERS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <p className={`${staffTheme.meta} col-span-3`}>
                    {staffText.allSizesNote}
                  </p>

                  {error && (
                    <div className="col-span-3">
                      <p className={staffTheme.fieldError} data-testid="staff-edit-error">
                        {error}
                      </p>
                      {conflict && (
                        <p className={staffTheme.meta} data-testid="staff-conflict-current">
                          {formatLocation(conflict)}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="col-span-3 mt-2 flex gap-3">
                    <button
                      type="submit"
                      disabled={working || !grantId}
                      className={`${staffTheme.buttonPrimary} flex-1`}
                      data-testid="staff-save-location"
                    >
                      {working ? staffText.saving : staffText.saveAction}
                    </button>
                    <button
                      type="button"
                      onClick={onCancel}
                      className={staffTheme.buttonSecondary}
                      data-testid="staff-cancel-location"
                    >
                      {staffText.cancelAction}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
