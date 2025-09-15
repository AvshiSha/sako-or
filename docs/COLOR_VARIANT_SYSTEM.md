# Color Variant System Documentation

## Overview

The Color Variant System allows each product color to have its own dedicated URL while keeping all colors of the same product connected together. This provides better SEO, shareable URLs, and improved user experience.

## URL Structure

### New URL Pattern

- **Color-specific URLs**: `/product/{baseSku}/{colorSlug}`
- **Base product redirect**: `/product/{baseSku}` → redirects to default color

### Examples

```
Black: /product/OXF-001/black
Brown: /product/OXF-001/brown
Navy:  /product/OXF-001/navy-blue
Base:  /product/OXF-001 → redirects to /product/OXF-001/black
```

### Migration from Old System

The old `/product/{sku}` URLs have been replaced with the new baseSku system. All existing products will be migrated to use baseSku instead of individual SKUs.

## Database Schema

### Base Product (`products` collection)

```typescript
interface Product {
  id: string;
  name: { en: string; he: string };
  slug: { en: string; he: string };
  description: { en: string; he: string };
  baseSku: string; // Base SKU (e.g., "OXF-001")
  price: number; // Default price
  featured: boolean;
  isNew: boolean;
  isActive: boolean;
  categoryId: string;
  colorVariants: ColorVariant[];
  tags: string[];
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Color Variant (`colorVariants` collection)

```typescript
interface ColorVariant {
  id: string;
  productId: string;
  colorName: string; // Display name (e.g., "Black")
  colorSlug: string; // URL slug (e.g., "black")
  colorHex?: string; // Hex color code
  price?: number; // Override price
  salePrice?: number; // Sale price
  saleStartDate?: Date;
  saleEndDate?: Date;
  stock: number;
  isActive: boolean;
  metaTitle?: string; // SEO title
  metaDescription?: string; // SEO description
  images: ColorVariantImage[];
  sizes: ColorVariantSize[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Color Variant Images (`colorVariantImages` collection)

```typescript
interface ColorVariantImage {
  id: string;
  colorVariantId: string;
  url: string;
  alt?: string;
  isPrimary: boolean;
  order: number;
  createdAt: Date;
}
```

### Color Variant Sizes (`colorVariantSizes` collection)

```typescript
interface ColorVariantSize {
  id: string;
  colorVariantId: string;
  size: string; // Size value (e.g., "36", "M")
  stock: number;
  sku?: string; // Full SKU (e.g., "OXF-001-black-36")
  createdAt: Date;
  updatedAt: Date;
}
```

## Frontend Implementation

### Product Page Structure

```
app/[lng]/product/
├── [baseSku]/
│   ├── page.tsx              # Redirect to default color
│   ├── layout.tsx            # Layout for base product
│   └── [colorSlug]/
│       ├── page.tsx          # Color-specific product page
│       └── layout.tsx        # Layout for color variant
```

### Key Features

#### 1. Color-Specific Pages

- Each color has its own URL and page
- Color-specific images, pricing, and stock
- Individual SEO metadata

#### 2. Color Navigation

- Color picker shows all available colors
- Clicking a color navigates to that color's URL
- Visual color swatches with hex codes

#### 3. Size Management

- Sizes and stock are managed per color variant
- Each size/color combination has a unique SKU
- Stock levels are tracked per size

#### 4. Pricing Flexibility

- Base product has default price
- Each color can override the price
- Sale prices can be set per color
- Sale periods can be configured

## Admin Panel

### Color Variant Management

- **Location**: `/admin/products/color-variants`
- **Features**:
  - View all products with their color variants
  - Add/edit/delete color variants
  - Manage variant images and sizes
  - Enable/disable variants
  - Preview generated URLs

### Adding New Color Variants

1. Navigate to product in color variants page
2. Click "Add Color Variant"
3. Fill in color information:
   - Color name and slug
   - Color hex code (for swatches)
   - Pricing (optional override)
   - Stock levels
4. Upload color-specific images
5. Configure sizes and stock per size
6. Set SEO metadata

## Migration

### From Old System

1. Run migration script: `node scripts/migrate-to-baseSku.js`
2. This will:
   - Convert existing products to use baseSku
   - Create color variants for each color
   - Migrate images and sizes
   - Generate appropriate SKUs

### Sample Data

Create test data: `node scripts/create-sample-baseSku-products.js`

## API Endpoints

### Product Service

```typescript
// Get product with all color variants
productService.getProductWithColorVariants(baseSku: string)

// Get product by base SKU
productService.getProductByBaseSku(baseSku: string)

// Legacy support
productService.getProductBySku(sku: string)
```

### Color Variant Service

```typescript
// Create color variant
colorVariantService.createColorVariant(variantData);

// Update color variant
colorVariantService.updateColorVariant(id, variantData);

// Delete color variant
colorVariantService.deleteColorVariant(id);

// Manage images
colorVariantService.addColorVariantImage(variantId, imageData);
colorVariantService.updateColorVariantImage(id, imageData);
colorVariantService.deleteColorVariantImage(id);

// Manage sizes
colorVariantService.addColorVariantSize(variantId, sizeData);
colorVariantService.updateColorVariantSize(id, sizeData);
colorVariantService.deleteColorVariantSize(id);
```

## SEO Benefits

### Per-Color SEO

- Each color has its own meta title and description
- Color-specific structured data
- Unique URLs for better indexing
- Color-specific Open Graph images

### Structured Data

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Classic Oxford Shoe - Black",
  "description": "Timeless black oxford shoe...",
  "sku": "OXF-001-black-36",
  "color": "Black",
  "offers": {
    "@type": "Offer",
    "price": "299.99",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  }
}
```

## User Experience

### Color Selection

- Visual color swatches on product cards
- Color picker on product pages
- Smooth navigation between colors
- URL updates when switching colors

### Stock Management

- Real-time stock display per size
- Out-of-stock indicators
- Size-specific availability
- Color-specific stock levels

### Pricing Display

- Clear price hierarchy (base → variant → sale)
- Sale price indicators
- Currency formatting
- Price comparison (original vs sale)

## Best Practices

### URL Structure

- Use descriptive, SEO-friendly color slugs
- Keep base SKUs consistent and meaningful
- Avoid special characters in slugs

### Color Management

- Use consistent color naming
- Provide hex codes for accurate swatches
- Set appropriate meta titles and descriptions

### Stock Management

- Keep stock levels accurate
- Use size-specific SKUs
- Monitor low stock alerts

### Image Management

- Use high-quality, color-accurate images
- Provide multiple angles per color
- Optimize images for web performance

## Troubleshooting

### Common Issues

1. **Migration Problems**

   - Check Firebase permissions
   - Verify existing data structure
   - Run migration in small batches

2. **URL Redirects Not Working**

   - Check Next.js routing configuration
   - Verify base SKU format
   - Ensure default color variant exists

3. **Images Not Loading**

   - Check Firebase Storage permissions
   - Verify image URLs
   - Ensure proper image upload process

4. **Stock Not Updating**
   - Check color variant size configuration
   - Verify stock calculation logic
   - Ensure proper data synchronization

### Debug Tools

- Use browser dev tools to inspect network requests
- Check Firebase console for data structure
- Use Next.js development mode for routing issues
- Monitor console logs for errors

## Future Enhancements

### Planned Features

- Bulk color variant management
- Advanced inventory tracking
- Color variant analytics
- Automated image processing
- Multi-language color names
- Color variant comparison tools

### Performance Optimizations

- Image lazy loading
- Color variant caching
- Database query optimization
- CDN integration for images
