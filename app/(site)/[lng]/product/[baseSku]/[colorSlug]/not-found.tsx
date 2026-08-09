import type { Metadata } from 'next'
import { fetchHomeBestSellers } from '@/lib/home-products'
import ProductNotFoundClient from './ProductNotFoundClient'

export const metadata: Metadata = {
  title: 'Product Not Found',
  robots: {
    index: false,
    follow: true,
  },
}

export default async function ProductNotFound() {
  const products = await fetchHomeBestSellers()
  return <ProductNotFoundClient products={products} />
}
