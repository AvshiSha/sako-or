'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CubeIcon,
  TagIcon,
  UsersIcon,
  ChartBarIcon,
  PlusIcon,
  ArrowDownTrayIcon,
  ArchiveBoxIcon,
  TicketIcon,
  CurrencyDollarIcon,
  MegaphoneIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline'
import { adminTheme } from './_components/adminTheme'

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview')

  const quickActions = [
    {
      name: 'Add New Product',
      href: '/admin/products/new',
      icon: PlusIcon,
      description: 'Create a new product listing'
    },
    {
      name: 'Update Inventory',
      href: '/admin/inventory',
      icon: ArchiveBoxIcon,
      description: 'Update stock levels from CSV'
    },
    {
      name: 'End-of-Season Price Update',
      href: '/admin/sale-prices',
      icon: CurrencyDollarIcon,
      description: 'Update sale prices in bulk from CSV'
    },
    {
      name: 'Export Meta Catalog',
      href: '/admin/export',
      icon: ArrowDownTrayIcon,
      description: 'Download catalog CSV for Meta'
    },
    {
      name: 'Manage Categories',
      href: '/admin/categories',
      icon: TagIcon,
      description: 'Organize your product categories'
    },
    {
      name: 'Manage Coupons',
      href: '/admin/coupons',
      icon: TicketIcon,
      description: 'Create and monitor promotional discounts'
    },
    {
      name: 'Manage Campaigns',
      href: '/admin/campaigns',
      icon: MegaphoneIcon,
      description: 'Create and manage promotional landing pages'
    },
    {
      name: 'Manage Blog',
      href: '/admin/blog',
      icon: PencilSquareIcon,
      description: 'Create and publish news articles'
    },
  ]

  return (
    <>
      <div className={`${adminTheme.card} border-0 rounded-none shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className={adminTheme.title}>Admin Dashboard</h1>
          <p className={adminTheme.subtitle}>Manage your Sako store products and settings</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`${adminTheme.card} mb-8`}>
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-black mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {quickActions.map((action) => (
                <Link
                  key={action.name}
                  href={action.href}
                  className={adminTheme.quickActionCard}
                >
                  <div>
                    <span className={adminTheme.quickActionIcon}>
                      <action.icon className="h-6 w-6" />
                    </span>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-medium text-black group-hover:text-[#95816C]">
                      {action.name}
                    </h3>
                    <p className="mt-2 text-sm text-[#95816C]">{action.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className={adminTheme.card}>
          <div className={adminTheme.cardHeader}>
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
                    activeTab === tab.id ? adminTheme.tabActive : adminTheme.tabInactive
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
                <ChartBarIcon className="mx-auto h-12 w-12 text-[#B2A28E]" />
                <h3 className="mt-2 text-sm font-medium text-black">No analytics yet</h3>
                <p className="mt-1 text-sm text-[#95816C]">
                  Get started by adding some products to your store.
                </p>
                <div className="mt-6">
                  <Link href="/admin/products/new" className={adminTheme.buttonPrimary}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Product
                  </Link>
                </div>
              </div>
            )}
            {activeTab === 'products' && (
              <div className="text-center py-12">
                <CubeIcon className="mx-auto h-12 w-12 text-[#B2A28E]" />
                <h3 className="mt-2 text-sm font-medium text-black">Manage Products</h3>
                <p className="mt-1 text-sm text-[#95816C]">View and edit your product catalog.</p>
                <div className="mt-6">
                  <Link href="/admin/products" className={adminTheme.buttonPrimary}>
                    View Products
                  </Link>
                </div>
              </div>
            )}
            {activeTab === 'categories' && (
              <div className="text-center py-12">
                <TagIcon className="mx-auto h-12 w-12 text-[#B2A28E]" />
                <h3 className="mt-2 text-sm font-medium text-black">Manage Categories</h3>
                <p className="mt-1 text-sm text-[#95816C]">
                  Organize your products into categories.
                </p>
                <div className="mt-6">
                  <Link href="/admin/categories" className={adminTheme.buttonPrimary}>
                    View Categories
                  </Link>
                </div>
              </div>
            )}
            {activeTab === 'users' && (
              <div className="text-center py-12">
                <UsersIcon className="mx-auto h-12 w-12 text-[#B2A28E]" />
                <h3 className="mt-2 text-sm font-medium text-black">Manage Users</h3>
                <p className="mt-1 text-sm text-[#95816C]">
                  Control access to your admin panel.
                </p>
                <div className="mt-6">
                  <Link href="/admin/users" className={adminTheme.buttonPrimary}>
                    View Users
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default function AdminDashboardPage() {
  return <AdminDashboard />
}
