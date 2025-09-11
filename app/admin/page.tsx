'use client'
// google sheets import guide: https://github.com/sako-shop/sako-shop/blob/main/docs/GOOGLE_SHEETS_IMPORT_GUIDE.md
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  CubeIcon, 
  TagIcon, 
  UsersIcon, 
  ChartBarIcon,
  CogIcon,
  PlusIcon,
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { useAuth } from '@/app/contexts/AuthContext'

interface DashboardStats {
  totalProducts: number
  activeCategories: number
  featuredProducts: number
  outOfStockItems: number
}

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, logout } = useAuth()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/stats')
      if (!response.ok) {
        throw new Error('Failed to fetch statistics')
      }
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const statsDisplay = stats ? [
    { name: 'Total Products', value: stats.totalProducts.toString(), change: '', changeType: 'neutral' },
    { name: 'Active Categories', value: stats.activeCategories.toString(), change: '', changeType: 'neutral' },
    { name: 'Featured Products', value: stats.featuredProducts.toString(), change: '', changeType: 'neutral' },
    { name: 'Out of Stock Items', value: stats.outOfStockItems.toString(), change: '', changeType: stats.outOfStockItems > 0 ? 'negative' : 'positive' },
  ] : []

  const quickActions = [
    {
      name: 'Add New Product',
      href: '/admin/products/new',
      icon: PlusIcon,
      description: 'Create a new product listing'
    },
    {
      name: 'Import Products',
      href: '/admin/import',
      icon: ArrowUpTrayIcon,
      description: 'Import products from Google Sheets'
    },
    {
      name: 'Manage Categories',
      href: '/admin/categories',
      icon: TagIcon,
      description: 'Organize your product categories'
    },
    {
      name: 'View Analytics',
      href: '/admin/analytics',
      icon: ChartBarIcon,
      description: 'Check your store performance'
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: CogIcon,
      description: 'Configure your store settings'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your Sako store products and settings
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right mr-4">
                <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                <p className="text-xs text-gray-500">Admin User</p>
              </div>
              <Link
                href="/admin/import"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                Import Products
              </Link>
              <Link
                href="/admin/products/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Product
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {loading ? (
            // Loading skeleton
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CubeIcon className="h-6 w-6 text-gray-300" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                        <div className="h-8 bg-gray-200 rounded w-16"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : error ? (
            // Error state
            <div className="col-span-full bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <p className="text-sm font-medium text-red-600">
                      Failed to load statistics
                    </p>
                    <p className="text-sm text-gray-500">
                      {error}
                    </p>
                    <button
                      onClick={fetchStats}
                      className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Stats display
            statsDisplay.map((stat) => (
              <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CubeIcon className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          {stat.name}
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {stat.value}
                          </div>
                          {stat.change && (
                            <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                              stat.changeType === 'positive' ? 'text-green-600' : 
                              stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-500'
                            }`}>
                              {stat.change}
                            </div>
                          )}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {quickActions.map((action) => (
                <Link
                  key={action.name}
                  href={action.href}
                  className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div>
                    <span className="rounded-lg inline-flex p-3 bg-indigo-50 text-indigo-700 ring-4 ring-white">
                      <action.icon className="h-6 w-6" />
                    </span>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-medium text-gray-900 group-hover:text-indigo-600">
                      {action.name}
                    </h3>
                    <p className="mt-2 text-sm text-gray-500">
                      {action.description}
                    </p>
                  </div>
                  <span className="absolute top-6 right-6 text-gray-300 group-hover:text-gray-400">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: 'overview', name: 'Overview', icon: ChartBarIcon },
                { id: 'products', name: 'Products', icon: CubeIcon },
                { id: 'categories', name: 'Categories', icon: TagIcon },
                { id: 'users', name: 'Users', icon: UsersIcon },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="text-center py-12">
                <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No analytics yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by adding some products to your store.
                </p>
                <div className="mt-6 space-x-4">
                  <Link
                    href="/admin/import"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                    Import Products
                  </Link>
                  <Link
                    href="/admin/products/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Product
                  </Link>
                </div>
              </div>
            )}
            {activeTab === 'products' && (
              <div className="text-center py-12">
                <CubeIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Manage Products</h3>
                <p className="mt-1 text-sm text-gray-500">
                  View and edit your product catalog.
                </p>
                <div className="mt-6 space-x-4">
                  <Link
                    href="/admin/import"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                    Import Products
                  </Link>
                  <Link
                    href="/admin/products"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    View Products
                  </Link>
                </div>
              </div>
            )}
            {activeTab === 'categories' && (
              <div className="text-center py-12">
                <TagIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Manage Categories</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Organize your products into categories.
                </p>
                <div className="mt-6">
                  <Link
                    href="/admin/categories"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    View Categories
                  </Link>
                </div>
              </div>
            )}
            {activeTab === 'users' && (
              <div className="text-center py-12">
                <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Manage Users</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Control access to your admin panel.
                </p>
                <div className="mt-6">
                  <Link
                    href="/admin/users"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    View Users
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute>
      <AdminDashboard />
    </ProtectedRoute>
  )
} 