'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/app/contexts/AuthContext'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { getAdminAuthHeaders } from '@/lib/admin-api'
import { adminTheme } from '@/app/admin/_components/adminTheme'

interface AdminUserRow {
  email: string | null
  firstName: string | null
  lastName: string | null
  createdAt: string | null
  lastLoginAt: string | null
  isLegacy?: boolean
}

type MessageState = {
  type: 'success' | 'error'
  text: string
} | null

function formatAdminName(user: AdminUserRow): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  if (name) return name
  if (user.isLegacy) return 'Legacy admin'
  return 'Admin'
}

function AdminUsersPage() {
  const { user, logout } = useAuth()
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([])
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [newUserEmail, setNewUserEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [message, setMessage] = useState<MessageState>(null)

  const loadAdminUsers = useCallback(async () => {
    if (!user) return

    setIsLoadingList(true)
    setListError(null)

    try {
      const headers = await getAdminAuthHeaders(user)
      const res = await fetch('/api/admin/users', { headers })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load admin users')
      }

      setAdminUsers(data.users ?? [])
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Failed to load admin users')
    } finally {
      setIsLoadingList(false)
    }
  }, [user])

  useEffect(() => {
    void loadAdminUsers()
  }, [loadAdminUsers])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }

    if (!user) {
      setMessage({ type: 'error', text: 'You must be signed in to create admin users.' })
      return
    }

    setIsCreating(true)

    try {
      const headers = await getAdminAuthHeaders(user)
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: newUserEmail, password }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create admin user')
      }

      setMessage({
        type: 'success',
        text: 'Admin user created. They can sign in at /admin/login.',
      })
      setNewUserEmail('')
      setPassword('')
      setConfirmPassword('')
      await loadAdminUsers()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error creating user. Please try again.',
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className={`${adminTheme.pageBg} pt-20`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Link
              href="/admin"
              className={`flex items-center ${adminTheme.link} mr-4`}
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Admin
            </Link>
            <h1 className={adminTheme.title}>Admin Users</h1>
          </div>
          <p className={adminTheme.subtitle}>Manage admin access and permissions</p>
        </div>

        <div className={`${adminTheme.card} p-6 mb-8`}>
          <h2 className="text-lg font-medium text-black mb-4">Current User</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-black">{user?.email}</p>
              <p className="text-sm text-[#856D55]">Admin User</p>
            </div>
            <button
              onClick={logout}
              className={adminTheme.buttonSecondary}
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className={`${adminTheme.card} p-6 mb-8`}>
          <h2 className="text-lg font-medium text-black mb-4">Admin Users</h2>

          {isLoadingList ? (
            <div className="py-8 text-center">
              <div className={adminTheme.spinner} />
              <p className="mt-4 text-sm text-[#856D55]">Loading admin users...</p>
            </div>
          ) : listError ? (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {listError}
            </div>
          ) : adminUsers.length === 0 ? (
            <p className="text-sm text-[#856D55]">No admin users found.</p>
          ) : (
            <div className="space-y-3">
              {adminUsers.map((adminUser) => (
                <div
                  key={adminUser.email ?? 'unknown'}
                  className="flex items-center justify-between p-3 bg-[#E1DBD7]/40 rounded-md"
                >
                  <div>
                    <p className="text-sm font-medium text-black">{adminUser.email}</p>
                    <p className="text-sm text-[#856D55]">{formatAdminName(adminUser)}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${adminTheme.badgeActive}`}
                  >
                    Active
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${adminTheme.card} p-6`}>
          <h2 className="text-lg font-medium text-black mb-4">Add New Admin User</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-black mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className={adminTheme.input}
                placeholder="Enter email address"
                required
                disabled={isCreating}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-black mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${adminTheme.input} pr-10`}
                  placeholder="Set password (min. 6 characters)"
                  required
                  minLength={6}
                  disabled={isCreating}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
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
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-black mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${adminTheme.input} pr-10`}
                  placeholder="Confirm password"
                  required
                  minLength={6}
                  disabled={isCreating}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-[#B2A28E]" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-[#B2A28E]" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className={adminTheme.buttonPrimaryFull}
            >
              {isCreating ? 'Creating...' : 'Create Admin User'}
            </button>
          </form>

          {message && (
            <div
              className={`mt-4 p-3 rounded-md text-sm border ${
                message.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPageWrapper() {
  return (
    <ProtectedRoute>
      <AdminUsersPage />
    </ProtectedRoute>
  )
}
