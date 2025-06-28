import { prisma } from './prisma'

interface GoogleSheetProduct {
  name: string
  description: string
  price: number
  category: string
  subcategory?: string
  images: string
  sizes: string
  colors: string
  stock: number
  featured?: boolean
  new?: boolean
  salePrice?: number
  saleStartDate?: string
  saleEndDate?: string
  sku?: string
}

export async function importFromGoogleSheets(sheetData: GoogleSheetProduct[]) {
  const results = {
    success: 0,
    errors: 0,
    errorsList: [] as string[]
  }

  for (const row of sheetData) {
    try {
      // Create or find category
      const category = await prisma.category.upsert({
        where: { name: row.category },
        update: {},
        create: {
          name: row.category,
          slug: row.category.toLowerCase().replace(/\s+/g, '-'),
          description: `${row.category} products`
        }
      })

      // Create product slug
      const slug = row.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

      // Check if product already exists
      const existingProduct = await prisma.product.findUnique({
        where: { slug }
      })

      if (existingProduct) {
        results.errors++
        results.errorsList.push(`Product "${row.name}" already exists with slug "${slug}"`)
        continue
      }

      // Parse images (assuming comma-separated URLs)
      const imageUrls = row.images.split(',').map(url => url.trim()).filter(Boolean)
      
      // Parse sizes (assuming comma-separated)
      const sizes = row.sizes.split(',').map(size => size.trim()).filter(Boolean)
      
      // Parse colors (assuming comma-separated)
      const colors = row.colors.split(',').map(color => color.trim()).filter(Boolean)

      // Create product
      const product = await prisma.product.create({
        data: {
          name: row.name,
          slug,
          description: row.description,
          price: parseFloat(row.price.toString()),
          salePrice: row.salePrice ? parseFloat(row.salePrice.toString()) : null,
          saleStartDate: row.saleStartDate ? new Date(row.saleStartDate) : null,
          saleEndDate: row.saleEndDate ? new Date(row.saleEndDate) : null,
          sku: row.sku,
          stock: parseInt(row.stock.toString()),
          featured: row.featured || false,
          isNew: row.new || false,
          isActive: true,
          categoryId: category.id,
          images: {
            create: imageUrls.map((url, index) => ({
              url,
              alt: `${row.name} - Image ${index + 1}`,
              isPrimary: index === 0,
              order: index
            }))
          },
          variants: {
            create: sizes.flatMap(size => 
              colors.map(color => ({
                size,
                color,
                stock: Math.floor(parseInt(row.stock.toString()) / (sizes.length * colors.length)),
                sku: row.sku ? `${row.sku}-${size}-${color}` : undefined
              }))
            )
          }
        }
      })

      results.success++
    } catch (error) {
      results.errors++
      results.errorsList.push(`Error importing "${row.name}": ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return results
}

export async function exportToGoogleSheets() {
  const products = await prisma.product.findMany({
    include: {
      category: true,
      images: true,
      variants: true
    }
  })

  return products.map(product => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    salePrice: product.salePrice,
    category: product.category.name,
    stock: product.stock,
    featured: product.featured,
    new: product.isNew,
    active: product.isActive,
    images: product.images.map(img => img.url).join(', '),
    variants: product.variants.length,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  }))
} 