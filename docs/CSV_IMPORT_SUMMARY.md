# CSV Import System - Complete Setup

## 📁 Files Created

### **Templates & Scripts**

- `products-template.csv` - CSV template for Google Sheets
- `scripts/csv-to-json-converter.js` - Main conversion script
- `scripts/convert-csv.bat` - Windows batch script
- `scripts/convert-csv.sh` - Mac/Linux shell script

### **Documentation**

- `docs/GOOGLE_SHEETS_IMPORT_GUIDE.md` - Complete usage guide
- `docs/CSV_IMPORT_SUMMARY.md` - This summary

## 🚀 Quick Start

### **For Windows Users:**

1. Download `products-template.csv`
2. Upload to Google Sheets and fill in your products
3. Export as CSV from Google Sheets
4. Run: `scripts\convert-csv.bat my-products.csv my-products.json`
5. Import the JSON file through `/admin/import`

### **For Mac/Linux Users:**

1. Download `products-template.csv`
2. Upload to Google Sheets and fill in your products
3. Export as CSV from Google Sheets
4. Run: `./scripts/convert-csv.sh my-products.csv my-products.json`
5. Import the JSON file through `/admin/import`

### **For All Users (Node.js):**

```bash
node scripts/csv-to-json-converter.js input.csv output.json
```

## 📋 CSV Template Structure

The CSV template includes these columns:

| Column           | Description                  | Required | Example                           |
| ---------------- | ---------------------------- | -------- | --------------------------------- |
| `name_en`        | Product name (English)       | ✅       | "Crystal Embellished Pumps"       |
| `name_he`        | Product name (Hebrew)        | ✅       | "נעלי עקב מעוטרות בקריסטלים"      |
| `description_en` | Description (English)        | ✅       | "Elegant pumps adorned with..."   |
| `description_he` | Description (Hebrew)         | ✅       | "נעלי עקב אלגנטיות מעוטרות..."    |
| `slug_en`        | URL slug (English)           | ✅       | "crystal-embellished-pumps"       |
| `slug_he`        | URL slug (Hebrew)            | ✅       | "נעלי-עקב-מעוטרות-קריסטלים"       |
| `price`          | Product price                | ✅       | 299.99                            |
| `category`       | Product category             | ✅       | "women"                           |
| `subcategory`    | Product subcategory          | ✅       | "shoes"                           |
| `images`         | Image URLs (comma-separated) | ✅       | "/img/pump-1.jpg,/img/pump-2.jpg" |
| `sizes`          | Available sizes              | ✅       | "36,37,38,39,40"                  |
| `colors`         | Available colors             | ✅       | "Black,Silver,Gold"               |
| `stockBySize`    | Stock by size                | ✅       | "36:10,37:15,38:20,39:15,40:10"   |
| `sku`            | Stock Keeping Unit           | ✅       | "PUMP-001"                        |
| `featured`       | Featured product             | ❌       | TRUE/FALSE                        |
| `new`            | New product                  | ❌       | TRUE/FALSE                        |
| `salePrice`      | Sale price                   | ❌       | 199.99                            |
| `saleStartDate`  | Sale start date              | ❌       | 2024-01-01                        |
| `saleEndDate`    | Sale end date                | ❌       | 2024-12-31                        |

## ✅ Validation Features

The conversion script automatically:

- ✅ Validates all required fields
- ✅ Checks for duplicate SKUs
- ✅ Ensures proper data types
- ✅ Provides detailed error messages
- ✅ Shows conversion summary
- ✅ Handles Hebrew text properly

## 🎯 Example Workflow

1. **Download template**: `products-template.csv`
2. **Open in Google Sheets**: Upload and start editing
3. **Add your products**: Fill in all required fields
4. **Export as CSV**: Download from Google Sheets
5. **Convert to JSON**: Run the conversion script
6. **Import to website**: Use the admin import page
7. **Verify results**: Check both English and Hebrew sites

## 🔧 Troubleshooting

### **Common Issues:**

- **Missing Hebrew text**: Ensure CSV is UTF-8 encoded
- **Invalid price**: Use numbers only (299.99, not $299.99)
- **Duplicate SKU**: Each product needs unique SKU
- **Missing fields**: All bilingual fields need both languages

### **Getting Help:**

1. Check the conversion script output for specific errors
2. Verify your CSV matches the template format
3. Test with a small sample first
4. Review the detailed guide in `docs/GOOGLE_SHEETS_IMPORT_GUIDE.md`

## 🎉 Benefits

- **Easy editing**: Use familiar Google Sheets interface
- **Collaborative**: Multiple people can edit the same sheet
- **Validation**: Automatic error checking before import
- **Bilingual**: Full support for English and Hebrew
- **Scalable**: Handle hundreds of products efficiently
- **Flexible**: Easy to add new fields or modify existing ones

Your bilingual product import system is now ready to use! 🚀
