'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import Image from 'next/image'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface Product {
  id: number
  name: string
  price: number
  category: string
  colors: string[]
  sizes: number[]
  images: string[]
  description?: string
}

interface QuickViewModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product
}

export default function QuickViewModal({ isOpen, onClose, product }: QuickViewModalProps) {
  const [selectedColor, setSelectedColor] = useState(product.colors[0])
  const [selectedSize, setSelectedSize] = useState<number | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % product.images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length)
  }

  const handleAddToCart = () => {
    if (!selectedSize) {
      alert('Please select a size')
      return
    }
    // Implement add to cart logic here
    console.log('Adding to cart:', { product, selectedColor, selectedSize })
  }

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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  {/* Image Gallery */}
                  <div className="relative w-full sm:w-1/2">
                    <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                      <Image
                        src={product.images[currentImageIndex]}
                        alt={product.name}
                        width={500}
                        height={500}
                        className="h-full w-full object-cover object-center"
                      />
                    </div>
                    {product.images.length > 1 && (
                      <>
                        <button
                          onClick={prevImage}
                          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white p-2 shadow-md hover:bg-gray-100"
                        >
                          <ChevronLeftIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={nextImage}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white p-2 shadow-md hover:bg-gray-100"
                        >
                          <ChevronRightIcon className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    <div className="mt-4 flex gap-2">
                      {product.images.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`relative h-16 w-16 overflow-hidden rounded-md ${
                            currentImageIndex === index ? 'ring-2 ring-gray-900' : ''
                          }`}
                        >
                          <Image
                            src={image}
                            alt={`${product.name} - View ${index + 1}`}
                            width={64}
                            height={64}
                            className="h-full w-full object-cover object-center"
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="mt-4 sm:ml-6 sm:mt-0 sm:w-1/2">
                    <Dialog.Title as="h3" className="text-lg font-medium text-gray-900">
                      {product.name}
                    </Dialog.Title>
                    <p className="mt-1 text-lg text-gray-900">${product.price.toFixed(2)}</p>
                    <p className="mt-2 text-sm text-gray-500">
                      {product.description || 'Premium quality sneakers with exceptional comfort and style.'}
                    </p>

                    {/* Color Selection */}
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-900">Color</h4>
                      <div className="mt-2 flex gap-2">
                        {product.colors.map((color) => (
                          <button
                            key={color}
                            onClick={() => setSelectedColor(color)}
                            className={`h-8 w-8 rounded-full border-2 ${
                              selectedColor === color ? 'border-gray-900' : 'border-gray-200'
                            }`}
                            style={{ backgroundColor: color }}
                            title={color.charAt(0).toUpperCase() + color.slice(1)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Size Selection */}
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-900">Size</h4>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {product.sizes.map((size) => (
                          <button
                            key={size}
                            onClick={() => setSelectedSize(size)}
                            className={`flex h-10 items-center justify-center rounded-md border text-sm ${
                              selectedSize === size
                                ? 'border-gray-900 text-gray-900'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Add to Cart Button */}
                    <button
                      onClick={handleAddToCart}
                      className="mt-8 w-full rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Add to Cart
                    </button>
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