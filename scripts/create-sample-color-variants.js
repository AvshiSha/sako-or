/**
 * Script to create sample data for testing the color variant system
 * 
 * This script will:
 * 1. Create a sample base product
 * 2. Create multiple color variants
 * 3. Add images and sizes for each variant
 * 
 * Run with: node scripts/create-sample-color-variants.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, getDoc } = require('firebase/firestore');

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

async function createSampleData() {
  console.log('🚀 Creating sample color variant data...');
  
  try {
    // First, get or create a category
    let categoryId = 'sample-category';
    try {
      const categoryDoc = await getDoc(doc(db, 'categories', categoryId));
      if (!categoryDoc.exists()) {
        await addDoc(collection(db, 'categories'), {
          name: { en: 'Sample Shoes', he: 'נעליים לדוגמה' },
          slug: { en: 'sample-shoes', he: 'נעליים-לדוגמה' },
          description: { en: 'Sample category for testing', he: 'קטגוריה לדוגמה לבדיקה' },
          level: 0,
          isEnabled: true,
          sortOrder: 1,
          path: 'sample-shoes',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log('✅ Created sample category');
      } else {
        console.log('✅ Using existing sample category');
      }
    } catch (error) {
      console.log('⚠️  Category creation failed, using default ID');
    }

    // Create base product
    const baseProductData = {
      name: { en: 'Classic Oxford Shoe', he: 'נעל אוקספורד קלאסית' },
      slug: { en: 'classic-oxford-shoe', he: 'נעל-אוקספורד-קלאסית' },
      description: { 
        en: 'A timeless classic oxford shoe perfect for any formal occasion. Made with premium leather and traditional craftsmanship.',
        he: 'נעל אוקספורד קלאסית נצחית המושלמת לכל אירוע רשמי. עשויה מעור איכותי ואומנות מסורתית.'
      },
      baseSku: 'OXF-001',
      price: 299.99,
      featured: true,
      isNew: false,
      isActive: true,
      categoryId: categoryId,
      tags: ['formal', 'leather', 'oxford'],
      currency: 'USD',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const productRef = await addDoc(collection(db, 'products'), baseProductData);
    const productId = productRef.id;
    console.log('✅ Created base product:', productId);

    // Define color variants
    const colorVariants = [
      {
        colorName: 'Black',
        colorSlug: 'black',
        colorHex: '#000000',
        price: 299.99,
        salePrice: null,
        stock: 50,
        isActive: true,
        metaTitle: 'Classic Oxford Shoe - Black | Sako',
        metaDescription: 'Timeless black oxford shoe made with premium leather. Perfect for formal occasions.',
        sizes: [
          { size: '36', stock: 5, sku: 'OXF-001-black-36' },
          { size: '37', stock: 8, sku: 'OXF-001-black-37' },
          { size: '38', stock: 10, sku: 'OXF-001-black-38' },
          { size: '39', stock: 12, sku: 'OXF-001-black-39' },
          { size: '40', stock: 8, sku: 'OXF-001-black-40' },
          { size: '41', stock: 5, sku: 'OXF-001-black-41' },
          { size: '42', stock: 2, sku: 'OXF-001-black-42' }
        ],
        images: [
          { url: '/images/products/oxford-black-1.jpg', alt: 'Classic Oxford Shoe - Black - Front View', isPrimary: true, order: 0 },
          { url: '/images/products/oxford-black-2.jpg', alt: 'Classic Oxford Shoe - Black - Side View', isPrimary: false, order: 1 },
          { url: '/images/products/oxford-black-3.jpg', alt: 'Classic Oxford Shoe - Black - Detail View', isPrimary: false, order: 2 }
        ]
      },
      {
        colorName: 'Brown',
        colorSlug: 'brown',
        colorHex: '#8B4513',
        price: 299.99,
        salePrice: 249.99, // On sale
        saleStartDate: new Date(),
        saleEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        stock: 35,
        isActive: true,
        metaTitle: 'Classic Oxford Shoe - Brown | Sako',
        metaDescription: 'Elegant brown oxford shoe with premium leather construction. Now on sale!',
        sizes: [
          { size: '36', stock: 3, sku: 'OXF-001-brown-36' },
          { size: '37', stock: 6, sku: 'OXF-001-brown-37' },
          { size: '38', stock: 8, sku: 'OXF-001-brown-38' },
          { size: '39', stock: 10, sku: 'OXF-001-brown-39' },
          { size: '40', stock: 5, sku: 'OXF-001-brown-40' },
          { size: '41', stock: 2, sku: 'OXF-001-brown-41' },
          { size: '42', stock: 1, sku: 'OXF-001-brown-42' }
        ],
        images: [
          { url: '/images/products/oxford-brown-1.jpg', alt: 'Classic Oxford Shoe - Brown - Front View', isPrimary: true, order: 0 },
          { url: '/images/products/oxford-brown-2.jpg', alt: 'Classic Oxford Shoe - Brown - Side View', isPrimary: false, order: 1 },
          { url: '/images/products/oxford-brown-3.jpg', alt: 'Classic Oxford Shoe - Brown - Detail View', isPrimary: false, order: 2 }
        ]
      },
      {
        colorName: 'Navy Blue',
        colorSlug: 'navy-blue',
        colorHex: '#000080',
        price: 319.99, // Higher price for this color
        salePrice: null,
        stock: 25,
        isActive: true,
        metaTitle: 'Classic Oxford Shoe - Navy Blue | Sako',
        metaDescription: 'Sophisticated navy blue oxford shoe. Premium quality with a unique color option.',
        sizes: [
          { size: '36', stock: 2, sku: 'OXF-001-navy-blue-36' },
          { size: '37', stock: 4, sku: 'OXF-001-navy-blue-37' },
          { size: '38', stock: 6, sku: 'OXF-001-navy-blue-38' },
          { size: '39', stock: 7, sku: 'OXF-001-navy-blue-39' },
          { size: '40', stock: 4, sku: 'OXF-001-navy-blue-40' },
          { size: '41', stock: 2, sku: 'OXF-001-navy-blue-41' },
          { size: '42', stock: 0, sku: 'OXF-001-navy-blue-42' } // Out of stock
        ],
        images: [
          { url: '/images/products/oxford-navy-1.jpg', alt: 'Classic Oxford Shoe - Navy Blue - Front View', isPrimary: true, order: 0 },
          { url: '/images/products/oxford-navy-2.jpg', alt: 'Classic Oxford Shoe - Navy Blue - Side View', isPrimary: false, order: 1 }
        ]
      }
    ];

    // Create color variants
    for (const variantData of colorVariants) {
      console.log(`🎨 Creating color variant: ${variantData.colorName}`);
      
      // Create color variant
      const colorVariantData = {
        productId: productId,
        colorName: variantData.colorName,
        colorSlug: variantData.colorSlug,
        colorHex: variantData.colorHex,
        price: variantData.price,
        salePrice: variantData.salePrice,
        saleStartDate: variantData.saleStartDate,
        saleEndDate: variantData.saleEndDate,
        stock: variantData.stock,
        isActive: variantData.isActive,
        metaTitle: variantData.metaTitle,
        metaDescription: variantData.metaDescription,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const variantRef = await addDoc(collection(db, 'colorVariants'), colorVariantData);
      const variantId = variantRef.id;
      console.log(`✅ Created color variant: ${variantId}`);

      // Add images
      for (const imageData of variantData.images) {
        await addDoc(collection(db, 'colorVariantImages'), {
          colorVariantId: variantId,
          url: imageData.url,
          alt: imageData.alt,
          isPrimary: imageData.isPrimary,
          order: imageData.order,
          createdAt: new Date()
        });
      }
      console.log(`📸 Added ${variantData.images.length} images`);

      // Add sizes
      for (const sizeData of variantData.sizes) {
        await addDoc(collection(db, 'colorVariantSizes'), {
          colorVariantId: variantId,
          size: sizeData.size,
          stock: sizeData.stock,
          sku: sizeData.sku,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      console.log(`📏 Added ${variantData.sizes.length} sizes`);
    }

    console.log('\n🎉 Sample data creation completed!');
    console.log('📋 Test URLs:');
    console.log(`   - Black: /en/product/OXF-001/black`);
    console.log(`   - Brown: /en/product/OXF-001/brown`);
    console.log(`   - Navy: /en/product/OXF-001/navy-blue`);
    console.log(`   - Redirect: /en/product/OXF-001 (should redirect to black)`);

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  }
}

// Run the script
createSampleData()
  .then(() => {
    console.log('Sample data script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Sample data script failed:', error);
    process.exit(1);
  });
