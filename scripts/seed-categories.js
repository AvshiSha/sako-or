// Script to seed default categories for the e-commerce store
// Run this script to add the initial categories

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

// Your Firebase configuration
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

// Default categories for the footwear and accessories store
const defaultCategories = [
  {
    name: 'Boots',
    slug: 'boots',
    description: 'Stylish and comfortable boots for all occasions',
    image: '',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'High Heels',
    slug: 'high-heels',
    description: 'Elegant high heels for formal and special occasions',
    image: '',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Oxfords',
    slug: 'oxfords',
    description: 'Classic oxford shoes for professional and casual wear',
    image: '',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Sneakers',
    slug: 'sneakers',
    description: 'Comfortable and trendy sneakers for everyday wear',
    image: '',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Sandals',
    slug: 'sandals',
    description: 'Light and breathable sandals for warm weather',
    image: '',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Slippers',
    slug: 'slippers',
    description: 'Comfortable slippers for indoor and casual wear',
    image: '',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Coats',
    slug: 'coats',
    description: 'Stylish coats and outerwear for all seasons',
    image: '',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Bags',
    slug: 'bags',
    description: 'Fashionable bags and accessories for every need',
    image: '',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

async function seedCategories() {
  console.log('Starting to seed categories...');
  
  try {
    const categoriesRef = collection(db, 'categories');
    
    for (const category of defaultCategories) {
      console.log(`Adding category: ${category.name}`);
      
      const docRef = await addDoc(categoriesRef, category);
      console.log(`Category "${category.name}" added with ID: ${docRef.id}`);
    }
    
    console.log('✅ All categories have been successfully added!');
    console.log('Categories added:');
    defaultCategories.forEach(cat => {
      console.log(`  - ${cat.name} (${cat.slug})`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
  }
}

// Run the seeding function
seedCategories()
  .then(() => {
    console.log('Seeding completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  }); 