'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export default function ProtectedRoute({ children, requireAdmin = true }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      console.log('Auth check:', { user: user?.email, isAdmin, requireAdmin })
      
      if (!user) {
        // User not logged in, redirect to login
        console.log('No user, redirecting to login')
        router.push('/admin/login')
        return
      }
      
      if (requireAdmin && !isAdmin) {
        // User logged in but not admin, redirect to home
        console.log('User not admin, redirecting to home')
        router.push('/')
        return
      }
      
      console.log('User authenticated and authorized')
    }
  }, [user, loading, isAdmin, router, requireAdmin])

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Show loading if user is not authenticated or not admin (when required)
  if (!user || (requireAdmin && !isAdmin)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
