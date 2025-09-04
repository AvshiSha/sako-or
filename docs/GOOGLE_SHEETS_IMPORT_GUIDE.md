# Google Sheets to JSON Import Guide

This guide explains how to use Google Sheets to manage your bilingual product data and convert it to JSON for import.

## 📋 Step-by-Step Process

### 1. **Download the CSV Template**

- Download `products-template.csv` from your project root
- This template contains all required fields with sample data

### 2. **Upload to Google Sheets**

1. Go to [Google Sheets](https://sheets.google.com)
2. Click "Blank" to create a new spreadsheet
3. Go to **File → Import**
4. Upload the `products-template.csv` file
5. Choose "Replace spreadsheet" and click "Import data"

### 3. **Update Your Product Data**

Fill in your products using the following columns:

#### **Bilingual Fields (Required)**

- **name_en**: Product name in English
- **name_he**: Product name in Hebrew
- **description_en**: Product description in English
- **description_he**: Product description in Hebrew
- **slug_en**: URL slug in English (auto-generated if empty)
- **slug_he**: URL slug in Hebrew (auto-generated if empty)

#### **Product Information**

- **price**: Product price (number, e.g., 299.99)
- **category**: Product category (e.g., "women", "men")
- **subcategory**: Product subcategory (e.g., "shoes", "boots")
- **sku**: Stock Keeping Unit (must be unique)

#### **Media & Variants**

- **images**: Comma-separated image URLs
  ```
  /images/products/pump-1.jpg,/images/products/pump-2.jpg
  ```
- **sizes**: Comma-separated sizes
  ```
  36,37,38,39,40
  ```
- **colors**: Comma-separated colors
  ```
  Black,Silver,Gold
  ```
- **stockBySize**: Size-specific stock quantities
  ```
  36:10,37:15,38:20,39:15,40:10
  ```

#### **Optional Fields**

- **featured**: TRUE/FALSE (mark as featured product)
- **new**: TRUE/FALSE (mark as new product)
- **salePrice**: Sale price (number, leave empty if no sale)
- **saleStartDate**: Sale start date (YYYY-MM-DD format)
- **saleEndDate**: Sale end date (YYYY-MM-DD format)

### 4. **Export as CSV**

1. In Google Sheets, go to **File → Download → Comma-separated values (.csv)**
2. Save the file (e.g., `my-products.csv`)

### 5. **Convert CSV to JSON**

Run the conversion script:

```bash
node scripts/csv-to-json-converter.js my-products.csv my-products.json
```

This will:

- Convert your CSV to the proper JSON format
- Validate all required fields
- Show a summary of converted products
- Generate a JSON file ready for import

### 6. **Import to Your Website**

1. Go to your admin panel: `/admin/import`
2. Upload the generated JSON file
3. Review the import results
4. Check for any validation errors

## 📝 CSV Template Structure

```csv
name_en,name_he,description_en,description_he,slug_en,slug_he,price,category,subcategory,images,sizes,colors,stockBySize,sku,featured,new,salePrice,saleStartDate,saleEndDate
"Crystal Embellished Pumps","נעלי עקב מעוטרות בקריסטלים","Elegant pumps adorned with crystal embellishments for a touch of luxury.","נעלי עקב אלגנטיות מעוטרות בקריסטלים למגע של יוקרה.","crystal-embellished-pumps","נעלי-עקב-מעוטרות-קריסטלים",299.99,women,shoes,"/images/products/pump-1.jpg,/images/products/pump-2.jpg","36,37,38,39,40","Black,Silver,Gold","36:10,37:15,38:20,39:15,40:10",PUMP-001,TRUE,TRUE,,,
```

## ⚠️ Important Notes

### **Required Fields**

- All bilingual fields (name, description, slug) must have both English and Hebrew values
- SKU must be unique across all products
- Price must be a valid number
- Images, sizes, colors, and stockBySize are required

### **Data Format**

- **Boolean values**: Use `TRUE` or `FALSE` (case-insensitive)
- **Numbers**: Use decimal format (e.g., `299.99`)
- **Dates**: Use YYYY-MM-DD format
- **Comma-separated lists**: No spaces after commas
- **Stock format**: `size:quantity,size:quantity` (e.g., `36:10,37:15`)

### **Hebrew Text**

- Make sure your Hebrew text is properly encoded
- Test with a few products first to ensure Hebrew displays correctly
- Consider using a Hebrew keyboard or copy-paste from a Hebrew text editor

## 🔧 Troubleshooting

### **Common Issues**

1. **"Missing required fields" error**

   - Ensure all bilingual fields have both English and Hebrew values
   - Check that no required fields are empty

2. **"Invalid price" error**

   - Make sure price is a number (e.g., `299.99`, not `$299.99`)
   - Remove any currency symbols

3. **"Duplicate SKU" error**

   - Each product must have a unique SKU
   - Check for duplicate SKUs in your spreadsheet

4. **Hebrew text not displaying correctly**
   - Ensure your CSV file is saved with UTF-8 encoding
   - Test with a small sample first

### **Validation Tips**

- Use the conversion script to validate your data before import
- The script will show detailed error messages for any issues
- Fix errors in Google Sheets and re-export

## 📊 Example Workflow

1. **Create 5 test products** in Google Sheets using the template
2. **Export as CSV** and convert to JSON
3. **Import the JSON** and check results
4. **Verify** that products display correctly in both languages
5. **Scale up** to your full product catalog

## 🎯 Best Practices

- **Start small**: Test with a few products first
- **Use consistent naming**: Follow the same pattern for SKUs and slugs
- **Validate frequently**: Run the conversion script to catch errors early
- **Backup your data**: Keep copies of your Google Sheets and JSON files
- **Test both languages**: Verify Hebrew text displays correctly

## 📞 Support

If you encounter issues:

1. Check the conversion script output for specific error messages
2. Verify your CSV format matches the template exactly
3. Test with a minimal dataset first
4. Check that all required fields are populated

Happy importing! 🚀
