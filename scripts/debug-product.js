/**
 * Debug script to check product data in Firebase
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, limit } = require('firebase/firestore');

// Your Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugProduct(sku) {
  console.log(`🔍 Debugging product with SKU: ${sku}`);
  
  try {
    // Check if product exists by SKU
    console.log('\n1. Checking by SKU...');
    const skuQuery = query(collection(db, 'products'), where('sku', '==', sku), limit(1));
    const skuSnapshot = await getDocs(skuQuery);
    
    if (!skuSnapshot.empty) {
      const product = skuSnapshot.docs[0];
      console.log('✅ Product found by SKU!');
      console.log('Product ID:', product.id);
      console.log('Product data:', JSON.stringify(product.data(), null, 2));
    } else {
      console.log('❌ No product found by SKU');
    }
    
    // Check all products to see what SKUs exist
    console.log('\n2. Checking all products...');
    const allProductsQuery = query(collection(db, 'products'));
    const allProductsSnapshot = await getDocs(allProductsQuery);
    
    console.log(`Total products in database: ${allProductsSnapshot.docs.length}`);
    
    allProductsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\nProduct ${index + 1}:`);
      console.log('  ID:', doc.id);
      console.log('  SKU:', data.sku || 'NO SKU');
      console.log('  Name (EN):', data.name?.en || 'NO NAME');
      console.log('  Name (HE):', data.name?.he || 'NO NAME');
    });
    
  } catch (error) {
    console.error('Error debugging product:', error);
  }
}

// Run the debug
const sku = process.argv[2] || '1234-5678';
debugProduct(sku).then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
}).catch(error => {
  console.error('Debug failed:', error);
  process.exit(1);
});
