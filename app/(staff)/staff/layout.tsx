import { redirect } from 'next/navigation'

import { readStaffSession } from '@/lib/server/staff-session'
import { staffText } from '@/lib/staff/messages'
import StaffChrome from '../_components/StaffChrome'
import StaffSignOutButton from '../_components/StaffSignOutButton'
import { staffTheme } from '../_components/staffTheme'

/**
 * The authoritative gate for every staff page.
 *
 * Runs on Node, verifies the session cookie against Firebase with
 * `checkRevoked`, and re-resolves warehouse access from the database before
 * anything renders. The cookie-presence check in `middleware.ts` is a UX layer
 * only -- the Edge runtime cannot verify a Firebase session cookie -- so this is
 * the layer that actually decides.
 *
 * `/staff/login` is NOT handled here. It lives in the sibling `(staff-public)`
 * group, so it resolves to the same URL space without being a child of this
 * layout: a route group cannot exempt a child segment from its parent layout,
 * and a server layout cannot read `usePathname()` to branch. Same arrangement
 * as `(admin-public)`.
 *
 * `force-dynamic` because the gate reads cookies: this must never be
 * prerendered or cached.
 *
 * Unlike the admin layout there is no `<ProtectedRoute>`. That component exists
 * to catch "valid session cookie, missing BROWSER Firebase session", which
 * breaks the admin because its writes go through the client Firestore SDK.
 * Nothing here writes from the browser -- every change goes through the staff
 * API with the session cookie -- so the wrapper would add a client auth
 * dependency for no benefit, and on a shared device it would be one more thing
 * that can log the warehouse out mid-shift.
 */
export const dynamic = 'force-dynamic'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await readStaffSession()
  if (!session) {
    redirect('/staff/login')
  }

  return (
    <>
      <StaffChrome />
      <div className={staffTheme.pageBg}>
        <header className={staffTheme.header}>
          <span className={staffTheme.headerTitle}>{staffText.appName}</span>
          <StaffSignOutButton />
        </header>
        {children}
      </div>
    </>
  )
}
