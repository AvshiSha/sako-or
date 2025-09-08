/**
 * Test script to check if SKU query is working
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

async function testSkuQuery(sku) {
  console.log(`🔍 Testing SKU query for: "${sku}"`);
  
  try {
    // Test the exact query used in getProductBySku
    const q = query(collection(db, 'products'), where('sku', '==', sku), limit(1));
    const querySnapshot = await getDocs(q);
    
    console.log(`Query returned ${querySnapshot.docs.length} documents`);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      console.log('✅ Product found!');
      console.log('Document ID:', doc.id);
      console.log('SKU field:', JSON.stringify(data.sku));
      console.log('Name (EN):', data.name?.en);
      console.log('Name (HE):', data.name?.he);
      console.log('Price:', data.price);
      console.log('Stock:', data.stock);
    } else {
      console.log('❌ No product found with that SKU');
      
      // Let's check what products actually exist
      console.log('\n🔍 Checking all products in database...');
      const allProductsQuery = query(collection(db, 'products'));
      const allProductsSnapshot = await getDocs(allProductsQuery);
      
      console.log(`Total products: ${allProductsSnapshot.docs.length}`);
      
      allProductsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\nProduct ${index + 1}:`);
        console.log('  ID:', doc.id);
        console.log('  SKU:', JSON.stringify(data.sku));
        console.log('  Name (EN):', data.name?.en);
        console.log('  Name (HE):', data.name?.he);
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing SKU query:', error);
  }
}

// Run the test
const sku = process.argv[2] || '1234-5678';
testSkuQuery(sku).then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
