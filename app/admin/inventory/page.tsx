'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import ProtectedRoute from '@/app/components/ProtectedRoute';

interface ParsedRow {
  sku: string;
  quantity: number;
  parsed?: {
    fullSku: string;
    productSku: string;
    colorCode: string;
    colorSlug: string;
    size: string;
    isValid: boolean;
    error?: string;
  };
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

interface UpdateResult {
  success: boolean;
  total: number;
  successCount: number;
  failed: number;
  skipped: number;
  errors: string[];
  details: ParsedRow[];
}

function InventoryManagement() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [previewData, setPreviewData] = useState<ParsedRow[] | null>(null);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'updating' | 'complete'>('upload');

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }

      setCsvFile(file);
      setError(null);

      // Read file content
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCsvContent(content);
      };
      reader.onerror = () => {
        setError('Failed to read file');
      };
      reader.readAsText(file);
    }
  };

  // Preview CSV data
  const handlePreview = async () => {
    if (!csvContent) {
      setError('No CSV content to preview');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvContent,
          preview: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to preview CSV');
      }

      setPreviewData(data.rows);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview CSV');
    } finally {
      setLoading(false);
    }
  };

  // Execute inventory update
  const handleUpdate = async () => {
    if (!csvContent) {
      setError('No CSV content to update');
      return;
    }

    setLoading(true);
    setError(null);
    setStep('updating');

    try {
      const response = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvContent,
          preview: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update inventory');
      }

      setUpdateResult(data);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update inventory');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setCsvFile(null);
    setCsvContent('');
    setPreviewData(null);
    setUpdateResult(null);
    setError(null);
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Inventory Update</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Update product stock levels from CSV file
                </p>
              </div>
            </div>
            {step !== 'upload' && (
              <button
                onClick={handleReset}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Start Over
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <InformationCircleIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3 flex-1">
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-medium text-blue-800">CSV Format Instructions</h3>
                <a
                  href="/templates/inventory-update-template.csv"
                  download
                  className="ml-4 inline-flex items-center px-3 py-1 border border-blue-300 text-xs font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <DocumentTextIcon className="h-4 w-4 mr-1" />
                  Download Template
                </a>
              </div>
              <div className="mt-2 text-sm text-blue-700">
                <p className="mb-2">Your CSV file should have the following columns:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <code className="bg-blue-100 px-1 py-0.5 rounded">SKU</code>: Full product SKU in
                    format PPPP-PPPPCCSS (e.g., 4925-03010135)
                  </li>
                  <li>
                    <code className="bg-blue-100 px-1 py-0.5 rounded">quantity</code>: Stock quantity
                    (non-negative integer)
                  </li>
                </ul>
                <div className="mt-3 p-2 bg-white rounded border border-blue-200">
                  <p className="font-mono text-xs">
                    SKU,quantity
                    <br />
                    4925-03010135,2
                    <br />
                    4925-03010136,5
                  </p>
                </div>
                <p className="mt-3">
                  <strong>SKU Format:</strong> PPPP-PPPP (Product) + CC (Color Code) + SS (Size)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <XCircleIcon className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Upload CSV File</h2>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12">
              <div className="text-center">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label
                    htmlFor="csv-upload"
                    className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
                    Select CSV File
                  </label>
                  <input
                    ref={fileInputRef}
                    id="csv-upload"
                    name="csv-upload"
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">or drag and drop</p>
                {csvFile && (
                  <div className="mt-4 inline-flex items-center text-sm text-gray-700 bg-gray-100 rounded px-3 py-2">
                    <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                    <span className="font-medium">{csvFile.name}</span>
                    <span className="ml-2 text-gray-500">
                      ({(csvFile.size / 1024).toFixed(2)} KB)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {csvFile && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handlePreview}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    'Preview & Validate'
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && previewData && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Preview Summary</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Records</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">
                      {previewData.length}
                    </dd>
                  </div>
                </div>
                <div className="bg-green-50 overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <dt className="text-sm font-medium text-green-700 truncate">Valid Records</dt>
                    <dd className="mt-1 text-3xl font-semibold text-green-900">
                      {previewData.filter((r) => r.parsed?.isValid).length}
                    </dd>
                  </div>
                </div>
                <div className="bg-red-50 overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <dt className="text-sm font-medium text-red-700 truncate">Invalid Records</dt>
                    <dd className="mt-1 text-3xl font-semibold text-red-900">
                      {previewData.filter((r) => !r.parsed?.isValid).length}
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Data Preview</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Color
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.map((row, index) => (
                      <tr key={index} className={!row.parsed?.isValid ? 'bg-red-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {row.parsed?.isValid ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 text-red-500" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {row.sku}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.parsed?.productSku || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.parsed?.colorSlug ? (
                            <span className="inline-flex items-center">
                              <span className="capitalize">{row.parsed.colorSlug}</span>
                              <span className="ml-1 text-xs text-gray-400">
                                ({row.parsed.colorCode})
                              </span>
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.parsed?.size || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {row.quantity}
                        </td>
                        <td className="px-6 py-4 text-sm text-red-600">
                          {row.parsed?.error || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
              <button
                onClick={handleReset}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={loading || previewData.every((r) => !r.parsed?.isValid)}
                className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Update Inventory ({previewData.filter((r) => r.parsed?.isValid).length} records)
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Updating (Loading) */}
        {step === 'updating' && (
          <div className="bg-white shadow rounded-lg p-12">
            <div className="text-center">
              <svg
                className="animate-spin mx-auto h-12 w-12 text-indigo-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Updating Inventory...</h3>
              <p className="mt-2 text-sm text-gray-500">
                Please wait while we update both Firebase and Neon databases.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && updateResult && (
          <div className="space-y-6">
            {/* Result Summary */}
            <div
              className={`${
                updateResult.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
              } border rounded-lg p-6`}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  {updateResult.success ? (
                    <CheckCircleIcon className="h-8 w-8 text-green-400" />
                  ) : (
                    <ExclamationCircleIcon className="h-8 w-8 text-yellow-400" />
                  )}
                </div>
                <div className="ml-3">
                  <h3
                    className={`text-lg font-medium ${
                      updateResult.success ? 'text-green-800' : 'text-yellow-800'
                    }`}
                  >
                    {updateResult.success
                      ? 'Inventory Updated Successfully!'
                      : 'Inventory Update Completed with Warnings'}
                  </h3>
                  <div className="mt-2 text-sm text-gray-700">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div className="bg-white rounded p-3">
                        <div className="text-2xl font-bold text-gray-900">{updateResult.total}</div>
                        <div className="text-xs text-gray-500">Total</div>
                      </div>
                      <div className="bg-white rounded p-3">
                        <div className="text-2xl font-bold text-green-600">
                          {updateResult.successCount}
                        </div>
                        <div className="text-xs text-gray-500">Success</div>
                      </div>
                      <div className="bg-white rounded p-3">
                        <div className="text-2xl font-bold text-red-600">{updateResult.failed}</div>
                        <div className="text-xs text-gray-500">Failed</div>
                      </div>
                      <div className="bg-white rounded p-3">
                        <div className="text-2xl font-bold text-gray-600">
                          {updateResult.skipped}
                        </div>
                        <div className="text-xs text-gray-500">Skipped</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Errors List */}
            {updateResult.errors.length > 0 && (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
                  <h2 className="text-lg font-medium text-red-900">Errors ({updateResult.errors.length})</h2>
                </div>
                <div className="px-6 py-4">
                  <ul className="space-y-2">
                    {updateResult.errors.map((error, index) => (
                      <li key={index} className="text-sm text-red-700 flex items-start">
                        <XCircleIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Details Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Update Details</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Color
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Message
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {updateResult.details.map((row, index) => (
                      <tr
                        key={index}
                        className={
                          row.status === 'error' ? 'bg-red-50' : row.status === 'success' ? 'bg-green-50' : ''
                        }
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          {row.status === 'success' ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 text-red-500" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {row.sku}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.parsed?.productSku || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                          {row.parsed?.colorSlug || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.parsed?.size || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {row.quantity}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {row.error || (row.status === 'success' ? 'Updated successfully' : '-')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => router.push('/admin')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Back to Dashboard
              </button>
              <button
                onClick={handleReset}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Update More Inventory
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <ProtectedRoute>
      <InventoryManagement />
    </ProtectedRoute>
  );
}

