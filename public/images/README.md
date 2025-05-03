# Image Assets

This directory contains all image assets for the SAKO website. Images are organized into the following categories:

## Directory Structure

- `/hero` - Main hero section images

  - Recommended size: 1920x1080px
  - Format: WebP or JPG
  - Max file size: 500KB

- `/products` - Product images

  - Recommended size: 800x800px
  - Format: WebP or JPG
  - Max file size: 200KB per image
  - Naming convention: product-name.jpg

- `/collections` - Collection showcase images

  - Recommended size: 1200x800px
  - Format: WebP or JPG
  - Max file size: 300KB

- `/icons` - Icon images
  - Recommended size: 24x24px or 32x32px
  - Format: SVG or PNG
  - Max file size: 50KB

## Usage in Next.js Components

```typescript
import Image from "next/image";

// Example usage
<Image
  src="/images/products/example.jpg"
  alt="Product description"
  width={800}
  height={800}
  priority={true} // Use for above-the-fold images
/>;
```

## Best Practices

1. Always provide meaningful alt text for accessibility
2. Use appropriate image sizes to optimize loading
3. Consider using the `priority` prop for above-the-fold images
4. Use WebP format when possible for better compression
5. Keep file sizes as small as possible while maintaining quality
6. Use descriptive filenames that reflect the content

## Image Optimization

Next.js automatically optimizes images. However, you should:

- Pre-optimize images before uploading
- Use appropriate dimensions
- Consider using the `quality` prop for JPG images
- Use the `placeholder` prop for blur-up loading
