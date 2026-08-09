'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/contexts/AuthContext'
import { adminTheme } from './adminTheme'

interface AdminShellProps {
  children: React.ReactNode
}

export default function AdminShell({ children }: AdminShellProps) {
  const { user, logout } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const handleSignOut = async () => {
    setSignOutError(null)
    setSigningOut(true)
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
      setSignOutError('Could not sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className={adminTheme.pageBg}>
      <header className={`${adminTheme.headerBg} shadow-md`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/admin" className="flex items-center gap-3 group">
              <span className={`text-lg font-bold tracking-widest ${adminTheme.headerText} group-hover:text-white transition-colors`}>
                SAKO OR
              </span>
              <span className={`hidden sm:inline text-xs ${adminTheme.headerMuted} border-l border-[#B2A28E]/40 pl-3`}>
                Admin Panel
              </span>
            </Link>
            <div className="flex items-center gap-4">
              {user?.email && (
                <div className="text-right hidden sm:block">
                  <p className={`text-sm font-medium ${adminTheme.headerText}`}>{user.email}</p>
                  <p className={`text-xs ${adminTheme.headerMuted}`}>Administrator</p>
                </div>
              )}
              <div className="flex flex-col items-end gap-1">
                {signOutError && (
                  <p className="text-xs text-red-400" role="alert">
                    {signOutError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="inline-flex items-center px-3 py-1.5 border border-[#B2A28E]/50 text-sm font-medium rounded-md text-[#E1DBD7] hover:bg-[#856D55]/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-[#856D55] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {signingOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
