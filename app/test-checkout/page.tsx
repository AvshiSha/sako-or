'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircleIcon, ClipboardIcon } from '@heroicons/react/24/outline'

export default function TestCheckoutPage() {
  const [copied, setCopied] = useState<string>('')

  const testUrls = [
    {
      name: 'Single Product',
      description: 'One product with quantity 2',
      url: '/en/checkout?products=12345%3A2',
      example: 'products=12345:2'
    },
    {
      name: 'Multiple Products',
      description: 'Two products with different quantities',
      url: '/en/checkout?products=12345%3A3%2C23456%3A1',
      example: 'products=12345:3,23456:1'
    },
    {
      name: 'With Coupon',
      description: 'Products with a coupon code',
      url: '/en/checkout?products=12345%3A2%2C23456%3A1&coupon=SUMMERSALE20',
      example: 'products=12345:2,23456:1&coupon=SUMMERSALE20'
    },
    {
      name: 'Hebrew Language',
      description: 'Same as above but in Hebrew',
      url: '/he/checkout?products=12345%3A2%2C23456%3A1&coupon=WELCOME10',
      example: 'products=12345:2,23456:1&coupon=WELCOME10'
    }
  ]

  const copyToClipboard = async (text: string, urlName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(urlName)
      setTimeout(() => setCopied(''), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Instagram Shop Checkout URL Tester
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Test the checkout URL functionality for Instagram/Facebook shop integration.
            These URLs can be used to pre-populate the cart with products and apply coupons.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">URL Format</h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <code className="text-sm text-gray-800">
              https://www.sako-or.com/[language]/checkout?products=SKU1:quantity1,SKU2:quantity2&coupon=COUPON_CODE
            </code>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p><strong>Parameters:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><code>products</code> - Comma-separated list of SKU:quantity pairs (URL encoded)</li>
              <li><code>coupon</code> - Optional coupon code to apply</li>
              <li><code>language</code> - en or he for English/Hebrew</li>
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          {testUrls.map((test, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {test.name}
                  </h3>
                  <p className="text-gray-600 mb-3">{test.description}</p>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <code className="text-sm text-gray-800 break-all">
                      {test.example}
                    </code>
                  </div>
                </div>
                <div className="ml-4 flex flex-col space-y-2">
                  <Link
                    href={test.url}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    Test URL
                  </Link>
                  <button
                    onClick={() => copyToClipboard(test.url, test.name)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <ClipboardIcon className="h-4 w-4 mr-2" />
                    {copied === test.name ? 'Copied!' : 'Copy URL'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Available Test Coupons
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-medium text-gray-900">SUMMERSALE20</h4>
              <p className="text-sm text-gray-600">20% off, min order ₪100</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-medium text-gray-900">WELCOME10</h4>
              <p className="text-sm text-gray-600">10% off, min order ₪50</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-medium text-gray-900">FREESHIP</h4>
              <p className="text-sm text-gray-600">Free shipping</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-medium text-gray-900">NEWCUSTOMER</h4>
              <p className="text-sm text-gray-600">15% off, min order ₪75</p>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-3">
            Important Notes
          </h3>
          <ul className="list-disc list-inside text-yellow-800 space-y-2">
            <li>URL parameters are URL-encoded (colons become %3A, commas become %2C)</li>
            <li>Product SKUs must exist in the database</li>
            <li>Quantities must be positive integers</li>
            <li>Coupon codes are case-insensitive</li>
            <li>Invalid products will show an error message</li>
            <li>Users can still modify quantities and remove items after URL loading</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

