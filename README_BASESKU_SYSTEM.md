# BaseSku Color Variant System

## 🎯 Overview

The BaseSku Color Variant System allows each product color to have its own dedicated URL while keeping all colors of the same product connected together. This provides better SEO, shareable URLs, and improved user experience.

## 🚀 Quick Start

### 1. Create Sample Data

```bash
node scripts/create-sample-baseSku-products.js
```

### 2. Test the URLs

Visit these URLs in your browser:

- `/product/OXF-001/black` - Black Oxford Shoe
- `/product/OXF-001/brown` - Brown Oxford Shoe
- `/product/BOT-002/black` - Black Designer Boots
- `/product/BOT-002/tan` - Tan Designer Boots (on sale!)

### 3. Migrate Existing Data (if needed)

```bash
node scripts/migrate-to-baseSku.js
```

## 🔗 URL Structure

### New Format

- **Color-specific**: `/product/{baseSku}/{colorSlug}`
- **Base redirect**: `/product/{baseSku}` → redirects to default color

### Examples

```
✅ /product/OXF-001/black    (Black Oxford Shoe)
✅ /product/OXF-001/brown    (Brown Oxford Shoe)
✅ /product/OXF-001          (Redirects to default color)
```

## 🗄️ Database Structure

### Collections

- **`products`** - Base product information
- **`colorVariants`** - Color-specific data
- **`colorVariantImages`** - Images per color
- **`colorVariantSizes`** - Sizes and stock per color

### Key Fields

- **`baseSku`** - Unique identifier for product family (e.g., "OXF-001")
- **`colorSlug`** - URL-friendly color identifier (e.g., "black", "brown")
- **`sku`** - Full SKU for size/color combination (e.g., "OXF-001-black-36")

## 🎨 Features

### Color Navigation

- Visual color picker on product pages
- Clicking colors navigates to color-specific URLs
- Color swatches on product cards

### Stock Management

- Stock tracked per color and size
- Real-time availability display
- Size-specific SKUs

### SEO Benefits

- Each color has its own URL and meta data
- Color-specific structured data
- Better search engine indexing

## 🛠️ Development

### File Structure

```
app/[lng]/product/
├── [baseSku]/
│   ├── page.tsx              # Redirect to default color
│   ├── layout.tsx            # Layout for base product
│   └── [colorSlug]/
│       ├── page.tsx          # Color-specific product page
│       └── layout.tsx        # Layout for color variant
```

### Key Components

- **ProductCard** - Shows default variant with color swatches
- **ProductColorPage** - Full color-specific product page
- **ProductRedirectPage** - Handles base SKU redirects

## 📊 Analytics

The system tracks:

- **Product Views** - Per color variant
- **Add to Cart** - With size/color details
- **Color Navigation** - User behavior

## 🔧 Admin Panel

### Color Variant Management

- Add/edit/delete color variants
- Manage variant images and sizes
- Set pricing and stock per color
- Enable/disable variants

### Bulk Operations

- Upload multiple images per color
- Set stock levels per size
- Configure sale prices and periods

## 🚨 Migration Notes

### From Old System

1. Run `node scripts/migrate-to-baseSku.js`
2. All existing products get a `baseSku` field
3. Color variants are created automatically
4. Images and sizes are migrated

### URL Changes

- Old: `/product/legacy-sku`
- New: `/product/baseSku/colorSlug`

## 🎯 Benefits

### For Users

- Shareable color-specific URLs
- Better product discovery
- Clear color selection
- Accurate stock information

### For SEO

- Unique URLs per color
- Color-specific meta data
- Better search rankings
- Structured data per variant

### For Business

- Better analytics tracking
- Improved conversion rates
- Easier inventory management
- Enhanced user experience

## 🔍 Testing

### Manual Testing

1. Create sample data
2. Visit color-specific URLs
3. Test color navigation
4. Verify stock display
5. Check add to cart functionality

### URL Testing

```bash
# Test these URLs after creating sample data
curl http://localhost:3000/product/OXF-001/black
curl http://localhost:3000/product/OXF-001/brown
curl http://localhost:3000/product/BOT-002/tan
```

## 📝 Next Steps

1. **Run Migration** - Convert existing products
2. **Create Sample Data** - Test the system
3. **Update Admin Panel** - Add color variant management
4. **Test URLs** - Verify all functionality
5. **Deploy** - Go live with the new system

## 🆘 Troubleshooting

### Common Issues

- **Routing conflicts** - Ensure only baseSku routes exist
- **Missing variants** - Check color variant creation
- **Image loading** - Verify Firebase Storage permissions
- **Stock display** - Check size/stock configuration

### Debug Tools

- Check browser console for errors
- Verify Firebase data structure
- Test API endpoints directly
- Monitor network requests

---

**Ready to go live!** 🚀 Each product color now has its own dedicated, shareable URL while maintaining the connection between all colors of the same product family.
