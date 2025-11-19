'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { Product, productHelpers } from '@/lib/firebase'
import { getColorName, getColorHex } from '@/lib/colors'

interface QuickViewModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product
  language?: 'en' | 'he'
}

export default function QuickViewModal({ isOpen, onClose, product, language = 'en' }: QuickViewModalProps) {
  // Extract unique colors and sizes from color variants
  const colors = product.colorVariants ? [...new Set(Object.values(product.colorVariants).filter(v => v.isActive !== false).map(v => v.colorSlug).filter(Boolean))] as string[] : []
  const sizes = product.colorVariants ? [...new Set(Object.values(product.colorVariants).flatMap(v => Object.keys(v.stockBySize || {})))] as string[] : []
  
  // Get language-specific product data
  const productName = productHelpers.getField(product, 'name', language)
  const productDescription = productHelpers.getField(product, 'description', language)

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
                        {product.colorVariants && Object.values(product.colorVariants)[0]?.images && Object.values(product.colorVariants)[0].images.length > 0 ? (
                          <Image
                            src={Object.values(product.colorVariants)[0].primaryImage || Object.values(product.colorVariants)[0].images[0]}
                            alt={productName}
                            width={500}
                            height={500}
                            className="h-full w-full object-cover object-center"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gray-200">
                            <span className="text-gray-400">{language === 'he' ? 'אין תמונה' : 'No image'}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{productName}</h3>
                        <p className="mt-1 text-sm text-gray-500">{productDescription}</p>
                        <p className="mt-2 text-lg font-medium text-gray-900">
                          ₪{(Object.values(product.colorVariants || {})[0]?.priceOverride || product.price).toFixed(2)}
                        </p>
                        {Object.values(product.colorVariants || {})[0]?.salePrice && (
                          <p className="mt-1 text-sm text-red-600">
                            {language === 'he' ? 'מבצע' : 'Sale'}: ₪{Object.values(product.colorVariants || {})[0]?.salePrice?.toFixed(2)}
                          </p>
                        )}
                      </div>
                      
                      {colors.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-900">
                            {language === 'he' ? 'צבעים זמינים' : 'Available Colors'}
                          </h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {colors.map((color) => (
                              <div
                                key={color}
                                className="w-8 h-8 rounded-full border-2 border-gray-200"
                                style={{ backgroundColor: getColorHex(color) }}
                                title={getColorName(color, language)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {sizes.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-900">
                            {language === 'he' ? 'מידות זמינות' : 'Available Sizes'}
                          </h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {sizes.map((size) => (
                              <button
                                key={size}
                                className="w-10 h-10 flex items-center justify-center text-sm rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-6">
                        <button
                          type="button"
                          className="w-full rounded-md bg-gray-900 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                        >
                          {language === 'he' ? 'הוסף לעגלה' : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
} 