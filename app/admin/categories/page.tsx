'use client'

import { useState, useEffect } from 'react'
import { categoryService, Category } from '@/lib/firebase'
import { 
  ArrowLeftIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import SuccessMessage from '@/app/components/SuccessMessage'

interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[]
  subChildren?: CategoryWithChildren[]
}

function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithChildren[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [selectedParent, setSelectedParent] = useState<Category | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Form state
  const [formData, setFormData] = useState({
    nameEn: '',
    nameHe: '',
    descriptionEn: '',
    descriptionHe: '',
    slugEn: '',
    slugHe: '',
    image: '',
    level: 0,
    parentId: '',
    isEnabled: true
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchCategories()
  }, []) // fetchCategories is stable and doesn't need to be in dependencies

  const fetchCategories = async () => {
    try {
      setLoading(true)
      console.log('Fetching categories...')
      
      // Ensure default navigation categories exist first
      await ensureDefaultCategories()
      
      // Fetch all categories (including newly created ones)
      const allCategories = await categoryService.getAllCategories()
      console.log('Raw categories from Firebase:', allCategories.length, 'categories')
      
      // Log all categories for debugging
      allCategories.forEach(cat => {
        console.log('Category:', {
          id: cat.id,
          name: typeof cat.name === 'object' ? cat.name?.en : cat.name,
          level: cat.level,
          parentId: cat.parentId,
          path: cat.path
        })
      })
      
      // Remove duplicates by ID
      const uniqueCategories = allCategories.filter((category, index, self) => 
        index === self.findIndex(c => c.id === category.id)
      )
      
      console.log(`Total categories: ${allCategories.length}, Unique categories: ${uniqueCategories.length}`)
      
      // Build hierarchical structure with unique categories
      const hierarchicalCategories = buildHierarchy(uniqueCategories)
      console.log('Built hierarchy with', hierarchicalCategories.length, 'root categories')
      
      setCategories(hierarchicalCategories)
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const ensureDefaultCategories = async (): Promise<void> => {
    const defaultCategories = [
      {
        name: {
          en: 'Home',
          he: 'בית'
        },
        slug: {
          en: 'home',
          he: 'בית'
        },
        description: {
          en: 'Home page category',
          he: 'קטגוריית דף הבית'
        },
        level: 0,
        isEnabled: true,
        sortOrder: 0
      },
      {
        name: {
          en: 'Women',
          he: 'נשים'
        },
        slug: {
          en: 'women',
          he: 'נשים'
        },
        description: {
          en: 'Women\'s collection',
          he: 'קולקציית נשים'
        },
        level: 0,
        isEnabled: true,
        sortOrder: 1
      },
      // Men category removed - will not be auto-created
      // {
      //   name: {
      //     en: 'Men',
      //     he: 'גברים'
      //   },
      //   slug: {
      //     en: 'men',
      //     he: 'גברים'
      //   },
      //   description: {
      //     en: 'Men\'s collection',
      //     he: 'קולקציית גברים'
      //   },
      //   level: 0,
      //   isEnabled: true,
      //   sortOrder: 2
      // },
      {
        name: {
          en: 'About',
          he: 'אודות'
        },
        slug: {
          en: 'about',
          he: 'אודות'
        },
        description: {
          en: 'About us page',
          he: 'דף אודותינו'
        },
        level: 0,
        isEnabled: true,
        sortOrder: 2
      },
      {
        name: {
          en: 'Contact',
          he: 'צרו קשר'
        },
        slug: {
          en: 'contact',
          he: 'צרו-קשר'
        },
        description: {
          en: 'Contact us page',
          he: 'דף צור קשר'
        },
        level: 0,
        isEnabled: true,
        sortOrder: 3
      }
    ]

    // Check if default categories exist in Firebase, create them if they don't
    const existingCategories = await categoryService.getAllCategories()

    for (const defaultCategory of defaultCategories) {
      const exists = existingCategories.find(cat => 
        cat.level === 0 && 
        (typeof cat.slug === 'string' ? cat.slug : cat.slug?.en || '').toLowerCase() === defaultCategory.slug.en.toLowerCase()
      )

      if (!exists) {
        try {
          const categoryId = await categoryService.createCategory(defaultCategory)
          console.log(`Created default category: ${defaultCategory.name.en} with ID: ${categoryId}`)
        } catch (error) {
          console.error(`Error creating default category ${defaultCategory.name.en}:`, error)
        }
      }
    }
  }

  const buildHierarchy = (allCategories: Category[]): CategoryWithChildren[] => {
    const categoryMap = new Map<string, CategoryWithChildren>()
    const rootCategories: CategoryWithChildren[] = []

    console.log('Building hierarchy with categories:', allCategories.map(c => ({ 
      id: c.id, 
      name: typeof c.name === 'object' ? c.name?.en : c.name, 
      level: c.level, 
      parentId: c.parentId,
      path: c.path
    })))

    // Create map of all categories
    allCategories.forEach(cat => {
      if (cat.id) { // Only process categories with valid IDs
        categoryMap.set(cat.id, { ...cat, children: [], subChildren: [] })
      }
    })

    // Build hierarchy - process by level order to ensure parents are processed first
    const processedCategories = new Set<string>() // Track processed categories to avoid duplicates
    
    // Sort categories by level to ensure parents are processed before children
    const sortedCategories = [...allCategories].sort((a, b) => a.level - b.level)
    console.log('Processing categories in level order:', sortedCategories.map(c => ({ 
      id: c.id, 
      name: typeof c.name === 'object' ? c.name?.en : c.name, 
      level: c.level 
    })))
    
    sortedCategories.forEach(cat => {
      if (!cat.id) return // Skip categories without IDs
      if (processedCategories.has(cat.id)) {
        console.log(`Skipping duplicate category ${cat.id}`)
        return // Skip if already processed
      }
      processedCategories.add(cat.id)
      
      const categoryWithChildren = categoryMap.get(cat.id)
      if (!categoryWithChildren) return
      
      if (cat.level === 0) {
        // Main category - check if already added to avoid duplicates
        const alreadyExists = rootCategories.find(c => c.id === cat.id)
        if (!alreadyExists) {
          rootCategories.push(categoryWithChildren)
        }
      } else if (cat.level === 1 && cat.parentId) {
        // Sub-category
        const parent = categoryMap.get(cat.parentId)
        if (parent) {
          // Check if already added to avoid duplicates
          const alreadyExists = parent.children!.find(c => c.id === cat.id)
          if (!alreadyExists) {
            console.log(`Adding subcategory ${cat.id} to parent ${cat.parentId}`)
            parent.children!.push(categoryWithChildren)
          } else {
            console.log(`Subcategory ${cat.id} already exists in parent ${cat.parentId}`)
          }
        }
      } else if (cat.level === 2 && cat.parentId) {
        // Sub-sub-category
        console.log(`Processing sub-sub-category: ${cat.id} (${typeof cat.name === 'object' ? cat.name?.en : cat.name}) with parentId: ${cat.parentId}`)
        
        // Find the parent sub-category
        const parentSubCategory = allCategories.find(c => c.id === cat.parentId)
        console.log(`Found parent sub-category:`, parentSubCategory ? {
          id: parentSubCategory.id,
          name: typeof parentSubCategory.name === 'object' ? parentSubCategory.name?.en : parentSubCategory.name,
          level: parentSubCategory.level,
          parentId: parentSubCategory.parentId
        } : 'NOT FOUND')
        
        if (parentSubCategory && parentSubCategory.parentId) {
          const grandParent = categoryMap.get(parentSubCategory.parentId)
          console.log(`Found grandparent:`, grandParent ? {
            id: grandParent.id,
            name: typeof grandParent.name === 'object' ? grandParent.name?.en : grandParent.name
          } : 'NOT FOUND')
          
          if (grandParent) {
            const parentSub = grandParent.children!.find(c => c.id === cat.parentId)
            console.log(`Found parent sub in children:`, parentSub ? {
              id: parentSub.id,
              name: typeof parentSub.name === 'object' ? parentSub.name?.en : parentSub.name
            } : 'NOT FOUND')
            
            if (parentSub) {
              // Check if already added to avoid duplicates
              const alreadyExists = parentSub.subChildren!.find(c => c.id === cat.id)
              if (!alreadyExists) {
                console.log(`Adding sub-sub-category ${cat.id} (${typeof cat.name === 'object' ? cat.name?.en : cat.name}) to parent ${cat.parentId}`)
                parentSub.subChildren!.push(categoryWithChildren)
              } else {
                console.log(`Sub-sub-category ${cat.id} already exists in parent ${cat.parentId}`)
              }
            } else {
              console.log(`Parent sub-category ${cat.parentId} not found in grandparent's children`)
            }
          } else {
            console.log(`Grandparent ${parentSubCategory.parentId} not found in categoryMap`)
          }
        } else {
          console.log(`Parent sub-category not found or missing grandparent ID`)
        }
      }
    })

    console.log('Final hierarchy built:', rootCategories.map(c => ({ 
      id: c.id, 
      name: c.name?.en, 
      childrenCount: c.children?.length || 0,
      subChildrenCount: c.subChildren?.length || 0
    })))

    return rootCategories
  }

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.nameEn.trim()) {
      newErrors.nameEn = 'English name is required'
    }
    if (!formData.nameHe.trim()) {
      newErrors.nameHe = 'Hebrew name is required'
    }
    if (!formData.slugEn.trim()) {
      newErrors.slugEn = 'English slug is required'
    }
    if (!formData.slugHe.trim()) {
      newErrors.slugHe = 'Hebrew slug is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      const categoryData: any = {
        name: {
          en: formData.nameEn,
          he: formData.nameHe
        },
        slug: {
          en: formData.slugEn,
          he: formData.slugHe
        },
        level: formData.level,
        isEnabled: formData.isEnabled,
        sortOrder: 0 // Will be set by the service
      }

      // Add description if provided
      if (formData.descriptionEn.trim() || formData.descriptionHe.trim()) {
        categoryData.description = {
          en: formData.descriptionEn,
          he: formData.descriptionHe
        }
      }

      // Only add optional fields if they have values
      if (formData.image && formData.image.trim()) {
        categoryData.image = formData.image
      }
      
      if (formData.parentId && formData.parentId.trim()) {
        categoryData.parentId = formData.parentId
      }

      if (editingCategory && editingCategory.id) {
        // Update existing category
        await categoryService.updateCategory(editingCategory.id, categoryData)
        setSuccessMessage('Category updated successfully!')
      } else {
        // Create new category
        await categoryService.createCategory(categoryData)
        setSuccessMessage('Category created successfully!')
      }

      setShowSuccess(true)
      setShowForm(false)
      setEditingCategory(null)
      setSelectedParent(null)
      resetForm()
      fetchCategories()
      
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (error) {
      console.error('Error saving category:', error)
      alert('Failed to save category. Please try again.')
    }
  }

  const resetForm = () => {
    setFormData({
      nameEn: '',
      nameHe: '',
      descriptionEn: '',
      descriptionHe: '',
      slugEn: '',
      slugHe: '',
      image: '',
      level: 0,
      parentId: '',
      isEnabled: true
    })
    setErrors({})
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      nameEn: category.name?.en || '',
      nameHe: category.name?.he || '',
      descriptionEn: category.description?.en || '',
      descriptionHe: category.description?.he || '',
      slugEn: category.slug?.en || '',
      slugHe: category.slug?.he || '',
      image: category.image || '',
      level: category.level,
      parentId: category.parentId || '',
      isEnabled: category.isEnabled
    })
    setShowForm(true)
  }

  const handleAddSubCategory = (parentCategory: Category) => {
    setSelectedParent(parentCategory)
    setFormData({
      nameEn: '',
      nameHe: '',
      descriptionEn: '',
      descriptionHe: '',
      slugEn: '',
      slugHe: '',
      image: '',
      level: parentCategory.level + 1,
      parentId: parentCategory.id!,
      isEnabled: true
    })
    setShowForm(true)
  }

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? This will also delete all sub-categories. This action cannot be undone.')) {
      return
    }

    try {
      await categoryService.deleteCategoryWithChildren(categoryId)
      setSuccessMessage('Category and all sub-categories deleted successfully!')
      setShowSuccess(true)
      fetchCategories()
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (error) {
      console.error('Error deleting category:', error)
      alert('Failed to delete category. Please try again.')
    }
  }

  const handleToggleStatus = async (categoryId: string, currentStatus: boolean) => {
    try {
      await categoryService.toggleCategoryStatus(categoryId, !currentStatus)
      setSuccessMessage(`Category ${!currentStatus ? 'enabled' : 'disabled'} successfully!`)
      setShowSuccess(true)
      fetchCategories()
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (error) {
      console.error('Error toggling category status:', error)
      alert('Failed to toggle category status. Please try again.')
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingCategory(null)
    setSelectedParent(null)
    resetForm()
  }

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  const getLevelLabel = (level: number): string => {
    switch (level) {
      case 0: return 'Main Category'
      case 1: return 'Sub-Category'
      case 2: return 'Sub-Sub-Category'
      default: return 'Category'
    }
  }

  const getLevelColor = (level: number): string => {
    switch (level) {
      case 0: return 'bg-blue-100 text-blue-800'
      case 1: return 'bg-green-100 text-green-800'
      case 2: return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const renderCategoryTree = (category: CategoryWithChildren, depth: number = 0) => {
    const isExpanded = expandedCategories.has(category.id!)
    const hasChildren = (category.children && category.children.length > 0) || 
                       (category.subChildren && category.subChildren.length > 0)

    return (
      <div key={category.id} className="border-l-2 border-gray-200 ml-4">
        <div className={`flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg mb-2 ${
          depth === 0 ? 'shadow-sm' : ''
        }`}>
          <div className="flex items-center space-x-3">
            {hasChildren && (
              <button
                onClick={() => toggleExpanded(category.id!)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-6" />}
            
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-medium text-gray-900">
                  {category.name?.en || 'No English name'} / {category.name?.he || 'No Hebrew name'}
                </h3>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(category.level)}`}>
                  {getLevelLabel(category.level)}
                </span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  category.isEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {category.isEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                EN: /{category.slug?.en || 'no-slug'} | HE: /{category.slug?.he || 'no-slug'}
              </p>
              {category.description && (
                <p className="text-sm text-gray-600 mt-1">
                  EN: {category.description.en || 'No description'} | HE: {category.description.he || 'No description'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleToggleStatus(category.id!, category.isEnabled)}
              className={`p-2 rounded-md ${
                category.isEnabled 
                  ? 'text-green-600 hover:bg-green-50' 
                  : 'text-red-600 hover:bg-red-50'
              }`}
              title={category.isEnabled ? 'Disable' : 'Enable'}
            >
              {category.isEnabled ? (
                <EyeIcon className="h-4 w-4" />
              ) : (
                <EyeSlashIcon className="h-4 w-4" />
              )}
            </button>

            {category.level < 2 && (
              <button
                onClick={() => handleAddSubCategory(category)}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-md"
                title={`Add ${category.level === 0 ? 'Sub-Category' : 'Sub-Sub-Category'}`}
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={() => handleEdit(category)}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-md"
              title="Edit"
            >
              <PencilIcon className="h-4 w-4" />
            </button>

            <button
              onClick={() => handleDelete(category.id!)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-md"
              title="Delete"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="ml-4">
            {category.children?.map((child, index) => {
              console.log(`Rendering child ${child.id} at index ${index}`)
              return renderCategoryTree(child, depth + 1)
            })}
            {category.subChildren?.map((subChild, index) => {
              console.log(`Rendering subChild ${subChild.id} at index ${index}`)
              return renderCategoryTree(subChild, depth + 2)
            })}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link
                href="/admin"
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Back to Admin
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchCategories}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Main Category
              </button>
            </div>
          </div>
          <p className="text-gray-600 mt-2">Manage hierarchical product categories and navigation structure</p>
        </div>

        {showSuccess && (
          <SuccessMessage 
            message={successMessage} 
            onClose={() => setShowSuccess(false)} 
          />
        )}

        {/* Categories Tree */}
        {!showForm && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                Category Hierarchy
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Enabled categories will appear in the website navigation
              </p>
            </div>
            
            <div className="p-6">
              {categories.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
                  <p className="text-gray-500 mb-4">
                    If you have existing categories in your database, you may need to migrate them to the new hierarchical structure.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                      href="/admin/categories/migrate"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700"
                    >
                      <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                      Migrate Existing Categories
                    </Link>
                    <button
                      onClick={() => setShowForm(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Add Main Category
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {categories.map((category, index) => {
                    console.log(`Rendering main category ${category.id} at index ${index}`)
                    return renderCategoryTree(category, 0)
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Category Form */}
        {showForm && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900">
                {editingCategory ? 'Edit Category' : selectedParent ? `Add ${getLevelLabel(formData.level)}` : 'Add Main Category'}
              </h2>
              <p className="text-sm text-gray-600">
                {editingCategory 
                  ? 'Update category information' 
                  : selectedParent 
                    ? `Create a new ${getLevelLabel(formData.level).toLowerCase()} under "${selectedParent.name}"`
                    : 'Create a new main category'
                }
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    English Name *
                  </label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => handleInputChange('nameEn', e.target.value)}
                    className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      errors.nameEn ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter category name in English"
                  />
                  {errors.nameEn && <p className="mt-1 text-sm text-red-600">{errors.nameEn}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hebrew Name *
                  </label>
                  <input
                    type="text"
                    value={formData.nameHe}
                    onChange={(e) => handleInputChange('nameHe', e.target.value)}
                    className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      errors.nameHe ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter category name in Hebrew"
                  />
                  {errors.nameHe && <p className="mt-1 text-sm text-red-600">{errors.nameHe}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    English Slug *
                  </label>
                  <input
                    type="text"
                    value={formData.slugEn}
                    onChange={(e) => handleInputChange('slugEn', e.target.value)}
                    className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      errors.slugEn ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="category-slug-en"
                  />
                  {errors.slugEn && <p className="mt-1 text-sm text-red-600">{errors.slugEn}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    URL-friendly version (e.g., "women-shoes")
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hebrew Slug *
                  </label>
                  <input
                    type="text"
                    value={formData.slugHe}
                    onChange={(e) => handleInputChange('slugHe', e.target.value)}
                    className={`w-full px-3 py-2 border text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      errors.slugHe ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="category-slug-he"
                  />
                  {errors.slugHe && <p className="mt-1 text-sm text-red-600">{errors.slugHe}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    URL-friendly version in Hebrew
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    English Description (Optional)
                  </label>
                  <textarea
                    value={formData.descriptionEn}
                    onChange={(e) => handleInputChange('descriptionEn', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border text-gray-700 border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter category description in English (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hebrew Description (Optional)
                  </label>
                  <textarea
                    value={formData.descriptionHe}
                    onChange={(e) => handleInputChange('descriptionHe', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border text-gray-700 border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter category description in Hebrew (optional)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.image}
                  onChange={(e) => handleInputChange('image', e.target.value)}
                  className="w-full px-3 py-2 border text-gray-700 border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://example.com/category-image.jpg (optional)"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty if you don't have a category image
                </p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isEnabled}
                    onChange={(e) => handleInputChange('isEnabled', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enable Category</span>
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Disabled categories will not appear in the navigation
                </p>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CategoriesPageWrapper() {
  return (
    <ProtectedRoute>
      <CategoriesPage />
    </ProtectedRoute>
  )
}