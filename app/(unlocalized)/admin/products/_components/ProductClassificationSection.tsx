'use client'

import type { Category } from '@/lib/firebase'

interface ProductClassificationSectionProps {
  mainCategories: Category[]
  subCategories: Category[]
  subSubCategories: Category[]
  category: string
  subCategory: string
  subSubCategory: string
  brand: string
  sku: string
  onCategoryChange: (categoryId: string) => void
  onSubCategoryChange: (subCategoryId: string) => void
  onSubSubCategoryChange: (subSubCategoryId: string) => void
  onBrandChange: (value: string) => void
  onSkuChange: (value: string) => void
  errors?: {
    category?: string
    subCategory?: string
    subSubCategory?: string
    brand?: string
    sku?: string
  }
  skuHelperText?: string
}

function categoryLabel(category: Category): string {
  return typeof category.name === 'object' ? category.name.en : category.name
}

const inputClass = (hasError?: boolean) =>
  `mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 ${
    hasError ? 'border-red-300' : 'border-gray-300'
  }`

/** Categories and Product Classification — reuses the existing category/brand/SKU fields, grouped into one card. */
export default function ProductClassificationSection({
  mainCategories,
  subCategories,
  subSubCategories,
  category,
  subCategory,
  subSubCategory,
  brand,
  sku,
  onCategoryChange,
  onSubCategoryChange,
  onSubSubCategoryChange,
  onBrandChange,
  onSkuChange,
  errors = {},
  skuHelperText,
}: ProductClassificationSectionProps) {
  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 mb-4">Categories and Product Classification</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Main Category *
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className={inputClass(!!errors.category)}
          >
            <option value="" className="text-gray-600">
              Select a main category
            </option>
            {mainCategories.map((cat) => (
              <option key={cat.id} value={cat.id} className="text-gray-900">
                {categoryLabel(cat)}
              </option>
            ))}
          </select>
          {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
        </div>

        {category && subCategories.length > 0 && (
          <div>
            <label htmlFor="subCategory" className="block text-sm font-medium text-gray-700">
              Sub Category
            </label>
            <select
              id="subCategory"
              value={subCategory}
              onChange={(e) => onSubCategoryChange(e.target.value)}
              className={inputClass(!!errors.subCategory)}
            >
              <option value="" className="text-gray-600">
                Select a sub category (optional)
              </option>
              {subCategories.map((cat) => (
                <option key={cat.id} value={cat.id} className="text-gray-900">
                  {categoryLabel(cat)}
                </option>
              ))}
            </select>
            {errors.subCategory && <p className="mt-1 text-sm text-red-600">{errors.subCategory}</p>}
          </div>
        )}

        {subCategory && subSubCategories.length > 0 && (
          <div>
            <label htmlFor="subSubCategory" className="block text-sm font-medium text-gray-700">
              Sub-Sub Category
            </label>
            <select
              id="subSubCategory"
              value={subSubCategory}
              onChange={(e) => onSubSubCategoryChange(e.target.value)}
              className={inputClass(!!errors.subSubCategory)}
            >
              <option value="" className="text-gray-600">
                Select a sub-sub category (optional)
              </option>
              {subSubCategories.map((cat) => (
                <option key={cat.id} value={cat.id} className="text-gray-900">
                  {categoryLabel(cat)}
                </option>
              ))}
            </select>
            {errors.subSubCategory && <p className="mt-1 text-sm text-red-600">{errors.subSubCategory}</p>}
          </div>
        )}

        <div>
          <label htmlFor="brand" className="block text-sm font-medium text-gray-700">
            Brand *
          </label>
          <input
            type="text"
            id="brand"
            value={brand}
            onChange={(e) => onBrandChange(e.target.value)}
            className={`${inputClass(!!errors.brand)} placeholder-gray-400 text-gray-700`}
            placeholder="Enter brand name"
          />
          {errors.brand && <p className="mt-1 text-sm text-red-600">{errors.brand}</p>}
        </div>

        <div>
          <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
            SKU *
          </label>
          <input
            type="text"
            id="sku"
            value={sku}
            onChange={(e) => onSkuChange(e.target.value)}
            className={`${inputClass(!!errors.sku)} placeholder-gray-400 text-gray-700`}
            placeholder="Product SKU (e.g., 0000-0000)"
          />
          {skuHelperText && <p className="mt-1 text-sm text-gray-500">{skuHelperText}</p>}
          {errors.sku && <p className="mt-1 text-sm text-red-600">{errors.sku}</p>}
        </div>
      </div>
    </div>
  )
}
