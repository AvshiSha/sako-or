import { redirect } from 'next/navigation'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { readAdminSession } from '@/lib/server/admin-session'
import AdminShell from './_components/AdminShell'
import HideStorefrontWidgets from './_components/HideStorefrontWidgets'

/**
 * The authoritative server-side gate for every admin page.
 *
 * This was a client component whose only guard was <ProtectedRoute>, i.e. a
 * useEffect redirect — which means the HTML and JS of every admin page were
 * served to anyone who asked, and nothing stopped a direct request. It now
 * runs on Node, verifies the session cookie against Firebase (with
 * checkRevoked) and re-resolves admin status before anything renders.
 *
 * /admin/login is NOT handled here. It lives in the sibling (admin-public)
 * route group, so it resolves to the same URL without being a child of this
 * layout — a route group cannot exempt a child segment from its parent's
 * layout, and a server layout cannot read usePathname() to branch.
 *
 * force-dynamic because the gate reads cookies: this must never be
 * prerendered or cached.
 */
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readAdminSession()
  if (!session) {
    redirect('/admin/login')
  }

  return (
    <>
      <HideStorefrontWidgets />
      {/*
        <ProtectedRoute> is kept deliberately. It is no longer the security
        boundary, but it covers a failure mode this gate cannot see: a valid
        12h session cookie while the BROWSER's Firebase session is missing
        (cleared storage, a different profile, signOut in another tab). Without
        it the admin UI renders and then every Firestore write fails with
        PERMISSION_DENIED, because those writes go through the client SDK.
      */}
      <ProtectedRoute>
        <AdminShell>{children}</AdminShell>
      </ProtectedRoute>
    </>
  )
}
