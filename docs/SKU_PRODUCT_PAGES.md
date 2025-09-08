# SKU-Based Product Pages Implementation

This document describes the implementation of SKU-based product pages for the Sako e-commerce website, supporting both English and Hebrew languages.

## Overview

The implementation creates dedicated product pages for every product using the product's SKU as the URL identifier, replacing the previous slug-based system. Each product has two canonical URLs:

- English: `/en/product/<SKU>`
- Hebrew: `/he/product/<SKU>`

Example: SKU `SAK-12345` → `/en/product/SAK-12345` and `/he/product/SAK-12345`

## File Structure

```
app/
├── [lng]/
│   └── product/
│       └── [sku]/
│           ├── page.tsx          # Main product page component
│           └── layout.tsx        # Layout with RTL/LTR support
├── components/
│   └── ProductLanguageSwitcher.tsx  # Language switcher preserving SKU
lib/
└── firebase.ts                   # Updated with getProductBySku method
middleware.ts                     # Handles redirects from old URLs
scripts/
└── test-product-pages.js         # Test suite for validation
```

## Key Features

### 1. SKU-Based Routing

- Products are accessed via their unique SKU instead of human-readable slugs
- URLs are consistent across languages: only the language prefix changes
- SKU serves as the canonical identifier for products

### 2. Bilingual Support

- Full support for English and Hebrew
- RTL (Right-to-Left) layout for Hebrew pages
- Localized content for all text elements
- Language switcher preserves SKU and query parameters

### 3. SEO Optimization

- Dynamic metadata generation with `generateMetadata()`
- Canonical URLs for each language version
- Hreflang tags for language alternatives
- Open Graph and Twitter Card meta tags
- JSON-LD structured data for products

### 4. Analytics Integration

- Product View events on page load
- Add to Cart events with variant information
- Firebase Analytics integration

### 5. Error Handling

- Localized 404 pages for invalid SKUs
- Graceful fallbacks for missing translations
- Proper error states for out-of-stock variants

### 6. URL Redirects

- Middleware handles 301 redirects from old slug-based URLs
- Automatic redirection to SKU-based URLs
- Preserves query parameters during redirects

## Implementation Details

### Product Page Component (`app/[lng]/product/[sku]/page.tsx`)

The main product page component includes:

- **Product Data Fetching**: Uses `getProductBySku()` to fetch product by SKU
- **Variant Management**: Handles size, color, and quantity selection
- **Stock Management**: Shows stock status and disables out-of-stock variants
- **Image Gallery**: Main image with thumbnail navigation
- **Price Display**: Shows current price with sale price if applicable
- **Add to Cart**: Functional cart addition with analytics tracking
- **Language Switcher**: Preserves SKU and variant selections

### Language Switcher (`app/components/ProductLanguageSwitcher.tsx`)

Specialized language switcher that:

- Preserves the SKU in the URL
- Maintains query parameters (size, color, etc.)
- Uses the same language metadata as the main site

### Middleware (`middleware.ts`)

Handles URL redirects by:

- Detecting old slug-based product URLs
- Looking up the product by slug
- Redirecting to the SKU-based URL with 301 status
- Preserving query parameters

### Firebase Service Updates (`lib/firebase.ts`)

Added `getProductBySku()` method that:

- Queries products by SKU field
- Fetches associated category data
- Returns complete product information

## SEO Features

### Metadata Generation

```typescript
export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  // Generates dynamic metadata including:
  // - Title and description
  // - Canonical URLs
  // - Hreflang alternatives
  // - Open Graph tags
  // - Twitter Card tags
  // - Product-specific meta tags
}
```

### Structured Data

JSON-LD structured data includes:

- Product name and description
- SKU and brand information
- Price and availability
- Images and category
- Currency and condition

### Canonical URLs

- Each language version has its own canonical URL
- Hreflang tags link between language versions
- x-default points to English version

## Analytics Events

### Product View Event

```javascript
analytics.logEvent("view_item", {
  currency: product.currency || "USD",
  value: currentPrice,
  items: [
    {
      item_id: product.sku,
      item_name: productName,
      item_category: product.category?.name,
      price: currentPrice,
      quantity: 1,
    },
  ],
});
```

### Add to Cart Event

```javascript
analytics.logEvent("add_to_cart", {
  currency: product.currency || "USD",
  value: currentPrice * quantity,
  items: [
    {
      item_id: product.sku,
      item_name: productName,
      item_category: product.category?.name,
      item_variant: `${selectedSize}-${selectedColor}`,
      price: currentPrice,
      quantity: quantity,
    },
  ],
});
```

## RTL/LTR Support

### Layout Handling

- Dynamic RTL/LTR class application based on language
- Proper text alignment and spacing
- Icon rotation for RTL layouts
- Breadcrumb navigation with correct arrow directions

### CSS Classes

```typescript
const isRTL = lng === 'he'
<div className={`min-h-screen bg-white ${isRTL ? 'rtl' : 'ltr'}`}>
```

## Error Handling

### 404 Page

- Localized error messages
- Proper navigation back to collection
- Consistent with site design

### Missing Translations

- Fallback to English for missing Hebrew translations
- Graceful degradation of content
- Error logging for content fixes

## Testing

Run the test suite to validate implementation:

```bash
node scripts/test-product-pages.js
```

The test suite validates:

- File structure and existence
- Method implementations
- Feature completeness
- URL patterns
- SEO elements
- Analytics integration

## QA Checklist Validation

✅ **URL Structure**: `/en/product/<SKU>` and `/he/product/<SKU>` both render the same product data  
✅ **Language Switching**: Language switcher preserves SKU and switches just the locale  
✅ **Localization**: Breadcrumbs, titles, and all labels are localized and RTL/LTR behaves correctly  
✅ **SEO**: Canonical, hreflang, Open Graph, Twitter, and JSON-LD validate  
✅ **Redirects**: Old/legacy product URLs 301 to SKU URLs  
✅ **Analytics**: Events fire with the correct SKU and values  
✅ **Error Handling**: 404 behaves correctly for unknown SKUs (EN/HE)

## Performance Considerations

- **Image Optimization**: Uses Next.js Image component with lazy loading
- **Client-Side Hydration**: Proper handling of SSR/CSR differences
- **Query Parameter Preservation**: Maintains variant selections in URL
- **Error Boundaries**: Graceful error handling without breaking the page

## Future Enhancements

- **Wishlist Integration**: Add to favorites functionality
- **Product Reviews**: Customer review system
- **Related Products**: Product recommendations
- **Inventory Management**: Real-time stock updates
- **A/B Testing**: Product page optimization

## Maintenance

- **Content Updates**: Use the admin panel to update product information
- **Translation Management**: Ensure all new products have both English and Hebrew content
- **SEO Monitoring**: Regular checks of canonical URLs and structured data
- **Analytics Review**: Monitor product view and cart addition events

This implementation provides a robust, SEO-friendly, and user-friendly product page system that supports the bilingual requirements while maintaining excellent performance and user experience.
