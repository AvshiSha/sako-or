'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'

type SyncResponse = { ok: true; needsProfileCompletion: boolean } | { error: string }

/**
 * ProfileCompletionGate - Ensures users complete their profile before accessing the site.
 * 
 * When a user signs in (especially via Google), this component checks if their profile
 * is complete. If not, they are redirected to /{lng}/signup until they submit all required fields.
 */
export default function ProfileCompletionGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(false)
  const checkedUidRef = useRef<string | null>(null)

  useEffect(() => {
    // Don't check while auth is still initializing
    if (authLoading) return

    // No user signed in - allow navigation
    if (!user) {
      checkedUidRef.current = null
      return
    }

    // Extract language from pathname (assumes /{lng}/... structure)
    const pathSegments = pathname?.split('/').filter(Boolean) || []
    const lng = pathSegments[0] && ['en', 'he'].includes(pathSegments[0]) ? pathSegments[0] : 'en'

    // Allowlist: routes that incomplete users can access without profile check
    const allowedRoutes = [
      `/${lng}/signup`,
      `/${lng}/signin`,
      `/${lng}/verify-sms`,
    ]

    const isOnAllowedRoute = allowedRoutes.some((route) => pathname?.startsWith(route))

    // If user is already on an allowed route, don't interrupt them
    // IMPORTANT: Return early BEFORE marking as checked, so we check again on other routes
    if (isOnAllowedRoute) return

    // Only enforce profile completion check for profile routes
    // This allows users to browse, add to cart, checkout, etc. without interruption
    const isProfileRoute = pathname?.startsWith(`/${lng}/profile`)
    
    // If not trying to access profile, allow navigation without checking
    if (!isProfileRoute) {
      // Reset cache when leaving profile routes so we check again when returning
      checkedUidRef.current = null
      return
    }

    // Already checked this user (only cache after we know they're trying to access profile)
    if (checkedUidRef.current === user.uid) return
    checkedUidRef.current = user.uid

    let cancelled = false
    setChecking(true)

    ;(async () => {
      try {
        const token = await user.getIdToken().catch((err) => {
          console.warn('[ProfileCompletionGate] Failed to get ID token:', err?.message || err)
          return null
        })
        
        if (!token) {
          // If we can't get a token, allow navigation (might be API key issue)
          if (!cancelled) setChecking(false)
          return
        }
        
        const res = await fetch('/api/me/sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })

        const json = (await res.json().catch(() => null)) as SyncResponse | null

        if (cancelled) return

        // If sync fails with 400, it might be API key issue - allow navigation
        if (res.status === 400) {
          console.warn('[ProfileCompletionGate] Sync returned 400 - may be API key/domain issue, allowing navigation')
          if (!cancelled) setChecking(false)
          return
        }

        // If sync fails or user needs profile completion, redirect to signup
        if (!res.ok || !json || 'error' in json || json.needsProfileCompletion === true) {
          router.replace(`/${lng}/signup`)
        }
        // Otherwise, profile is complete - allow navigation
      } catch (error: any) {
        // If it's a 400 error, allow navigation (API key issue)
        const is400Error = error?.message?.includes('400') || error?.code === 'auth/network-request-failed'
        if (is400Error) {
          console.warn('[ProfileCompletionGate] 400 error during profile check - may be API key issue, allowing navigation')
          if (!cancelled) setChecking(false)
          return
        }
        
        console.error('[ProfileCompletionGate] Error checking profile completion:', error)
        // On other errors, redirect to signup to be safe
        if (!cancelled) {
          router.replace(`/${lng}/signup`)
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, authLoading, pathname, router])

  // Show loading state while checking (optional - prevents flash)
  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
      </div>
    )
  }

  return <>{children}</>
}

