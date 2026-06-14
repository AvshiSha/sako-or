'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import { isAdminEmail } from '@/lib/admin'
import { auth } from '@/lib/firebase'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { adminTheme } from '../_components/adminTheme'

async function verifyAdminAccess(): Promise<boolean> {
  const currentUser = auth.currentUser
  if (!currentUser) return false

  if (isAdminEmail(currentUser.email)) return true

  const token = await currentUser.getIdToken()
  const res = await fetch('/api/admin/check-access', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) return false

  const data = await res.json().catch(() => ({}))
  return data.isAdmin === true
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { signIn, logout, user, isAdmin, adminCheckPending } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && isAdmin && !adminCheckPending) {
      router.push('/admin')
    }
  }, [user, isAdmin, adminCheckPending, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await signIn(email, password)

      const hasAdminAccess = await verifyAdminAccess()
      if (!hasAdminAccess) {
        await logout()
        setError('This account does not have admin access.')
        return
      }

      router.push('/admin')
    } catch (error: unknown) {
      console.error('Login error:', error)
      const code = (error as { code?: string })?.code

      switch (code) {
        case 'auth/user-not-found':
          setError('No account found with this email address.')
          break
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Incorrect password.')
          break
        case 'auth/invalid-email':
          setError('Invalid email address.')
          break
        case 'auth/user-disabled':
          setError('This account has been disabled.')
          break
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.')
          break
        default:
          setError('Login failed. Please check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen ${adminTheme.pageBg} flex flex-col justify-center py-12 sm:px-6 lg:px-8`}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-widest text-black">SAKO OR</h1>
          <h2 className="mt-6 text-2xl font-bold text-black">Admin Login</h2>
          <p className={`mt-2 text-sm ${adminTheme.subtitle}`}>
            Sign in to access the admin dashboard
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className={`${adminTheme.card} py-8 px-4 sm:px-10`}>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-black">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={adminTheme.input}
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-black">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${adminTheme.input} pr-10`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-[#B2A28E]" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-[#B2A28E]" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={adminTheme.buttonPrimaryFull}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#B2A28E]/50" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-[#95816C]">Security Notice</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-[#95816C] text-center">
              <p>This is a secure admin area. All login attempts are logged.</p>
              <p>Contact your system administrator if you need access.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
