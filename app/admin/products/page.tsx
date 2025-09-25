'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { productService, Product, productHelpers, categoryService, Category } from '@/lib/firebase'
import SuccessMessage from '@/app/components/SuccessMessage'

function ProductsPageContent() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    
    // Check for success message in URL
    if (searchParams) {
      const success = searchParams.get('success')
      if (success) {
        setSuccessMessage(success)
        setShowSuccess(true)
        // Clean up URL
        window.history.replaceState({}, '', '/admin/products')
      }
    }
  }, [searchParams])

  const fetchProducts = async () => {
    try {
      const productsData = await productService.getAllProducts()
      setProducts(productsData)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const categoriesData = await categoryService.getAllCategories()
      setCategories(categoriesData)
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const getCategoryPath = (product: Product): string => {
    if (!product.categories_path_id || product.categories_path_id.length === 0) {
      return 'No category'
    }

    const categoryNames: string[] = []
    
    for (const categoryId of product.categories_path_id) {
      const category = categories.find(cat => cat.id === categoryId)
      if (category && category.name && typeof category.name === 'object') {
        categoryNames.push(category.name.en)
      }
    }
    
    return categoryNames.length > 0 ? categoryNames.join(' → ') : 'No category'
  }

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      await productService.deleteProduct(productId)
      setProducts(products.filter(p => p.id !== productId))
      setSuccessMessage('Product deleted successfully!')
      setShowSuccess(true)
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Failed to delete product')
    }
  }

  const filteredProducts = products.filter(product => {
    const productNameEn = productHelpers.getField(product, 'name', 'en')
    const productNameHe = productHelpers.getField(product, 'name', 'he')
    const productSlugEn = productHelpers.getField(product, 'slug', 'en')
    const productSlugHe = productHelpers.getField(product, 'slug', 'he')
    
    const matchesSearch = productNameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         productNameHe.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         productSlugEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         productSlugHe.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = filter === 'all' ||
                         (filter === 'featured' && product.featured) ||
                         (filter === 'new' && product.isNew) ||
                         (filter === 'active' && product.isActive) ||
                         (filter === 'inactive' && !product.isActive)

    return matchesSearch && matchesFilter
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      {/* Success Message */}
      {showSuccess && (
        <SuccessMessage
          message={successMessage}
          onClose={() => setShowSuccess(false)}
        />
      )}

      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Products</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your product catalog
              </p>
            </div>
            <div className="flex space-x-3">
              <Link
                href="/admin/products/sync"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Sync with Neon DB
              </Link>
              <Link
                href="/admin/products/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Product
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Search */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 text-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Filter */}
              <div className="sm:w-48">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 "
                >
                  <option value="all">All Products</option>
                  <option value="featured">Featured</option>
                  <option value="new">New</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <CubeIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || filter !== 'all' 
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Get started by creating your first product.'
                  }
                </p>
                {!searchTerm && filter === 'all' && (
                  <div className="mt-6">
                    <Link
                      href="/admin/products/new"
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Add Product
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 relative">
                              {product.colorVariants?.[0]?.images?.length > 0 || product.colorVariants?.[0]?.primaryImage ? (
                                <Image
                                  className="rounded-lg object-cover"
                                  src={product.colorVariants[0].images?.[0] || product.colorVariants[0].primaryImage || '/placeholder-image.jpg'}
                                  alt={productHelpers.getField(product, 'name', 'en')}
                                  fill
                                  sizes="40px"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center">
                                  <CubeIcon className="h-6 w-6 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {product.title_en || productHelpers.getField(product, 'name', 'en')}
                              </div>
                              <div className="text-sm text-gray-500">
                                {product.sku}
                              </div>
                              <div className="text-xs text-gray-400">
                                HE: {product.title_he || productHelpers.getField(product, 'name', 'he')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getCategoryPath(product)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                          ₪{typeof product.price === 'number' ? product.price.toFixed(2) : '0.00'}
                          </div>
                          {product.colorVariants?.[0]?.salePrice && (
                            <div className="text-sm text-red-600">
                              Sale: ₪{product.colorVariants[0].salePrice.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            (product.colorVariants ? Object.values(product.colorVariants).reduce((total, variant) => total + Object.values(variant.stockBySize).reduce((sum, stock) => sum + stock, 0), 0) : 0) > 10 
                              ? 'bg-green-100 text-green-800'
                              : (product.colorVariants ? Object.values(product.colorVariants).reduce((total, variant) => total + Object.values(variant.stockBySize).reduce((sum, stock) => sum + stock, 0), 0) : 0) > 0
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {product.colorVariants ? Object.values(product.colorVariants).reduce((total, variant) => total + Object.values(variant.stockBySize).reduce((sum, stock) => sum + stock, 0), 0) : 0} in stock
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              product.isEnabled 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {product.isEnabled ? 'Active' : 'Inactive'}
                            </span>
                            {product.featured && (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                Featured
                              </span>
                            )}
                            {product.isNew && (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                New
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <Link
                              href={`/en/product/${product.sku}/${product.colorVariants ? Object.values(product.colorVariants)[0]?.colorSlug || 'default' : 'default'}`}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="View"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </Link>
                            <Link
                              href={`/admin/products/${product.id}/edit`}
                              className="text-blue-600 hover:text-blue-900"
                              title="Edit"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={() => handleDelete(product.id!)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }>
        <ProductsPageContent />
      </Suspense>
    </ProtectedRoute>
  )
}