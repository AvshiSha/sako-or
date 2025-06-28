# Sako Admin Dashboard Setup Guide

This guide will help you set up the admin dashboard and connect your Google Sheets products to the website database.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in your project root:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth (for admin authentication)
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# JWT
JWT_SECRET="your-jwt-secret-here"
```

### 3. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Open Prisma Studio to view/edit data
npm run db:studio
```

### 4. Start Development Server

```bash
npm run dev
```

## 📊 Admin Dashboard Features

### Access Admin Panel

- Navigate to `/admin` in your browser
- Currently no authentication required (for development)

### Product Management

- **View Products**: `/admin/products`
- **Add Product**: `/admin/products/new`
- **Edit Product**: `/admin/products/[id]/edit`

### Features Available

- ✅ Create, Read, Update, Delete products
- ✅ Manage product categories
- ✅ Upload product images
- ✅ Set product variants (sizes, colors)
- ✅ Mark products as featured/new
- ✅ Set sale prices and dates
- ✅ Stock management
- ✅ Search and filter products

## 🔄 Google Sheets Integration

### Import from Google Sheets

Your Google Sheets should have the following columns:

| Column        | Type    | Required | Description                                     |
| ------------- | ------- | -------- | ----------------------------------------------- |
| name          | Text    | ✅       | Product name                                    |
| description   | Text    | ✅       | Product description                             |
| price         | Number  | ✅       | Product price                                   |
| category      | Text    | ✅       | Product category                                |
| subcategory   | Text    | ❌       | Product subcategory                             |
| images        | Text    | ✅       | Comma-separated image URLs                      |
| sizes         | Text    | ✅       | Comma-separated sizes (e.g., "36,37,38,39,40")  |
| colors        | Text    | ✅       | Comma-separated colors (e.g., "Black,Red,Blue") |
| stock         | Number  | ✅       | Total stock quantity                            |
| featured      | Boolean | ❌       | Mark as featured                                |
| new           | Boolean | ❌       | Mark as new                                     |
| salePrice     | Number  | ❌       | Sale price                                      |
| saleStartDate | Date    | ❌       | Sale start date                                 |
| saleEndDate   | Date    | ❌       | Sale end date                                   |
| sku           | Text    | ❌       | Stock keeping unit                              |

### Import Process

1. **Export your Google Sheets data** as CSV or JSON
2. **Use the import utility** in `/lib/google-sheets.ts`
3. **Run the import function** to populate your database

Example import usage:

```typescript
import { importFromGoogleSheets } from "@/lib/google-sheets";

const sheetData = [
  {
    name: "Crystal Embellished Pumps",
    description: "Elegant pumps adorned with crystal embellishments",
    price: 299.99,
    category: "women",
    images: "/images/products/pump-1.jpg,/images/products/pump-2.jpg",
    sizes: "36,37,38,39,40",
    colors: "Black,Silver,Gold",
    stock: 50,
    featured: true,
    new: true,
  },
  // ... more products
];

const results = await importFromGoogleSheets(sheetData);
console.log(`Imported ${results.success} products, ${results.errors} errors`);
```

## 🗄️ Database Schema

### Products Table

- `id`: Unique identifier
- `name`: Product name
- `slug`: URL-friendly identifier
- `description`: Product description
- `price`: Regular price
- `salePrice`: Sale price (optional)
- `saleStartDate`: Sale start date (optional)
- `saleEndDate`: Sale end date (optional)
- `sku`: Stock keeping unit (optional)
- `stock`: Total stock quantity
- `featured`: Featured product flag
- `isNew`: New product flag
- `isActive`: Active/inactive status
- `categoryId`: Category reference
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

### Categories Table

- `id`: Unique identifier
- `name`: Category name
- `slug`: URL-friendly identifier
- `description`: Category description
- `image`: Category image URL (optional)

### Product Images Table

- `id`: Unique identifier
- `url`: Image URL
- `alt`: Alt text
- `isPrimary`: Primary image flag
- `order`: Display order
- `productId`: Product reference

### Product Variants Table

- `id`: Unique identifier
- `size`: Size (optional)
- `color`: Color (optional)
- `stock`: Variant stock quantity
- `sku`: Variant SKU (optional)
- `price`: Variant price (optional)
- `productId`: Product reference

## 🔧 API Endpoints

### Products

- `GET /api/products` - Get all products with filtering
- `POST /api/products` - Create new product
- `GET /api/products/[id]` - Get specific product
- `PUT /api/products/[id]` - Update product
- `DELETE /api/products/[id]` - Delete product

### Categories

- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create new category
- `GET /api/categories/[id]` - Get specific category
- `PUT /api/categories/[id]` - Update category
- `DELETE /api/categories/[id]` - Delete category

## 🎨 Frontend Integration

### Update Product Data Source

Replace the static product data in `app/data/products.ts` with API calls:

```typescript
// Instead of importing static data
// import { products } from '../data/products'

// Use API calls
const [products, setProducts] = useState([]);

useEffect(() => {
  fetch("/api/products")
    .then((res) => res.json())
    .then((data) => setProducts(data.products));
}, []);
```

### Update Collection Page

The collection page (`app/collection/page.tsx`) is already set up to work with the new data structure.

## 🔐 Authentication (Future Enhancement)

For production, you'll want to add authentication:

1. **Install NextAuth.js** (already in dependencies)
2. **Configure providers** (Google, GitHub, etc.)
3. **Protect admin routes** with middleware
4. **Add user management** to the admin panel

## 🚀 Deployment

### Database Setup

- **Development**: SQLite (current setup)
- **Production**: PostgreSQL or MySQL

### Environment Variables

Update your production environment variables:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/sako_db"
NEXTAUTH_SECRET="your-production-secret"
NEXTAUTH_URL="https://yourdomain.com"
```

### Build and Deploy

```bash
npm run build
npm start
```

## 📝 Next Steps

1. **Import your Google Sheets data** using the provided utility
2. **Customize the admin interface** to match your brand
3. **Add authentication** for production use
4. **Set up image upload** functionality
5. **Add analytics and reporting** features
6. **Implement inventory management** workflows

## 🆘 Troubleshooting

### Common Issues

1. **Database connection errors**

   - Check your `DATABASE_URL` in `.env.local`
   - Run `npm run db:generate` to regenerate Prisma client

2. **Import errors**

   - Verify your Google Sheets data format
   - Check that all required fields are present
   - Ensure image URLs are accessible

3. **Build errors**
   - Clear `.next` folder: `rm -rf .next`
   - Reinstall dependencies: `rm -rf node_modules && npm install`

### Support

For issues or questions:

1. Check the console for error messages
2. Verify your environment variables
3. Ensure all dependencies are installed
4. Check the Prisma documentation for database issues
