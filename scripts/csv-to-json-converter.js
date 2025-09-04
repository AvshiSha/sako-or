/**
 * CSV to JSON Converter for Bilingual Product Import
 * 
 * This script converts a CSV file (exported from Google Sheets) 
 * to the JSON format required by the import system.
 * 
 * Usage:
 * 1. Create/update your products in Google Sheets using the CSV template
 * 2. Export as CSV from Google Sheets
 * 3. Run: node scripts/csv-to-json-converter.js input.csv output.json
 * 4. Import the generated JSON file through the admin interface
 */

const fs = require('fs');
const path = require('path');

function csvToJson(csvFilePath, outputFilePath) {
  try {
    // Read CSV file
    const csvContent = fs.readFileSync(csvFilePath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }

    // Parse header
    const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
    
    // Parse data rows
    const products = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1}: Column count mismatch. Expected ${headers.length}, got ${values.length}`);
        continue;
      }

      // Create product object
      const product = {};
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const value = values[j].trim().replace(/"/g, '');
        
        // Handle bilingual fields
        if (header === 'name_en') {
          if (!product.name) product.name = {};
          product.name.en = value;
        } else if (header === 'name_he') {
          if (!product.name) product.name = {};
          product.name.he = value;
        } else if (header === 'description_en') {
          if (!product.description) product.description = {};
          product.description.en = value;
        } else if (header === 'description_he') {
          if (!product.description) product.description = {};
          product.description.he = value;
        } else if (header === 'slug_en') {
          if (!product.slug) product.slug = {};
          product.slug.en = value;
        } else if (header === 'slug_he') {
          if (!product.slug) product.slug = {};
          product.slug.he = value;
        } else if (header === 'price') {
          product.price = parseFloat(value) || 0;
        } else if (header === 'salePrice') {
          product.salePrice = value ? parseFloat(value) : null;
        } else if (header === 'featured') {
          product.featured = value.toLowerCase() === 'true';
        } else if (header === 'new') {
          product.new = value.toLowerCase() === 'true';
        } else {
          // Handle other fields directly
          product[header] = value;
        }
      }

      // Validate required fields
      const errors = validateProduct(product, i + 1);
      if (errors.length > 0) {
        console.warn(`Row ${i + 1} validation errors:`, errors);
        continue;
      }

      products.push(product);
    }

    // Write JSON file
    fs.writeFileSync(outputFilePath, JSON.stringify(products, null, 2));
    
    console.log(`✅ Successfully converted ${products.length} products from CSV to JSON`);
    console.log(`📁 Output file: ${outputFilePath}`);
    
    // Display summary
    console.log('\n📊 Conversion Summary:');
    console.log(`- Total products: ${products.length}`);
    console.log(`- Featured products: ${products.filter(p => p.featured).length}`);
    console.log(`- New products: ${products.filter(p => p.new).length}`);
    console.log(`- Products on sale: ${products.filter(p => p.salePrice).length}`);
    
    return products;
    
  } catch (error) {
    console.error('❌ Error converting CSV to JSON:', error.message);
    process.exit(1);
  }
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current);
  return values;
}

function validateProduct(product, rowNumber) {
  const errors = [];
  
  // Check required bilingual fields
  if (!product.name || !product.name.en || !product.name.he) {
    errors.push('Missing name (both en and he required)');
  }
  
  if (!product.description || !product.description.en || !product.description.he) {
    errors.push('Missing description (both en and he required)');
  }
  
  if (!product.slug || !product.slug.en || !product.slug.he) {
    errors.push('Missing slug (both en and he required)');
  }
  
  // Check other required fields
  if (!product.price || isNaN(product.price)) {
    errors.push('Invalid price');
  }
  
  if (!product.category) {
    errors.push('Missing category');
  }
  
  if (!product.images) {
    errors.push('Missing images');
  }
  
  if (!product.sizes) {
    errors.push('Missing sizes');
  }
  
  if (!product.colors) {
    errors.push('Missing colors');
  }
  
  if (!product.stockBySize) {
    errors.push('Missing stockBySize');
  }
  
  if (!product.sku) {
    errors.push('Missing SKU');
  }
  
  return errors;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node csv-to-json-converter.js <input.csv> <output.json>');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/csv-to-json-converter.js products.csv products.json');
    process.exit(1);
  }
  
  const inputFile = args[0];
  const outputFile = args[1];
  
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Input file not found: ${inputFile}`);
    process.exit(1);
  }
  
  csvToJson(inputFile, outputFile);
}

module.exports = { csvToJson, validateProduct };
