const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, getDoc } = require('firebase/firestore');

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

async function createSampleProducts() {
  try {
    console.log('🚀 Creating sample products with baseSku system...');
    
    // First, get or create a category
    let categoryId;
    try {
      const categoryQuery = await getDocs(collection(db, 'categories'));
      if (!categoryQuery.empty) {
        categoryId = categoryQuery.docs[0].id;
        console.log('📁 Using existing category:', categoryQuery.docs[0].data().name?.en);
      } else {
        // Create a sample category
        const categoryData = {
          name: {
            en: 'Shoes',
            he: 'נעליים'
          },
          slug: {
            en: 'shoes',
            he: 'נעליים'
          },
          description: {
            en: 'High-quality footwear',
            he: 'נעליים איכותיות'
          },
          level: 0,
          isEnabled: true,
          sortOrder: 1,
          path: 'shoes',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const categoryRef = await addDoc(collection(db, 'categories'), categoryData);
        categoryId = categoryRef.id;
        console.log('✅ Created sample category');
      }
    } catch (error) {
      console.error('Error with category:', error);
      return;
    }
    
    // Sample products data
    const sampleProducts = [
      {
        name: {
          en: 'Classic Oxford Shoe',
          he: 'נעל אוקספורד קלאסית'
        },
        slug: {
          en: 'classic-oxford-shoe',
          he: 'נעל-אוקספורד-קלאסית'
        },
        description: {
          en: 'A timeless classic oxford shoe perfect for formal occasions. Made with premium leather and traditional craftsmanship.',
          he: 'נעל אוקספורד קלאסית נצחית המושלמת לאירועים רשמיים. עשויה מעור איכותי ומלאכת יד מסורתית.'
        },
        baseSku: 'OXF-001',
        price: 299.99,
        featured: true,
        isNew: false,
        isActive: true,
        categoryId: categoryId,
        tags: ['formal', 'leather', 'classic'],
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        colorVariants: [
          {
            colorName: 'Black',
            colorSlug: 'black',
            colorHex: '#000000',
            price: 299.99,
            stock: 50,
            isActive: true,
            images: [
              {
                url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800',
                alt: 'Black Oxford Shoe',
                isPrimary: true,
                order: 0
              },
              {
                url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800',
                alt: 'Black Oxford Shoe Side View',
                isPrimary: false,
                order: 1
              }
            ],
            sizes: [
              { size: '36', stock: 5, sku: 'OXF-001-black-36' },
              { size: '37', stock: 8, sku: 'OXF-001-black-37' },
              { size: '38', stock: 12, sku: 'OXF-001-black-38' },
              { size: '39', stock: 10, sku: 'OXF-001-black-39' },
              { size: '40', stock: 8, sku: 'OXF-001-black-40' },
              { size: '41', stock: 7, sku: 'OXF-001-black-41' }
            ]
          },
          {
            colorName: 'Brown',
            colorSlug: 'brown',
            colorHex: '#8B4513',
            price: 299.99,
            stock: 30,
            isActive: true,
            images: [
              {
                url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800',
                alt: 'Brown Oxford Shoe',
                isPrimary: true,
                order: 0
              }
            ],
            sizes: [
              { size: '36', stock: 3, sku: 'OXF-001-brown-36' },
              { size: '37', stock: 5, sku: 'OXF-001-brown-37' },
              { size: '38', stock: 8, sku: 'OXF-001-brown-38' },
              { size: '39', stock: 7, sku: 'OXF-001-brown-39' },
              { size: '40', stock: 4, sku: 'OXF-001-brown-40' },
              { size: '41', stock: 3, sku: 'OXF-001-brown-41' }
            ]
          }
        ]
      },
      {
        name: {
          en: 'Designer Boots',
          he: 'מגפי מעצב'
        },
        slug: {
          en: 'designer-boots',
          he: 'מגפי-מעצב'
        },
        description: {
          en: 'Stylish designer boots for the modern woman. Comfortable and fashionable for any occasion.',
          he: 'מגפי מעצב אופנתיים לאישה המודרנית. נוחים ואופנתיים לכל אירוע.'
        },
        baseSku: 'BOT-002',
        price: 199.99,
        featured: false,
        isNew: true,
        isActive: true,
        categoryId: categoryId,
        tags: ['boots', 'designer', 'fashion'],
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        colorVariants: [
          {
            colorName: 'Black',
            colorSlug: 'black',
            colorHex: '#000000',
            price: 199.99,
            stock: 25,
            isActive: true,
            images: [
              {
                url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800',
                alt: 'Black Designer Boots',
                isPrimary: true,
                order: 0
              }
            ],
            sizes: [
              { size: '36', stock: 2, sku: 'BOT-002-black-36' },
              { size: '37', stock: 4, sku: 'BOT-002-black-37' },
              { size: '38', stock: 6, sku: 'BOT-002-black-38' },
              { size: '39', stock: 5, sku: 'BOT-002-black-39' },
              { size: '40', stock: 4, sku: 'BOT-002-black-40' },
              { size: '41', stock: 4, sku: 'BOT-002-black-41' }
            ]
          },
          {
            colorName: 'Tan',
            colorSlug: 'tan',
            colorHex: '#D2B48C',
            price: 199.99,
            salePrice: 149.99,
            stock: 20,
            isActive: true,
            images: [
              {
                url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800',
                alt: 'Tan Designer Boots',
                isPrimary: true,
                order: 0
              }
            ],
            sizes: [
              { size: '36', stock: 1, sku: 'BOT-002-tan-36' },
              { size: '37', stock: 3, sku: 'BOT-002-tan-37' },
              { size: '38', stock: 5, sku: 'BOT-002-tan-38' },
              { size: '39', stock: 4, sku: 'BOT-002-tan-39' },
              { size: '40', stock: 3, sku: 'BOT-002-tan-40' },
              { size: '41', stock: 4, sku: 'BOT-002-tan-41' }
            ]
          }
        ]
      }
    ];
    
    // Create products and their color variants
    for (const productData of sampleProducts) {
      console.log(`\n📦 Creating product: ${productData.name.en}`);
      
      // Create the base product (without colorVariants array)
      const { colorVariants, ...baseProductData } = productData;
      const productRef = await addDoc(collection(db, 'products'), baseProductData);
      console.log(`✅ Created product with ID: ${productRef.id}`);
      
      // Create color variants
      for (const variantData of colorVariants) {
        console.log(`  🎨 Creating color variant: ${variantData.colorName}`);
        
        // Create color variant (without images and sizes arrays)
        const { images, sizes, ...baseVariantData } = variantData;
        const colorVariantRef = await addDoc(collection(db, 'colorVariants'), {
          ...baseVariantData,
          productId: productRef.id,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`    ✅ Created color variant with ID: ${colorVariantRef.id}`);
        
        // Create variant images
        for (const imageData of images) {
          await addDoc(collection(db, 'colorVariantImages'), {
            ...imageData,
            colorVariantId: colorVariantRef.id,
            createdAt: new Date()
          });
        }
        console.log(`    📸 Added ${images.length} images`);
        
        // Create variant sizes
        for (const sizeData of sizes) {
          await addDoc(collection(db, 'colorVariantSizes'), {
            ...sizeData,
            colorVariantId: colorVariantRef.id,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        console.log(`    📏 Added ${sizes.length} sizes`);
      }
    }
    
    console.log(`\n🎉 Sample products created successfully!`);
    console.log(`\n🔗 Test URLs:`);
    console.log(`   /product/OXF-001/black`);
    console.log(`   /product/OXF-001/brown`);
    console.log(`   /product/BOT-002/black`);
    console.log(`   /product/BOT-002/tan`);
    console.log(`\n📝 Base SKUs:`);
    console.log(`   OXF-001 (Classic Oxford Shoe)`);
    console.log(`   BOT-002 (Designer Boots)`);
    
  } catch (error) {
    console.error('❌ Error creating sample products:', error);
  }
}

// Run the script
createSampleProducts()
  .then(() => {
    console.log('Sample creation script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Sample creation script failed:', error);
    process.exit(1);
  });
