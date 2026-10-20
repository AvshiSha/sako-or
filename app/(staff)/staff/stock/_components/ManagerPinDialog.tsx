'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'

import type { StaffApiError, UnlockResponse } from '@/lib/staff/api-types'
import { MAX_PIN_LENGTH, MIN_PIN_LENGTH } from '@/lib/staff/pin-hash'
import { pinLockedOutMessage, staffText } from '@/lib/staff/messages'
import { STAFF_EDIT_ERROR_CODES } from '@/lib/staff-session'
import { staffTheme } from '../../../_components/staffTheme'

/**
 * Asks for the manager PIN, and on success hands back a grant for one
 * model/colour edit.
 *
 * The PIN is only ever sent to `POST /api/staff/locations/unlock`; it is never
 * held in any state that outlives this dialog, never put in a URL, and never
 * logged. On close the field is cleared.
 *
 * `dir="rtl"` sits on the panel itself, not on an ancestor. Headless UI portals
 * the panel to `document.body`, so it escapes the layout entirely and would
 * otherwise inherit direction from `<html>` only -- which does happen to be rtl
 * here, but stating it on the panel means this component stays correct if it is
 * ever rendered from somewhere else. The repo already applies `dir` per element
 * inside dialogs for the same reason.
 */
export default function ManagerPinDialog({
  open,
  modelCode,
  colorCode,
  colorName,
  onCancel,
  onUnlocked,
}: {
  open: boolean
  modelCode: string
  colorCode: string
  colorName: string
  onCancel: () => void
  onUnlocked: (grant: UnlockResponse) => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const inFlight = useRef(false)

  // Never leave a PIN sitting in component state between openings.
  useEffect(() => {
    if (!open) {
      setPin('')
      setError(null)
      setWorking(false)
      inFlight.current = false
    }
  }, [open])

  async function submit() {
    if (inFlight.current) return

    if (pin.length < MIN_PIN_LENGTH) {
      setError(staffText.pinMissing)
      return
    }

    inFlight.current = true
    setWorking(true)
    setError(null)

    try {
      const response = await fetch('/api/staff/locations/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelCode, colorCode, pin }),
      })

      const payload: UnlockResponse | StaffApiError = await response.json().catch(() => ({
        error: 'unparseable',
      }))

      if (response.ok && 'grantId' in payload) {
        setPin('')
        onUnlocked(payload)
        return
      }

      const failure = payload as StaffApiError

      if (failure.code === STAFF_EDIT_ERROR_CODES.PIN_LOCKED) {
        setError(pinLockedOutMessage(failure.retryAfterSeconds ?? 600))
      } else if (failure.code === STAFF_EDIT_ERROR_CODES.PIN_INSECURE) {
        setError(staffText.pinInsecure)
      } else if (failure.code === STAFF_EDIT_ERROR_CODES.PIN_NOT_CONFIGURED) {
        setError(staffText.pinNotConfigured)
      } else {
        setError(staffText.pinWrong)
      }
      setPin('')
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
              <Dialog.Panel dir="rtl" className={staffTheme.dialogPanel}>
                <Dialog.Title className={staffTheme.dialogTitle}>
                  {staffText.pinDialogTitle}
                </Dialog.Title>

                <p className={`${staffTheme.meta} mt-1`}>
                  {staffText.pinDialogIntro} &mdash; {colorName}{' '}
                  <span dir="ltr" className="inline-block tabular-nums">
                    {modelCode}
                  </span>
                </p>

                <form
                  className="mt-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void submit()
                  }}
                >
                  <label htmlFor="staff-manager-pin" className={staffTheme.label}>
                    {staffText.pinLabel}
                  </label>
                  <input
                    id="staff-manager-pin"
                    // `type="password"` so the PIN is not readable over the
                    // shoulder of whoever is holding a shared tablet.
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                    maxLength={MAX_PIN_LENGTH}
                    value={pin}
                    onChange={(event) => {
                      // Digits only, so a stray keyboard character cannot
                      // silently make a correct PIN fail.
                      setPin(event.target.value.replace(/\D/g, ''))
                      setError(null)
                    }}
                    className={staffTheme.pinInput}
                    data-testid="staff-pin-input"
                  />

                  {error && (
                    <p className={staffTheme.fieldError} data-testid="staff-pin-error">
                      {error}
                    </p>
                  )}

                  <div className="mt-5 flex gap-3">
                    <button
                      type="submit"
                      disabled={working}
                      className={`${staffTheme.buttonPrimary} flex-1`}
                      data-testid="staff-pin-submit"
                    >
                      {working ? staffText.saving : staffText.pinSubmit}
                    </button>
                    <button
                      type="button"
                      onClick={onCancel}
                      className={staffTheme.buttonSecondary}
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
