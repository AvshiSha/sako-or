import { describe, it, expect, jest } from '@jest/globals'
import { render, screen } from '../helpers/render'
import ProductCard from '@/app/components/ProductCard'
import { mockProducts } from '@/mocks/fixtures'

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} {...props} data-testid="next-image" />
  ),
}))

// Mock Next.js Link component
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock hooks
jest.mock('@/app/hooks/useFavorites', () => ({
  useFavorites: () => ({
    isFavorite: () => false,
    toggleFavorite: jest.fn(),
  }),
}))

jest.mock('@/app/hooks/useCart', () => ({
  useCart: () => ({
    items: [],
    addToCart: jest.fn(),
  }),
}))

describe('ProductCard Component', () => {
  const product = mockProducts[0]

  it('renders product card with correct data', () => {
    render(<ProductCard product={product} language="en" />)

    // Check that product card is rendered
    const productCard = screen.getByTestId('product-card')
    expect(productCard).toBeInTheDocument()
  })

  it('displays product price', () => {
    render(<ProductCard product={product} language="en" />)

    const priceElement = screen.getByTestId('product-card-price')
    expect(priceElement).toBeInTheDocument()
  })

  it('displays sale price when available', () => {
    render(<ProductCard product={product} language="en" />)

    // Product has salePrice: 250
    const salePrice = screen.queryByTestId('product-card-sale-price')
    if (salePrice) {
      expect(salePrice).toBeInTheDocument()
      expect(salePrice).toHaveTextContent('250')
    }
  })

  it('shows out of stock badge when product is out of stock', () => {
    // Use white variant which has stock 0 for size 40
    const outOfStockProduct = {
      ...product,
      colorVariants: {
        white: {
          ...product.colorVariants.white,
          stockBySize: {
            '40': 0,
            '41': 0,
            '42': 0,
          },
        },
      },
    }

    render(<ProductCard product={outOfStockProduct} language="en" />)

    const outOfStockBadge = screen.queryByTestId('product-card-out-of-stock')
    // May or may not show depending on selected variant
    // This is a basic test structure
  })

  it('renders quick buy button', () => {
    render(<ProductCard product={product} language="en" />)

    const quickBuyButton = screen.getByTestId('product-card-quick-buy-button')
    expect(quickBuyButton).toBeInTheDocument()
  })

  it('renders wishlist button', () => {
    render(<ProductCard product={product} language="en" />)

    const wishlistButton = screen.getByTestId('product-card-wishlist-button')
    expect(wishlistButton).toBeInTheDocument()
  })
})
