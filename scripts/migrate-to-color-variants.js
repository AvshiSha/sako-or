/**
 * Migration script to convert existing products to the new color variant system
 * 
 * This script will:
 * 1. Convert existing products to base products with baseSku
 * 2. Create color variants for each color
 * 3. Create color variant images
 * 4. Create color variant sizes
 * 
 * Run with: node scripts/migrate-to-color-variants.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, updateDoc, doc, query, where } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA6M1iGDwf4iesgujOxqqLlkLddigFonL4",
  authDomain: "sako-or.firebaseapp.com",
  projectId: "sako-or",
  storageBucket: "sako-or.firebasestorage.app",
  messagingSenderId: "492015346123",
  appId: "1:492015346123:web:2da31215f1b7f3212f164e",
  measurementId: "G-WK1B8GCMT0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper function to generate color slug
function generateColorSlug(colorName) {
  return colorName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

// Helper function to generate base SKU from existing SKU
function generateBaseSku(existingSku) {
  if (!existingSku) return null;
  
  // If SKU already looks like a base SKU (e.g., "0000-0000"), use it
  if (/^\d{4}-\d{4}$/.test(existingSku)) {
    return existingSku;
  }
  
  // Extract base part (remove size/color suffixes)
  // Example: "SHOE-001-BLK-36" -> "SHOE-001"
  const parts = existingSku.split('-');
  if (parts.length >= 2) {
    return parts.slice(0, 2).join('-');
  }
  
  return existingSku;
}

async function migrateProducts() {
  console.log('🚀 Starting product migration to color variant system...');
  
  try {
    // Get all existing products
    const productsSnapshot = await getDocs(collection(db, 'products'));
    console.log(`📦 Found ${productsSnapshot.docs.length} products to migrate`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const productDoc of productsSnapshot.docs) {
      try {
        const productData = productDoc.data();
        const productId = productDoc.id;
        
        console.log(`\n🔄 Migrating product: ${productData.name?.en || 'Unknown'}`);
        
        // Skip if already migrated (has baseSku)
        if (productData.baseSku) {
          console.log('⏭️  Product already migrated, skipping...');
          continue;
        }
        
        // Generate base SKU
        const baseSku = generateBaseSku(productData.sku);
        if (!baseSku) {
          console.log('❌ No valid SKU found, skipping...');
          errorCount++;
          continue;
        }
        
        // Update product with baseSku
        await updateDoc(doc(db, 'products', productId), {
          baseSku: baseSku,
          updatedAt: new Date()
        });
        
        console.log(`✅ Updated product with baseSku: ${baseSku}`);
        
        // Get colors and sizes from existing data
        const colors = productData.colors || [];
        const sizes = productData.sizes || [];
        const images = productData.images || [];
        
        if (colors.length === 0) {
          console.log('⚠️  No colors found, creating default color variant...');
          colors.push('Default');
        }
        
        // Create color variants
        for (const color of colors) {
          const colorSlug = generateColorSlug(color);
          
          console.log(`🎨 Creating color variant: ${color} (${colorSlug})`);
          
          // Create color variant
          const colorVariantData = {
            productId: productId,
            colorName: color,
            colorSlug: colorSlug,
            colorHex: null, // Can be set manually later
            price: productData.price, // Use base product price
            salePrice: productData.salePrice || null,
            saleStartDate: productData.saleStartDate || null,
            saleEndDate: productData.saleEndDate || null,
            stock: productData.stock || 0,
            isActive: productData.isActive !== false,
            metaTitle: null,
            metaDescription: null,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const colorVariantRef = await addDoc(collection(db, 'colorVariants'), colorVariantData);
          const colorVariantId = colorVariantRef.id;
          
          console.log(`✅ Created color variant: ${colorVariantId}`);
          
          // Create color variant images (copy from base product)
          for (let i = 0; i < images.length; i++) {
            const image = images[i];
            const imageData = {
              colorVariantId: colorVariantId,
              url: image.url,
              alt: image.alt || `${productData.name?.en || 'Product'} - ${color}`,
              isPrimary: i === 0,
              order: i,
              createdAt: new Date()
            };
            
            await addDoc(collection(db, 'colorVariantImages'), imageData);
          }
          
          console.log(`📸 Created ${images.length} images for color variant`);
          
          // Create color variant sizes
          for (const size of sizes) {
            // Calculate stock per size
            let sizeStock = 0;
            if (productData.stockBySize && productData.stockBySize[size]) {
              sizeStock = productData.stockBySize[size];
            } else if (productData.stock && sizes.length > 0) {
              sizeStock = Math.floor(productData.stock / sizes.length);
            }
            
            // Generate full SKU for this size/color combination
            const fullSku = `${baseSku}-${colorSlug}-${size}`;
            
            const sizeData = {
              colorVariantId: colorVariantId,
              size: size,
              stock: sizeStock,
              sku: fullSku,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            await addDoc(collection(db, 'colorVariantSizes'), sizeData);
          }
          
          console.log(`📏 Created ${sizes.length} sizes for color variant`);
        }
        
        migratedCount++;
        console.log(`✅ Successfully migrated product: ${productData.name?.en}`);
        
      } catch (error) {
        console.error(`❌ Error migrating product ${productDoc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Successfully migrated: ${migratedCount} products`);
    console.log(`❌ Errors: ${errorCount} products`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration
migrateProducts()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
