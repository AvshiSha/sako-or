'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
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
import {
  productService,
  Product,
  productHelpers,
  categoryService,
  Category,
  AdminProductFilter,
  ADMIN_PRODUCTS_PAGE_SIZE,
} from '@/lib/firebase'
import SuccessMessage from '@/app/components/SuccessMessage'
import { adminTheme } from '../_components/adminTheme'

const PAGE_SIZE = ADMIN_PRODUCTS_PAGE_SIZE
const SEARCH_DEBOUNCE_MS = 300

function getTotalStock(product: Product): number {
  if (!product.colorVariants) return 0
  return Object.values(product.colorVariants).reduce(
    (total, variant) =>
      total + Object.values(variant.stockBySize).reduce((sum, stock) => sum + stock, 0),
    0
  )
}

function ProductsPageContent() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<AdminProductFilter>('all')
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const [page, setPage] = useState(1)
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchTotalPages, setSearchTotalPages] = useState(0)

  const isSearchMode = debouncedSearch.trim().length >= 2

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
    setCursorStack([])
    setNextCursor(null)
  }, [debouncedSearch, filter])

  useEffect(() => {
    void fetchCategories()
  }, [])

  useEffect(() => {
    if (searchParams) {
      const success = searchParams.get('success')
      if (success) {
        setSuccessMessage(success)
        setShowSuccess(true)
        window.history.replaceState({}, '', '/admin/products')
      }
    }
  }, [searchParams])

  const fetchCategories = async () => {
    try {
      const categoriesData = await categoryService.getAllCategories()
      setCategories(categoriesData)
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      if (isSearchMode) {
        const result = await productService.searchProducts(debouncedSearch.trim(), {
          page,
          pageSize: PAGE_SIZE,
          filter,
        })
        setProducts(result.products)
        setSearchTotal(result.total)
        setSearchTotalPages(result.totalPages)
        setHasMore(page < result.totalPages)
        setNextCursor(null)
      } else {
        const cursorId = page === 1 ? null : cursorStack[page - 2] ?? null
        const result = await productService.getProductsPage({
          pageSize: PAGE_SIZE,
          cursorId,
          page,
          filter,
        })
        setProducts(result.products)
        setNextCursor(result.nextCursor)
        setHasMore(result.hasMore)
        setSearchTotal(0)
        setSearchTotalPages(0)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }, [isSearchMode, debouncedSearch, page, filter, cursorStack])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const getCategoryPath = (product: Product): string => {
    if (!product.categories_path_id || product.categories_path_id.length === 0) {
      return 'No category'
    }

    const categoryNames: string[] = []
    for (const categoryId of product.categories_path_id) {
      const category = categories.find((cat) => cat.id === categoryId)
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
      setProducts(products.filter((p) => p.id !== productId))
      setSuccessMessage('Product deleted successfully!')
      setShowSuccess(true)
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Failed to delete product')
    }
  }

  const handleNextPage = () => {
    if (!hasMore) return
    if (!isSearchMode && nextCursor) {
      setCursorStack((prev) => {
        const updated = [...prev]
        updated[page - 1] = nextCursor
        return updated
      })
    }
    setPage((prev) => prev + 1)
  }

  const handlePreviousPage = () => {
    if (page <= 1) return
    setPage((prev) => prev - 1)
  }

  const showPagination = isSearchMode ? searchTotalPages > 1 : page > 1 || hasMore

  return (
    <>
      {showSuccess && (
        <SuccessMessage message={successMessage} onClose={() => setShowSuccess(false)} />
      )}

      <div className={`${adminTheme.card} border-0 rounded-none shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
            <div>
              <h1 className={adminTheme.title}>Products</h1>
              <p className={adminTheme.subtitle}>Manage your product catalog</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className={adminTheme.buttonSecondary}>
                Back to Dashboard
              </Link>
              <Link href="/admin/products/sync" className={adminTheme.buttonSecondary}>
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Sync with Neon DB
              </Link>
              <Link href="/admin/products/new" className={adminTheme.buttonPrimary}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Product
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`${adminTheme.card} mb-6`}>
          <div className="px-4 py-5 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#B2A28E]" />
                  <input
                    type="text"
                    placeholder="Search by name, SKU, brand..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`${adminTheme.input} pl-10`}
                  />
                </div>
              </div>
              <div className="sm:w-48">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as AdminProductFilter)}
                  className={adminTheme.select}
                >
                  <option value="all">All Products</option>
                  <option value="featured">Featured</option>
                  <option value="new">New</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            {isSearchMode && !loading && (
              <p className="mt-3 text-sm text-[#95816C]">
                {searchTotal === 0
                  ? `No results for "${debouncedSearch.trim()}"`
                  : `Showing ${searchTotal} result${searchTotal === 1 ? '' : 's'} for "${debouncedSearch.trim()}"`}
              </p>
            )}
          </div>
        </div>

        <div className={`${adminTheme.card} overflow-hidden`}>
          <div className="px-4 py-5 sm:p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className={adminTheme.spinner} />
                <p className="mt-4 text-[#856D55]">Loading products...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <CubeIcon className="mx-auto h-12 w-12 text-[#B2A28E]" />
                <h3 className="mt-2 text-sm font-medium text-black">No products found</h3>
                <p className="mt-1 text-sm text-[#95816C]">
                  {searchTerm || filter !== 'all'
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Get started by creating your first product.'}
                </p>
                {!searchTerm && filter === 'all' && (
                  <div className="mt-6">
                    <Link href="/admin/products/new" className={adminTheme.buttonPrimary}>
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Add Product
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#E1DBD7]">
                    <thead className={adminTheme.tableHead}>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[#856D55] uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[#856D55] uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[#856D55] uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[#856D55] uppercase tracking-wider">
                          Stock
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[#856D55] uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[#856D55] uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[#E1DBD7]">
                      {products.map((product) => {
                        const stock = getTotalStock(product)
                        const isFeatured = product.featuredProduct ?? product.featured
                        const isNew = product.newProduct ?? product.isNew
                        const isActive = product.isEnabled ?? product.isActive

                        return (
                          <tr key={product.id} className={adminTheme.tableRowHover}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 relative">
                                  {product.colorVariants?.[0]?.images?.length > 0 ||
                                  product.colorVariants?.[0]?.primaryImage ? (
                                    <Image
                                      className="rounded-lg object-cover"
                                      src={
                                        product.colorVariants[0].images?.[0] ||
                                        product.colorVariants[0].primaryImage ||
                                        '/placeholder-image.jpg'
                                      }
                                      alt={productHelpers.getField(product, 'name', 'en')}
                                      fill
                                      sizes="40px"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-lg bg-[#E1DBD7] flex items-center justify-center">
                                      <CubeIcon className="h-6 w-6 text-[#B2A28E]" />
                                    </div>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-black">
                                    {product.title_en || productHelpers.getField(product, 'name', 'en')}
                                  </div>
                                  <div className="text-sm text-[#95816C]">{product.sku}</div>
                                  <div className="text-xs text-[#B2A28E]">
                                    HE: {product.title_he || productHelpers.getField(product, 'name', 'he')}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                              {getCategoryPath(product)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-black">
                                ₪{typeof product.price === 'number' ? product.price.toFixed(2) : '0.00'}
                              </div>
                              {product.colorVariants?.[0]?.salePrice && (
                                <div className="text-sm text-red-600">
                                  Sale: ₪{product.colorVariants[0].salePrice.toFixed(2)}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  stock > 10
                                    ? adminTheme.badgeActive
                                    : stock > 0
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : adminTheme.badgeInactive
                                }`}
                              >
                                {stock} in stock
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col space-y-1">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    isActive ? adminTheme.badgeActive : adminTheme.badgeInactive
                                  }`}
                                >
                                  {isActive ? 'Active' : 'Inactive'}
                                </span>
                                {isFeatured && (
                                  <span
                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${adminTheme.badgeFeatured}`}
                                  >
                                    Featured
                                  </span>
                                )}
                                {isNew && (
                                  <span
                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${adminTheme.badgeNew}`}
                                  >
                                    New
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <Link
                                  href={`/en/product/${product.sku}/${product.colorVariants ? Object.values(product.colorVariants)[0]?.colorSlug || 'default' : 'default'}`}
                                  className={adminTheme.link}
                                  title="View"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </Link>
                                <Link
                                  href={`/admin/products/${product.id}/edit`}
                                  className="text-[#95816C] hover:text-[#856D55]"
                                  title="Edit"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </Link>
                                <button
                                  onClick={() => handleDelete(product.id!)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Delete"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {showPagination && (
                  <div className="mt-6 flex items-center justify-between border-t border-[#E1DBD7] pt-4">
                    <p className="text-sm text-[#95816C]">
                      {isSearchMode
                        ? `Page ${page} of ${searchTotalPages}`
                        : `Page ${page}`}
                    </p>
                    <div className="inline-flex space-x-2">
                      <button
                        type="button"
                        onClick={handlePreviousPage}
                        disabled={page <= 1 || loading}
                        className={adminTheme.buttonSecondary}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={handleNextPage}
                        disabled={!hasMore || loading}
                        className={adminTheme.buttonSecondary}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className={adminTheme.spinner} />
            <p className="mt-4 text-[#856D55]">Loading...</p>
          </div>
        </div>
      }
    >
      <ProductsPageContent />
    </Suspense>
  )
}
