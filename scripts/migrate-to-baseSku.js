const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, addDoc, query, where } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateProductsToBaseSku() {
  try {
    console.log('🚀 Starting migration to baseSku system...');
    
    // Get all existing products
    const productsSnapshot = await getDocs(collection(db, 'products'));
    console.log(`📦 Found ${productsSnapshot.docs.length} products to migrate`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const productDoc of productsSnapshot.docs) {
      const productData = productDoc.data();
      const productId = productDoc.id;
      
      console.log(`\n🔄 Processing product: ${productData.name?.en || 'Unknown'}`);
      
      // Check if product already has baseSku
      if (productData.baseSku) {
        console.log('✅ Product already has baseSku, skipping...');
        skippedCount++;
        continue;
      }
      
      // Generate baseSku from existing sku or create new one
      let baseSku = productData.sku;
      if (!baseSku) {
        // Generate a baseSku from product name
        const nameSlug = (productData.name?.en || 'product')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        baseSku = `${nameSlug}-${Date.now().toString().slice(-4)}`;
        console.log(`📝 Generated new baseSku: ${baseSku}`);
      }
      
      // Update product with baseSku
      await updateDoc(doc(db, 'products', productId), {
        baseSku: baseSku,
        updatedAt: new Date()
      });
      
      console.log(`✅ Updated product with baseSku: ${baseSku}`);
      migratedCount++;
      
      // If product has colors, create color variants
      if (productData.colors && productData.colors.length > 0) {
        console.log(`🎨 Creating color variants for ${productData.colors.length} colors...`);
        
        for (let i = 0; i < productData.colors.length; i++) {
          const color = productData.colors[i];
          const colorSlug = color.toLowerCase().replace(/[^a-z0-9]/g, '-');
          
          // Create color variant
          const colorVariantData = {
            productId: productId,
            colorName: color,
            colorSlug: colorSlug,
            colorHex: getColorHex(color),
            price: productData.price,
            salePrice: productData.salePrice,
            saleStartDate: productData.saleStartDate,
            saleEndDate: productData.saleEndDate,
            stock: productData.stock || 0,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const colorVariantRef = await addDoc(collection(db, 'colorVariants'), colorVariantData);
          console.log(`  ✅ Created color variant: ${color} (${colorSlug})`);
          
          // Create color variant images (copy from product images)
          if (productData.images && productData.images.length > 0) {
            for (let j = 0; j < productData.images.length; j++) {
              const image = productData.images[j];
              await addDoc(collection(db, 'colorVariantImages'), {
                colorVariantId: colorVariantRef.id,
                url: image.url,
                alt: image.alt || `${productData.name?.en} - ${color}`,
                isPrimary: j === 0,
                order: j,
                createdAt: new Date()
              });
            }
            console.log(`  📸 Added ${productData.images.length} images to color variant`);
          }
          
          // Create color variant sizes
          if (productData.sizes && productData.sizes.length > 0) {
            for (const size of productData.sizes) {
              const sizeStock = productData.stockBySize?.[size] || Math.floor((productData.stock || 0) / productData.sizes.length);
              const sizeSku = `${baseSku}-${colorSlug}-${size}`;
              
              await addDoc(collection(db, 'colorVariantSizes'), {
                colorVariantId: colorVariantRef.id,
                size: size,
                stock: sizeStock,
                sku: sizeSku,
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
            console.log(`  📏 Added ${productData.sizes.length} sizes to color variant`);
          }
        }
      } else {
        // Create a default color variant for products without colors
        console.log('🎨 Creating default color variant...');
        
        const colorVariantData = {
          productId: productId,
          colorName: 'Default',
          colorSlug: 'default',
          colorHex: '#000000',
          price: productData.price,
          salePrice: productData.salePrice,
          saleStartDate: productData.saleStartDate,
          saleEndDate: productData.saleEndDate,
          stock: productData.stock || 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const colorVariantRef = await addDoc(collection(db, 'colorVariants'), colorVariantData);
        console.log('  ✅ Created default color variant');
        
        // Copy images
        if (productData.images && productData.images.length > 0) {
          for (let j = 0; j < productData.images.length; j++) {
            const image = productData.images[j];
            await addDoc(collection(db, 'colorVariantImages'), {
              colorVariantId: colorVariantRef.id,
              url: image.url,
              alt: image.alt || productData.name?.en,
              isPrimary: j === 0,
              order: j,
              createdAt: new Date()
            });
          }
          console.log(`  📸 Added ${productData.images.length} images to default variant`);
        }
        
        // Copy sizes
        if (productData.sizes && productData.sizes.length > 0) {
          for (const size of productData.sizes) {
            const sizeStock = productData.stockBySize?.[size] || Math.floor((productData.stock || 0) / productData.sizes.length);
            const sizeSku = `${baseSku}-default-${size}`;
            
            await addDoc(collection(db, 'colorVariantSizes'), {
              colorVariantId: colorVariantRef.id,
              size: size,
              stock: sizeStock,
              sku: sizeSku,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
          console.log(`  📏 Added ${productData.sizes.length} sizes to default variant`);
        }
      }
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Migrated: ${migratedCount} products`);
    console.log(`⏭️  Skipped: ${skippedCount} products (already migrated)`);
    console.log(`\n🔗 New URL format: /product/{baseSku}/{colorSlug}`);
    console.log(`📝 Example: /product/OXF-001/black`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Helper function to get color hex codes
function getColorHex(colorName) {
  const colorMap = {
    'black': '#000000',
    'white': '#FFFFFF',
    'red': '#FF0000',
    'blue': '#0000FF',
    'green': '#008000',
    'yellow': '#FFFF00',
    'brown': '#A52A2A',
    'gray': '#808080',
    'grey': '#808080',
    'navy': '#000080',
    'beige': '#F5F5DC',
    'tan': '#D2B48C',
    'cream': '#FFFDD0',
    'pink': '#FFC0CB',
    'purple': '#800080',
    'orange': '#FFA500',
    'gold': '#FFD700',
    'silver': '#C0C0C0'
  };
  
  return colorMap[colorName.toLowerCase()] || '#000000';
}

// Run migration
migrateProductsToBaseSku()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
