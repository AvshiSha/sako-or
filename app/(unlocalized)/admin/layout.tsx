'use client'

import { usePathname } from 'next/navigation'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import AdminShell from './_components/AdminShell'
import HideStorefrontWidgets from './_components/HideStorefrontWidgets'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/admin/login'

  if (isLoginPage) {
    return (
      <>
        <HideStorefrontWidgets />
        {children}
      </>
    )
  }

  return (
    <>
      <HideStorefrontWidgets />
      <ProtectedRoute>
        <AdminShell>{children}</AdminShell>
      </ProtectedRoute>
    </>
  )
}
