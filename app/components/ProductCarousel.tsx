'use client'

import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import ProductCard from './ProductCard'

interface Product {
  id: number
  name: string
  price: number
  image: string
  category: string
}

interface ProductCarouselProps {
  products: Product[]
  title: string
}

export default function ProductCarousel({ products, title }: ProductCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const itemsPerPage = 4

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % (products.length - itemsPerPage + 1))
  }

  const prevSlide = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? products.length - itemsPerPage : prevIndex - 1
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-medium tracking-wide uppercase">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={prevSlide}
            className="p-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50"
            disabled={currentIndex === 0}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            onClick={nextSlide}
            className="p-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50"
            disabled={currentIndex === products.length - itemsPerPage}
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{
            transform: `translateX(-${currentIndex * (100 / itemsPerPage)}%)`,
          }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="w-1/4 px-4"
              style={{ flex: `0 0 ${100 / itemsPerPage}%` }}
            >
              <ProductCard {...product} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 