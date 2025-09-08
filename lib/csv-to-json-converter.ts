// Utility to convert CSV data to JSON format for product import

export interface CSVProduct {
  name_en: string
  name_he: string
  description_en: string
  description_he: string
  price: string
  category: string
  subcategory?: string
  images: string
  sizes: string
  colors: string
  stockBySize: string
  sku: string
  featured?: string
  new?: string
  salePrice?: string
  saleStartDate?: string
  saleEndDate?: string
}

export interface JSONProduct {
  name: {
    en: string
    he: string
  }
  description: {
    en: string
    he: string
  }
  slug?: {
    en: string
    he: string
  }
  price: number
  category: string
  subcategory?: string
  images: string
  sizes: string
  colors: string
  stockBySize: string
  sku: string
  featured?: boolean
  new?: boolean
  salePrice?: number | null
  saleStartDate?: string | null
  saleEndDate?: string | null
}

export function convertCSVToJSON(csvData: CSVProduct[]): JSONProduct[] {
  return csvData.map(row => {
    // Generate slugs from names if not provided
    const slugEn = row.name_en?.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim() || ''
    
    const slugHe = row.name_he?.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim() || ''

    return {
      name: {
        en: row.name_en || '',
        he: row.name_he || ''
      },
      description: {
        en: row.description_en || '',
        he: row.description_he || ''
      },
      slug: {
        en: slugEn,
        he: slugHe
      },
      price: parseFloat(row.price) || 0,
      category: row.category || '',
      subcategory: row.subcategory || '',
      images: row.images || '',
      sizes: row.sizes || '',
      colors: row.colors || '',
      stockBySize: row.stockBySize || '',
      sku: row.sku || '',
      featured: row.featured?.toLowerCase() === 'true' || false,
      new: row.new?.toLowerCase() === 'true' || false,
      salePrice: row.salePrice ? parseFloat(row.salePrice) : null,
      saleStartDate: row.saleStartDate || null,
      saleEndDate: row.saleEndDate || null
    }
  })
}

export function parseCSV(csvText: string): CSVProduct[] {
  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  // Skip the first row (headers) and start from index 1
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const data: CSVProduct[] = []

  // Start from index 1 to skip the header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    // Skip empty lines or lines with only commas
    if (!line || line === ',' || line.split(',').every(cell => cell.trim() === '')) continue
    
    // Better CSV parsing that handles quoted values with commas
    const values = parseCSVLine(line)
    const row: any = {}
    
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    
    data.push(row as CSVProduct)
  }

  return data
}

// Helper function to properly parse CSV lines with quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

// Helper function to download CSV template
export function downloadCSVTemplate() {
  const csvContent = `name_en,name_he,description_en,description_he,price,category,subcategory,images,sizes,colors,stockBySize,sku,featured,new,salePrice,saleStartDate,saleEndDate
"Crystal Embellished Pumps","נעלי עקב מעוטרות בקריסטלים","Elegant pumps adorned with crystal embellishments","נעלי עקב אלגנטיות מעוטרות בקריסטלים",299.99,women,shoes,"/images/products/pump-1.jpg,/images/products/pump-2.jpg","36,37,38,39,40","Black,Silver,Gold","36:10,37:15,38:20,39:15,40:10",PUMP-001,true,true,,
"Leather Oxford Shoes","נעלי אוקספורד מעור","Classic leather oxford shoes for men","נעלי אוקספורד מעור קלאסיות לגברים",199.99,men,shoes,"/images/products/oxford-1.jpg,/images/products/oxford-2.jpg","40,41,42,43,44,45","Brown,Black,Navy","40:8,41:12,42:18,43:15,44:10,45:7",OXFORD-001,false,false,179.99,2024-01-01,2024-12-31`

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'products-template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
