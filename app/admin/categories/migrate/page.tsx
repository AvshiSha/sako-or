'use client'

import { useState } from 'react'
import { categoryService, Category } from '@/lib/firebase'
import { ArrowLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import SuccessMessage from '@/app/components/SuccessMessage'

export default function MigrateCategoriesPage() {
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [existingCategories, setExistingCategories] = useState<Category[]>([])
  const [migrationStatus, setMigrationStatus] = useState<string>('')

  const checkExistingCategories = async () => {
    try {
      setLoading(true)
      setMigrationStatus('Checking existing categories...')
      
      // Get all categories (including old ones without new fields)
      const allCategories = await categoryService.getAllCategories()
      
      // Filter categories that need migration (missing new fields)
      const categoriesToMigrate = allCategories.filter(cat => 
        cat.level === undefined || 
        cat.isEnabled === undefined || 
        cat.sortOrder === undefined
      )
      
      setExistingCategories(categoriesToMigrate)
      
      if (categoriesToMigrate.length === 0) {
        setMigrationStatus('All categories are already migrated! No action needed.')
      } else {
        setMigrationStatus(`Found ${categoriesToMigrate.length} categories that need migration.`)
      }
    } catch (error) {
      console.error('Error checking categories:', error)
      setMigrationStatus('Error checking categories. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const migrateCategories = async () => {
    try {
      setLoading(true)
      setMigrationStatus('Starting migration...')
      
      let migratedCount = 0
      
      for (const category of existingCategories) {
        const updateData: Partial<Category> = {
          level: 0, // Set all existing categories as main categories
          isEnabled: true, // Enable all existing categories
          sortOrder: migratedCount, // Set sort order based on current order
          updatedAt: new Date()
        }
        
        if (category.id) {
          await categoryService.updateCategory(category.id, updateData)
          migratedCount++
          setMigrationStatus(`Migrated ${migratedCount}/${existingCategories.length} categories...`)
        }
      }
      
      setSuccessMessage(`Successfully migrated ${migratedCount} categories!`)
      setShowSuccess(true)
      setMigrationStatus('Migration completed successfully!')
      setExistingCategories([])
      
      setTimeout(() => setShowSuccess(false), 5000)
    } catch (error) {
      console.error('Error migrating categories:', error)
      setMigrationStatus('Error during migration. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center">
              <Link
                href="/admin/categories"
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Back to Categories
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Migrate Categories</h1>
            </div>
            <p className="text-gray-600 mt-2">Update existing categories to the new hierarchical structure</p>
          </div>

          {showSuccess && (
            <SuccessMessage 
              message={successMessage} 
              onClose={() => setShowSuccess(false)} 
            />
          )}

          {/* Migration Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 mt-0.5 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-yellow-800 mb-2">
                  Category Migration Required
                </h3>
                <p className="text-yellow-700 mb-4">
                  Your existing categories need to be updated to work with the new hierarchical system. 
                  This migration will:
                </p>
                <ul className="list-disc list-inside text-yellow-700 space-y-1 mb-4">
                  <li>Set all existing categories as "Main Categories" (Level 0)</li>
                  <li>Enable all existing categories (they will appear in navigation)</li>
                  <li>Set proper sort order for display</li>
                  <li>Preserve all existing category data (name, slug, description, etc.)</li>
                </ul>
                <p className="text-yellow-700 font-medium">
                  This process is safe and will not delete any existing data.
                </p>
              </div>
            </div>
          </div>

          {/* Migration Controls */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                Migration Steps
              </h2>
              <p className="text-gray-600">
                Follow these steps to migrate your existing categories:
              </p>
            </div>

            <div className="space-y-4">
              {/* Step 1: Check Categories */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Step 1: Check Existing Categories</h3>
                  <p className="text-sm text-gray-600">Find categories that need migration</p>
                </div>
                <button
                  onClick={checkExistingCategories}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Checking...' : 'Check Categories'}
                </button>
              </div>

              {/* Step 2: Migrate Categories */}
              {existingCategories.length > 0 && (
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Step 2: Migrate Categories</h3>
                    <p className="text-sm text-gray-600">
                      Found {existingCategories.length} categories to migrate
                    </p>
                  </div>
                  <button
                    onClick={migrateCategories}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Migrating...' : 'Migrate Categories'}
                  </button>
                </div>
              )}

              {/* Migration Status */}
              {migrationStatus && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-700">{migrationStatus}</p>
                </div>
              )}

              {/* Categories List */}
              {existingCategories.length > 0 && (
                <div className="border border-gray-200 rounded-lg">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-medium text-gray-900">Categories to Migrate</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {existingCategories.map((category) => (
                      <div key={category.id} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{category.name}</h4>
                            <p className="text-sm text-gray-600">/{category.slug}</p>
                            {category.description && (
                              <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            Will become: Main Category
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* After Migration Instructions */}
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">After Migration</h3>
              <p className="text-blue-800 text-sm">
                Once migration is complete, you can:
              </p>
              <ul className="list-disc list-inside text-blue-800 text-sm mt-2 space-y-1">
                <li>Create sub-categories under your main categories</li>
                <li>Create sub-sub-categories under sub-categories</li>
                <li>Enable/disable categories as needed</li>
                <li>Reorder categories within each level</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
