'use client'

import { useRef, useState } from 'react'

import { staffText } from '@/lib/staff/messages'
import { staffTheme } from './staffTheme'

/**
 * Signs the shared device out.
 *
 * `POST /api/staff/logout` revokes any outstanding manager edit grant, revokes
 * the account's refresh tokens and clears the cookie, so the next person gets a
 * clean viewer session rather than inheriting a live write permission.
 *
 * A full page load afterwards rather than a router push: the session cookie is
 * gone, so every cached client state is now wrong, and `/staff/login` sits in a
 * different route group with its own `<html>` anyway.
 *
 * The `inFlight` ref is the repo's double-submit guard. `disabled` alone loses
 * the race on a fast double tap, which on a touch screen is the normal way to
 * press a button that has not visibly responded yet.
 */
export default function StaffSignOutButton() {
  const [working, setWorking] = useState(false)
  const inFlight = useRef(false)

  async function signOut() {
    if (inFlight.current) return
    inFlight.current = true
    setWorking(true)

    try {
      await fetch('/api/staff/logout', { method: 'POST' })
    } catch {
      // Even if the request failed, sending the device to the login screen is
      // the right outcome: whoever pressed this wants to hand the iPad over.
      // The cookie may survive, which the login page then resolves.
    } finally {
      window.location.href = '/staff/login'
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={working}
      className={staffTheme.headerButton}
    >
      {staffText.signOut}
    </button>
  )
}
