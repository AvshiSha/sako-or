'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import { adminTheme } from '@/app/admin/_components/adminTheme'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

function AuthLoadingState({ message }: { message: string }) {
  return (
    <div className={`${adminTheme.pageBg} flex items-center justify-center`}>
      <div className="text-center">
        <div className={adminTheme.spinner} />
        <p className="mt-4 text-[#856D55]">{message}</p>
      </div>
    </div>
  )
}

export default function ProtectedRoute({ children, requireAdmin = true }: ProtectedRouteProps) {
  const { user, loading, isAdmin, adminCheckPending } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !adminCheckPending) {
      if (!user) {
        router.push('/admin/login')
        return
      }

      if (requireAdmin && !isAdmin) {
        router.push('/')
        return
      }
    }
  }, [user, loading, isAdmin, adminCheckPending, router, requireAdmin])

  if (loading || (requireAdmin && adminCheckPending)) {
    return <AuthLoadingState message="Checking authentication..." />
  }

  if (!user || (requireAdmin && !isAdmin)) {
    return <AuthLoadingState message="Redirecting..." />
  }

  return <>{children}</>
}
