'use client'

import { useEffect } from 'react'

/**
 * Marks the document as a staff surface so the storefront widgets stay out of
 * the way.
 *
 * Same mechanism as the admin panel's `HideStorefrontWidgets`, with its own
 * class so the two can be styled apart later. The CSS rule in
 * `app/globals.css` now matches `body.admin-panel, body.staff-panel`.
 *
 * This covers the accessibility plugin, which injects itself on first pointer
 * interaction -- immediate on a touch device. The Chatbase bubble and the cookie
 * banner are handled in their own components, which branch on the pathname:
 * neither belongs on a warehouse iPad, and the cookie banner in particular
 * would open over the stock card on a freshly wiped device.
 */
const BODY_CLASS = 'staff-panel'

export default function StaffChrome() {
  useEffect(() => {
    document.body.classList.add(BODY_CLASS)
    return () => document.body.classList.remove(BODY_CLASS)
  }, [])

  return null
}
