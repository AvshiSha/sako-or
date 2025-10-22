# Sako OR E-commerce Platform

A modern, multilingual e-commerce platform built with Next.js, Firebase, and TypeScript.

## Features

- 🌐 Multilingual support (English/Hebrew)
- 🛍️ Product catalog with color variants
- 🛒 Shopping cart and favorites
- 📱 Responsive design
- 🔐 Admin dashboard
- 🚀 Firebase integration
- ✅ Color variant active/inactive control

## Color Variant Management

The platform now supports individual color variant activation control:

- **Active Color Variants**: Only active color variants are displayed to customers
- **Inactive Color Variants**: Hidden from customer-facing pages but preserved in admin
- **Admin Control**: Toggle color variant status in the product edit page
- **Backward Compatibility**: Existing products default to active status

### Implementation Details

- Added `isActive` boolean field to color variant schema
- Frontend filtering ensures inactive variants are hidden
- Admin interface allows toggling variant status
- Migration script updates existing products

## License

This project is private and proprietary.
