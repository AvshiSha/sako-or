'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowUpTrayIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

export default function ImportPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{
    success: number
    errors: number
    errorsList: string[]
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/json') {
      setFile(selectedFile)
    } else {
      alert('Please select a valid JSON file')
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const sheetData = JSON.parse(text)

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
        name: "Crystal Embellished Pumps",
        description: "Elegant pumps adorned with crystal embellishments for a touch of luxury.",
        price: 299.99,
        category: "women",
        subcategory: "shoes",
        images: "/images/products/pump-1.jpg,/images/products/pump-2.jpg",
        sizes: "36,37,38,39,40",
        colors: "Black,Silver,Gold",
        stock: 50,
        featured: true,
        new: true,
        salePrice: null,
        saleStartDate: null,
        saleEndDate: null,
        sku: "PUMP-001"
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

  return (
    <div className="min-h-screen bg-gray-50">
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
                <h4 className="font-medium text-gray-900">Google Sheets Format</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Export your Google Sheets data as JSON with the following structure:
                </p>
                <ul className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>• <strong>name</strong>: Product name (required)</li>
                  <li>• <strong>description</strong>: Product description (required)</li>
                  <li>• <strong>price</strong>: Product price (required)</li>
                  <li>• <strong>category</strong>: Product category (required)</li>
                  <li>• <strong>images</strong>: Comma-separated image URLs (required)</li>
                  <li>• <strong>sizes</strong>: Comma-separated sizes (required)</li>
                  <li>• <strong>colors</strong>: Comma-separated colors (required)</li>
                  <li>• <strong>stock</strong>: Total stock quantity (required)</li>
                  <li>• <strong>featured</strong>: Mark as featured (optional)</li>
                  <li>• <strong>new</strong>: Mark as new (optional)</li>
                  <li>• <strong>salePrice</strong>: Sale price (optional)</li>
                  <li>• <strong>sku</strong>: Stock keeping unit (optional)</li>
                </ul>
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Download Template
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Upload JSON File
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
                  accept=".json"
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
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="flex items-center space-x-4">
                  <div className="flex items-center text-green-600">
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    <span className="font-medium">{results.success} products imported successfully</span>
                  </div>
                  
                  {results.errors > 0 && (
                    <div className="flex items-center text-red-600">
                      <XCircleIcon className="h-5 w-5 mr-2" />
                      <span className="font-medium">{results.errors} errors</span>
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