'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'

const collections = [
  {
    name: 'Luxury Heels',
    description: 'Elevate your style with our curated collection of designer heels',
    href: '/collection/high-heels',
    imageSrc: '/images/collections/luxury-heels.jpg',
  },
  {
    name: 'Designer Boots',
    description: 'Sophisticated boots for the modern fashion connoisseur',
    href: '/collection/boots',
    imageSrc: '/images/collections/designer-boots.jpg',
  },
  {
    name: 'Classic Oxford',
    description: 'Timeless elegance meets contemporary design',
    href: '/collection/oxford',
    imageSrc: '/images/collections/classic-oxford.jpg',
  },
]

const featuredProducts = [
  {
    id: 1,
    name: 'Italian Leather Stilettos',
    href: '/collection/high-heels/italian-stilettos',
    imageSrc: '/images/products/italian-leather-stilettos.jpg',
    imageAlt: 'Handcrafted Italian leather stilettos',
    price: '$395',
    description: 'Handcrafted in Italy with premium leather',
  },
  {
    id: 2,
    name: 'Crystal Embellished Pumps',
    href: '/collection/high-heels/crystal-pumps',
    imageSrc: '/images/products/crystal-embellished-pumps.jpg',
    imageAlt: 'Elegant pumps with crystal embellishments',
    price: '$450',
    description: 'Adorned with Swarovski crystals',
  },
  {
    id: 3,
    name: 'Suede Chelsea Boots',
    href: '/collection/boots/suede-chelsea',
    imageSrc: '/images/products/suede-chelsea-boots.jpg',
    imageAlt: 'Premium suede chelsea boots',
    price: '$375',
    description: 'Luxurious suede with artisanal craftsmanship',
  },
]

export default function Home() {
  return (
    <div className="bg-white">
      {/* Hero section */}
      <div className="relative h-screen">
        <div className="absolute inset-0">
          <Image
            src="/images/hero/main-hero.jpg"
            alt="Luxury footwear collection"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-neutral-900 opacity-60" />
        </div>
        <div className="relative h-full flex items-center justify-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8"
          >
            <h1 className="text-5xl md:text-7xl font-light text-white mb-6 tracking-tight">
              Sako Or 
            </h1>
            <p className="text-xl md:text-2xl text-white font-light max-w-2xl mx-auto mb-10">
              Discover our curated collection of premium footwear, sourced from Europe&apos;s finest artisans
              and China&apos;s most prestigious manufacturers.
            </p>
            <Link
              href="/collection"
              className="inline-block bg-white/90 hover:bg-white py-4 px-8 text-gray-900 text-lg font-light tracking-wider transition-all duration-300"
            >
              Explore Collections
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Collections Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-light text-gray-900 mb-4">Curated Collections</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Each piece in our collection represents the perfect harmony of design, comfort, and craftsmanship
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {collections.map((collection) => (
            <motion.div
              key={collection.name}
              whileHover={{ y: -10 }}
              transition={{ duration: 0.3 }}
              className="group relative h-96"
            >
              <Image
                src={collection.imageSrc}
                alt={collection.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-gray-900 opacity-40 group-hover:opacity-30 transition-opacity duration-300" />
              <div className="relative h-full flex items-end p-8">
                <div>
                  <h3 className="text-2xl font-light text-white mb-2">{collection.name}</h3>
                  <p className="text-white/80 mb-4">{collection.description}</p>
                  <Link
                    href={collection.href}
                    className="text-white text-sm tracking-wider hover:underline"
                  >
                    View Collection →
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Featured Products */}
      <div className="bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-light text-gray-900 mb-4">Featured Pieces</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Discover our most coveted designs, each telling a unique story of luxury and sophistication
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {featuredProducts.map((product) => (
              <motion.div
                key={product.id}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="group"
              >
                <div className="relative aspect-square bg-gray-100 mb-4">
                  <Image
                    src={product.imageSrc}
                    alt={product.imageAlt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gray-900/5 group-hover:bg-gray-900/10 transition-colors duration-300" />
                </div>
                <h3 className="text-lg font-light text-gray-900 mb-1">
                  <Link href={product.href}>{product.name}</Link>
                </h3>
                <p className="text-sm text-gray-500 mb-2">{product.description}</p>
                <p className="text-lg text-gray-900">{product.price}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Newsletter Section */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl font-light text-gray-900 mb-4">Join Our World</h2>
            <p className="text-gray-500 mb-8">
              Subscribe to receive exclusive updates, early access to new collections, and personalized style recommendations.
            </p>
            <form className="flex gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 border border-gray-300 focus:border-gray-900 focus:ring-0"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors duration-300"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
