'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowUpTrayIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline'
import { convertCSVToJSON, parseCSV, downloadCSVTemplate } from '@/lib/csv-to-json-converter'

interface ImportProduct {
  // Bilingual fields
  name: {
    en: string
    he: string
  }
  description: {
    en: string
    he: string
  }
  slug?: {
    en: string
    he: string
  }
  // Non-language-specific fields
  price: number
  category: string
  subcategory?: string
  images: string
  sizes: string
  colors: string
  stockBySize: string
  sku: string
  featured?: boolean
  new?: boolean
  salePrice?: number | null
  saleStartDate?: string | null
  saleEndDate?: string | null
}

export default function ImportPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{
    success: number
    errors: number
    errorsList: string[]
    missingTranslations: string[]
    created: number
    updated: number
  } | null>(null)
  const [exporting, setExporting] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && (selectedFile.type === 'application/json' || selectedFile.type === 'text/csv')) {
      setFile(selectedFile)
    } else {
      alert('Please select a valid JSON or CSV file')
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      let sheetData
      
      // Handle both JSON and CSV files
      if (file.type === 'text/csv') {
        const csvData = parseCSV(text)
        console.log('Parsed CSV data:', csvData)
        sheetData = convertCSVToJSON(csvData)
        console.log('Converted to JSON:', sheetData)
      } else {
        sheetData = JSON.parse(text)
      }

             // Validate required fields and formats
       const validationErrors: string[] = [];
       const skuSet = new Set<string>();
       
               sheetData.forEach((product: ImportProduct, index: number) => {
         const rowNumber = index + 1;
         
         // Check required fields
         if (!product.sku || product.sku.trim() === '') {
           validationErrors.push(`Row ${rowNumber}: SKU is required`);
         } else {
           // Check for duplicate SKUs
           const sku = product.sku.trim();
           if (skuSet.has(sku)) {
             validationErrors.push(`Row ${rowNumber}: Duplicate SKU "${sku}" found`);
           } else {
             skuSet.add(sku);
           }
         }
         
         // Check bilingual name fields
         if (!product.name || typeof product.name !== 'object') {
           validationErrors.push(`Row ${rowNumber}: Product name must be an object with en and he properties`);
         } else {
           if (!product.name.en || product.name.en.trim() === '') {
             validationErrors.push(`Row ${rowNumber}: English name is required`);
           }
           if (!product.name.he || product.name.he.trim() === '') {
             validationErrors.push(`Row ${rowNumber}: Hebrew name is required`);
           }
         }
         
         // Check bilingual description fields
         if (!product.description || typeof product.description !== 'object') {
           validationErrors.push(`Row ${rowNumber}: Product description must be an object with en and he properties`);
         } else {
           if (!product.description.en || product.description.en.trim() === '') {
             validationErrors.push(`Row ${rowNumber}: English description is required`);
           }
           if (!product.description.he || product.description.he.trim() === '') {
             validationErrors.push(`Row ${rowNumber}: Hebrew description is required`);
           }
         }
         
         // Check other required fields
         if (!product.price || isNaN(parseFloat(product.price.toString()))) {
           validationErrors.push(`Row ${rowNumber}: Valid product price is required`);
         }
         
         if (!product.category || product.category.trim() === '') {
           validationErrors.push(`Row ${rowNumber}: Product category is required`);
         }
         
         if (!product.images || product.images.trim() === '') {
           validationErrors.push(`Row ${rowNumber}: Product images are required`);
         }
         
         if (!product.sizes || product.sizes.trim() === '') {
           validationErrors.push(`Row ${rowNumber}: Product sizes are required`);
         }
         
         if (!product.colors || product.colors.trim() === '') {
           validationErrors.push(`Row ${rowNumber}: Product colors are required`);
         }
         
         if (!product.stockBySize || product.stockBySize.trim() === '') {
           validationErrors.push(`Row ${rowNumber}: stockBySize is required`);
         } else {
           // Validate stockBySize format
           const stockEntries = product.stockBySize.split(',').map((entry: string) => entry.trim()).filter(Boolean);
           for (const entry of stockEntries) {
             const parts = entry.split(':');
             if (parts.length !== 2 || isNaN(parseInt(parts[1]))) {
               validationErrors.push(`Row ${rowNumber}: Invalid stockBySize format. Expected "size:quantity" but got "${entry}"`);
             }
           }
         }
       });

      if (validationErrors.length > 0) {
        // Show detailed error information
        const errorMessage = `Validation errors:\n${validationErrors.join('\n')}\n\nFirst few rows of parsed data:\n${JSON.stringify(sheetData.slice(0, 2), null, 2)}`
        alert(errorMessage);
        setImporting(false);
        return;
      }

      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sheetData }),
      })

      const data = await response.json()

      if (response.ok) {
        setResults(data.results)
      } else {
        alert(`Import failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Import error:', error)
      alert('Failed to import products. Please check your file format.')
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const template = [
      {
        name: {
          en: "Crystal Embellished Pumps",
          he: "נעלי עקב מעוטרות בקריסטלים"
        },
        description: {
          en: "Elegant pumps adorned with crystal embellishments for a touch of luxury.",
          he: "נעלי עקב אלגנטיות מעוטרות בקריסטלים למגע של יוקרה."
        },
        slug: {
          en: "crystal-embellished-pumps",
          he: "נעלי-עקב-מעוטרות-קריסטלים"
        },
        price: 299.99,
        category: "women",
        subcategory: "shoes",
        images: "/images/products/pump-1.jpg,/images/products/pump-2.jpg",
        sizes: "36,37,38,39,40",
        colors: "Black,Silver,Gold",
        stockBySize: "36:10,37:15,38:20,39:15,40:10",
        sku: "PUMP-001",
        featured: true,
        new: true,
        salePrice: null,
        saleStartDate: null,
        saleEndDate: null
      },
      {
        name: {
          en: "Leather Oxford Shoes",
          he: "נעלי אוקספורד מעור"
        },
        description: {
          en: "Classic leather oxford shoes for men with premium craftsmanship.",
          he: "נעלי אוקספורד מעור קלאסיות לגברים עם אומנות פרמיום."
        },
        slug: {
          en: "leather-oxford-shoes",
          he: "נעלי-אוקספורד-מעור"
        },
        price: 199.99,
        category: "men",
        subcategory: "shoes",
        images: "/images/products/oxford-1.jpg,/images/products/oxford-2.jpg",
        sizes: "40,41,42,43,44,45",
        colors: "Brown,Black,Navy",
        stockBySize: "40:8,41:12,42:18,43:15,44:10,45:7",
        sku: "OXFORD-001",
        featured: false,
        new: false,
        salePrice: 179.99,
        saleStartDate: "2024-01-01",
        saleEndDate: "2024-12-31"
      }
    ]

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'products-template.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportProducts = async () => {
    setExporting(true)
    try {
      const response = await fetch('/api/admin/export')
      if (!response.ok) {
        throw new Error('Failed to export products')
      }
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `products-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export products. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Import Products</h1>
              <p className="mt-1 text-sm text-gray-500">
                Import products from Google Sheets or JSON file
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Import Instructions */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Import Instructions
            </h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900">Supported Formats</h4>
                <p className="text-sm text-gray-600 mt-1">
                  You can import products using either JSON or CSV format. For Google Sheets, export as CSV and upload directly, or convert to JSON format.
                </p>
                                 <div className="mt-3 p-3 bg-gray-50 rounded-md">
                   <p className="text-xs text-gray-600 mb-2"><strong>Example stockBySize format:</strong></p>
                   <p className="text-xs text-gray-700 font-mono">&quot;36:10,37:15,38:20,39:15,40:10&quot;</p>
                   <p className="text-xs text-gray-600 mt-1">This means: 10 units in size 36, 15 in size 37, etc.</p>
                 </div>
                 <div className="mt-3 p-3 bg-blue-50 rounded-md">
                   <p className="text-xs text-blue-600 mb-2"><strong>Important:</strong></p>
                   <p className="text-xs text-blue-700">• SKU must be unique across all products</p>
                   <p className="text-xs text-blue-700">• Duplicate SKUs will be rejected</p>
                   <p className="text-xs text-blue-700">• SKU is used as the primary identifier for products</p>
                 </div>
                                 <ul className="text-sm text-gray-600 mt-2 space-y-1">
                   <li>• <strong>name</strong>: Object with en and he properties (required)</li>
                   <li>• <strong>description</strong>: Object with en and he properties (required)</li>
                   <li>• <strong>slug</strong>: Object with en and he properties (optional - auto-generated if missing)</li>
                   <li>• <strong>price</strong>: Product price (required)</li>
                   <li>• <strong>category</strong>: Product category (required)</li>
                   <li>• <strong>images</strong>: Comma-separated image URLs (required)</li>
                   <li>• <strong>sizes</strong>: Comma-separated sizes (required)</li>
                   <li>• <strong>colors</strong>: Comma-separated colors (required)</li>
                   <li>• <strong>stockBySize</strong>: Size-specific stock quantities in format &quot;size:quantity,size:quantity&quot; (required)</li>
                   <li>• <strong>sku</strong>: Stock keeping unit (required) - must be unique</li>
                   <li>• <strong>featured</strong>: Mark as featured (optional)</li>
                   <li>• <strong>new</strong>: Mark as new (optional)</li>
                   <li>• <strong>salePrice</strong>: Sale price (optional)</li>
                 </ul>
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Download JSON Template
                </button>
                <button
                  onClick={downloadCSVTemplate}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Download CSV Template
                </button>
                <button
                  onClick={exportProducts}
                  disabled={exporting}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                      Export Current Products
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Upload File (JSON or CSV)
            </h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="file-upload" className="sr-only">
                  Choose file
                </label>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              {file && (
                <div className="flex items-center text-sm text-gray-600">
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Selected: {file.name}
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={!file || importing}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                    Import Products
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {results && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Import Results
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center text-green-600">
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    <div>
                      <div className="font-medium">{results.success} products processed</div>
                      <div className="text-sm text-gray-600">{results.created} created, {results.updated} updated</div>
                    </div>
                  </div>
                  
                  {results.errors > 0 && (
                    <div className="flex items-center text-red-600">
                      <XCircleIcon className="h-5 w-5 mr-2" />
                      <div>
                        <div className="font-medium">{results.errors} errors</div>
                        <div className="text-sm text-gray-600">Check details below</div>
                      </div>
                    </div>
                  )}

                  {results.missingTranslations.length > 0 && (
                    <div className="flex items-center text-yellow-600">
                      <XCircleIcon className="h-5 w-5 mr-2" />
                      <div>
                        <div className="font-medium">{results.missingTranslations.length} missing translations</div>
                        <div className="text-sm text-gray-600">Products need both languages</div>
                      </div>
                    </div>
                  )}
                </div>

                {results.errorsList.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Errors:</h4>
                    <ul className="text-sm text-red-600 space-y-1">
                      {results.errorsList.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {results.missingTranslations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Missing Translations:</h4>
                    <ul className="text-sm text-yellow-600 space-y-1">
                      {results.missingTranslations.map((translation, index) => (
                        <li key={index}>• {translation}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    onClick={() => router.push('/admin/products')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    View Products
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 