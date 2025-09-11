'use client'

import { useState } from 'react'
import { useAuth } from '@/app/contexts/AuthContext'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { ArrowLeftIcon, UserPlusIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

function AdminUsersPage() {
  const { user, logout } = useAuth()
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [message, setMessage] = useState('')

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setMessage('')

    try {
      // In a real application, you would call an API endpoint to create users
      // For now, we'll just show a message
      setMessage('User creation functionality needs to be implemented via Firebase Console or API.')
    } catch (error) {
      setMessage('Error creating user. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Link
              href="/admin"
              className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Admin
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Admin Users</h1>
          </div>
          <p className="text-gray-600">Manage admin access and permissions</p>
        </div>

        {/* Current User Info */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Current User</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{user?.email}</p>
              <p className="text-sm text-gray-500">Admin User</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Admin Users List */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Admin Users</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <p className="text-sm font-medium text-gray-900">admin@sako-or.com</p>
                <p className="text-sm text-gray-500">Primary Admin</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <p className="text-sm font-medium text-gray-900">manager@sako-or.com</p>
                <p className="text-sm text-gray-500">Manager</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Add New User */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Add New Admin User</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter email address"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isCreating}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Admin User'}
            </button>
          </form>
          
          {message && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-md">
              {message}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-yellow-800 mb-2">Setup Instructions</h3>
          <div className="text-sm text-yellow-700 space-y-2">
            <p><strong>To add admin users:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Go to Firebase Console → Authentication → Users</li>
              <li>Click "Add user" and enter email/password</li>
              <li>Add the email to the ADMIN_EMAILS array in AuthContext.tsx</li>
              <li>Or use the Firebase Admin SDK to create users programmatically</li>
            </ol>
            <p className="mt-4"><strong>Current admin emails:</strong> admin@sako-or.com, manager@sako-or.com</p>
          </div>
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
