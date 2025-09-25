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
  stock?: number // Legacy field
  stockBySize?: string // New field for size-specific stock
  sku: string // Required unique identifier
  brand?: string
  featured?: boolean
  new?: boolean
  salePrice?: number
  saleStartDate?: string
  saleEndDate?: string
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
        where: { name_en: row.category },
        update: {},
        create: {
          name_en: row.category,
          name_he: row.category, // Default to same as English
          slug_en: row.category.toLowerCase().replace(/\s+/g, '-'),
          slug_he: row.category.toLowerCase().replace(/\s+/g, '-'), // Default to same as English
          description: `${row.category} products`
        }
      })

      // Check if product already exists by SKU
       if (!row.sku || row.sku.trim() === '') {
         results.errors++
         results.errorsList.push(`Product "${row.name}" is missing required SKU`)
         continue
       }

       const existingProductBySku = await prisma.product.findFirst({
         where: { sku: row.sku }
       })

       if (existingProductBySku) {
         results.errors++
         results.errorsList.push(`Product with SKU "${row.sku}" already exists`)
         continue
       }

      // Parse images (assuming comma-separated URLs)
      const imageUrls = row.images.split(',').map(url => url.trim()).filter(Boolean)
      
      // Parse sizes (assuming comma-separated)
      const sizes = row.sizes.split(',').map(size => size.trim()).filter(Boolean)
      
      // Parse colors (assuming comma-separated)
      const colors = row.colors.split(',').map(color => color.trim()).filter(Boolean)

      // Parse stock by size
      let stockBySize: Record<string, number> = {};
      let totalStock = 0;
      
      if (row.stockBySize) {
        // New format: "36:10,37:15,38:20,39:15,40:10"
        const stockEntries = row.stockBySize.split(',').map(entry => entry.trim()).filter(Boolean);
        stockBySize = {};
        
        for (const entry of stockEntries) {
          const [size, quantity] = entry.split(':').map(s => s.trim());
          if (size && quantity && !isNaN(parseInt(quantity))) {
            stockBySize[size] = parseInt(quantity);
            totalStock += parseInt(quantity);
          }
        }
      } else if (row.stock) {
        // Fallback to old format: distribute total stock evenly
        const stockPerSize = Math.floor(parseInt(row.stock.toString()) / sizes.length);
        sizes.forEach(size => {
          stockBySize[size] = stockPerSize;
          totalStock += stockPerSize;
        });
      }

      // Create product
      await prisma.product.create({
        data: {
          title_en: row.name,
          title_he: row.name, // Default to same as English
          description_en: row.description,
          description_he: row.description, // Default to same as English
          sku: row.sku,
          brand: row.brand || '',
          price: parseFloat(row.price) || 0,
          currency: 'ILS',
          category: row.category,
          categories_path: [row.category],
          categories_path_id: [category.id],
          categoryId: category.id,
          featured: row.featured || false,
          isNew: row.new || false,
          isActive: true,
          isEnabled: true,
          isDeleted: false
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
      category: true
    }
  })

  return products.map(product => {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      category: product.category.name,
      featured: product.featured,
      new: product.isNew,
      active: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };
  });
} 