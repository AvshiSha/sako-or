/**
 * Debug script to check product data in Firebase
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, limit } = require('firebase/firestore');

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA6M1iGDwf4iesgujOxqqLlkLddigFonL4",
  authDomain: "sako-or.firebaseapp.com",
  projectId: "sako-or",
  storageBucket: "sako-or.firebasestorage.app",
  messagingSenderId: "492015346123",
  appId: "1:492015346123:web:2da31215f1b7f3212f164e",
  measurementId: "G-WK1B8GCMT0"
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
