// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, Query } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// Your web app's Firebase configuration
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

// Initialize analytics only on client side
let analytics: any = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn('Analytics initialization failed:', error);
  }
}

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Export Firebase instances
export { app, analytics, db, auth, storage };

// Types
export interface Product {
  id?: string;
  // Bilingual fields
  name: {
    en: string;
    he: string;
  };
  slug: {
    en: string;
    he: string;
  };
  description: {
    en: string;
    he: string;
  };
  // Non-language-specific fields
  price: number;
  salePrice?: number;
  saleStartDate?: Date;
  saleEndDate?: Date;
  sku?: string;
  stock: number;
  featured: boolean;
  isNew: boolean;
  isActive: boolean;
  categoryId: string;
  categorySlug?: string;
  category?: Category;
  images: ProductImage[];
  variants: ProductVariant[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  colors?: string[];
  sizes?: string[];
  currency?: string;
  stockBySize?: Record<string, number>; // Stock quantity for each size
}

export interface Category {
  id?: string;
  name: {
    en: string;
    he: string;
  };
  slug: {
    en: string;
    he: string;
  };
  description?: {
    en: string;
    he: string;
  };
  image?: string;
  parentId?: string; // For sub-categories and sub-sub-categories
  level: number; // 0 = main, 1 = sub, 2 = sub-sub
  isEnabled: boolean; // Enable/disable toggle
  sortOrder: number; // For ordering within the same level
  path: string; // Full path like "women/shoes/heels"
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductImage {
  id?: string;
  url: string;
  alt?: {
    en: string;
    he: string;
  };
  isPrimary: boolean;
  order: number;
  createdAt: Date;
}

export interface ProductVariant {
  id?: string;
  size?: string;
  color?: string;
  stock: number;
  sku?: string;
  price?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppUser {
  id?: string;
  email: string;
  name?: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

export interface NewsletterEmail {
  id?: string;
  email: string;
  subscribedAt: Date;
  isActive: boolean;
}

// Helper functions for bilingual products
export const productHelpers = {
  // Get product field in specific language
  getField: (product: Product, field: 'name' | 'description' | 'slug', language: 'en' | 'he'): string => {
    return product[field][language] || product[field].en || '';
  },

  // Get product image alt text in specific language
  getImageAlt: (image: ProductImage, language: 'en' | 'he'): string => {
    if (!image.alt) return '';
    return image.alt[language] || image.alt.en || '';
  },

  // Generate slug from text
  generateSlug: (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();
  },

  // Validate bilingual product data
  validateBilingualProduct: (product: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check required bilingual fields
    if (!product.name || typeof product.name !== 'object') {
      errors.push('Product name must be an object with en and he properties');
    } else {
      if (!product.name.en || product.name.en.trim() === '') {
        errors.push('English name is required');
      }
      if (!product.name.he || product.name.he.trim() === '') {
        errors.push('Hebrew name is required');
      }
    }

    if (!product.description || typeof product.description !== 'object') {
      errors.push('Product description must be an object with en and he properties');
    } else {
      if (!product.description.en || product.description.en.trim() === '') {
        errors.push('English description is required');
      }
      if (!product.description.he || product.description.he.trim() === '') {
        errors.push('Hebrew description is required');
      }
    }

    // Check slugs (can be auto-generated if missing)
    if (!product.slug || typeof product.slug !== 'object') {
      // Slugs can be auto-generated, so this is not a critical error
      console.log('Slug will be auto-generated for product:', product.name?.en);
    } else {
      if (!product.slug.en || product.slug.en.trim() === '') {
        console.log('English slug will be auto-generated for product:', product.name?.en);
      }
      if (!product.slug.he || product.slug.he.trim() === '') {
        console.log('Hebrew slug will be auto-generated for product:', product.name?.en);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// Product Services
export const productService = {
  // Get all products
  async getAllProducts(filters?: {
    category?: string;
    featured?: boolean;
    isNew?: boolean;
    isActive?: boolean;
    limit?: number;
  }): Promise<Product[]> {
    try {
      let q: Query = collection(db, 'products');
      const constraints: any[] = []; // TODO: Fix type
      
      if (filters?.category) {
        constraints.push(where('categoryId', '==', filters.category));
      }
      if (filters?.featured !== undefined) {
        constraints.push(where('featured', '==', filters.featured));
      }
      if (filters?.isNew !== undefined) {
        constraints.push(where('isNew', '==', filters.isNew));
      }
      if (filters?.isActive !== undefined) {
        constraints.push(where('isActive', '==', filters.isActive));
      }
      
      constraints.push(orderBy('createdAt', 'desc'));
      
      if (filters?.limit) {
        constraints.push(limit(filters.limit));
      }

      q = query(q, ...constraints);
      const querySnapshot = await getDocs(q);
      const products: Product[] = [];
      
      for (const docSnapshot of querySnapshot.docs) {
        const product = { id: docSnapshot.id, ...docSnapshot.data() } as Product;
        // Fetch category data
        if (product.categoryId) {
          const categoryDoc = await getDoc(doc(db, 'categories', product.categoryId));
          if (categoryDoc.exists()) {
            product.category = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
          }
        }
        products.push(product);
      }
      
      return products;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  // Get product by ID
  async getProductById(id: string): Promise<Product | null> {
    try {
      const docRef = doc(db, 'products', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const product = { id: docSnap.id, ...docSnap.data() } as Product;
        
        // Fetch category data
        if (product.categoryId) {
          const categoryDoc = await getDoc(doc(db, 'categories', product.categoryId));
          if (categoryDoc.exists()) {
            product.category = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
          }
        }
        
        return product;
      }
      return null;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  },

  // Get product by slug (language-specific)
  async getProductBySlug(slug: string, language: 'en' | 'he' = 'en'): Promise<Product | null> {
    try {
      // Query for products where the slug field matches the language-specific slug
      const q = query(collection(db, 'products'), where(`slug.${language}`, '==', slug), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docSnapshot = querySnapshot.docs[0];
        const product = { id: docSnapshot.id, ...docSnapshot.data() } as Product;
        
        // Fetch category data
        if (product.categoryId) {
          const categoryDoc = await getDoc(doc(db, 'categories', product.categoryId));
          if (categoryDoc.exists()) {
            product.category = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
          }
        }
        
        return product;
      }
      return null;
    } catch (error) {
      console.error('Error fetching product by slug:', error);
      throw error;
    }
  },

  // Get product by SKU
  async getProductBySku(sku: string): Promise<Product | null> {
    try {
      console.log('🔍 Firebase: Searching for SKU:', sku);
      const q = query(collection(db, 'products'), where('sku', '==', sku), limit(1));
      const querySnapshot = await getDocs(q);
      
      console.log('📊 Firebase: Query returned', querySnapshot.docs.length, 'documents');
      
      if (!querySnapshot.empty) {
        const docSnapshot = querySnapshot.docs[0];
        const product = { id: docSnapshot.id, ...docSnapshot.data() } as Product;
        console.log('✅ Firebase: Product found:', product.name?.en);
        
        // Fetch category data
        if (product.categoryId) {
          const categoryDoc = await getDoc(doc(db, 'categories', product.categoryId));
          if (categoryDoc.exists()) {
            product.category = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
          }
        }
        
        return product;
      }
      console.log('❌ Firebase: No product found with SKU:', sku);
      return null;
    } catch (error) {
      console.error('❌ Firebase: Error fetching product by SKU:', error);
      throw error;
    }
  },

  // Create product
  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const now = new Date();
      let categorySlug = productData.categorySlug;
      // If categorySlug is not provided, fetch it from the category
      if (!categorySlug && productData.categoryId) {
        const categoryDoc = await getDoc(doc(db, 'categories', productData.categoryId));
        if (categoryDoc.exists()) {
          const categoryData = categoryDoc.data() as Category;
          categorySlug = typeof categoryData.slug === 'string' ? categoryData.slug : categoryData.slug?.en || '';
        }
      }
      const product = {
        ...productData,
        categorySlug: categorySlug || '',
        createdAt: now,
        updatedAt: now
      };
      const docRef = await addDoc(collection(db, 'products'), product);
      return docRef.id;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  },

  // Update product
  async updateProduct(id: string, productData: Partial<Product>): Promise<void> {
    try {
      const docRef = doc(db, 'products', id);
      await updateDoc(docRef, {
        ...productData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },

  // Delete product
  async deleteProduct(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'products', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  },

  // Real-time listener for products
  onProductsChange(callback: (products: Product[]) => void, filters?: {
    category?: string;
    featured?: boolean;
    isNew?: boolean;
    isActive?: boolean;
  }) {
    let q: Query = collection(db, 'products');
    const constraints: any[] = []; // TODO: Fix type
    
    if (filters?.category) {
      constraints.push(where('categoryId', '==', filters.category));
    }
    if (filters?.featured !== undefined) {
      constraints.push(where('featured', '==', filters.featured));
    }
    if (filters?.isNew !== undefined) {
      constraints.push(where('isNew', '==', filters.isNew));
    }
    if (filters?.isActive !== undefined) {
      constraints.push(where('isActive', '==', filters.isActive));
    }
    
    constraints.push(orderBy('createdAt', 'desc'));
    q = query(q, ...constraints);
    
    return onSnapshot(q, async (snapshot) => {
      const products: Product[] = [];
      
      for (const docSnapshot of snapshot.docs) {
        const product = { id: docSnapshot.id, ...docSnapshot.data() } as Product;
        
        // Fetch category data
        if (product.categoryId) {
          const categoryDoc = await getDoc(doc(db, 'categories', product.categoryId));
          if (categoryDoc.exists()) {
            product.category = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
          }
        }
        
        products.push(product);
      }
      
      callback(products);
    });
  }
};

// Category Services
export const categoryService = {
  // Get all categories
  async getAllCategories(): Promise<Category[]> {
    try {
      const q = query(collection(db, 'categories'), orderBy('sortOrder', 'asc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  },

  async getMainCategories(): Promise<Category[]> {
    try {
      const q = query(
        collection(db, 'categories'), 
        where('level', '==', 0),
        orderBy('sortOrder', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
    } catch (error) {
      console.error('Error fetching main categories:', error);
      throw error;
    }
  },

  async getSubCategories(parentId: string): Promise<Category[]> {
    try {
      const q = query(
        collection(db, 'categories'), 
        where('parentId', '==', parentId),
        orderBy('sortOrder', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
    } catch (error) {
      console.error('Error fetching sub categories:', error);
      throw error;
    }
  },

  async getEnabledCategories(): Promise<Category[]> {
    try {
      const q = query(
        collection(db, 'categories'), 
        where('isEnabled', '==', true),
        orderBy('level', 'asc'),
        orderBy('sortOrder', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
    } catch (error) {
      console.error('Error fetching enabled categories:', error);
      throw error;
    }
  },

  // Helper method to generate category path
  async generateCategoryPath(categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'path'>): Promise<string> {
    if (categoryData.level === 0) {
      // Main category - path is just the slug
      return categoryData.slug.en;
    }
    
    if (categoryData.parentId) {
      // Get parent category to build path
      const parentCategory = await this.getCategoryById(categoryData.parentId);
      if (parentCategory) {
        return `${parentCategory.path}/${categoryData.slug.en}`;
      }
    }
    
    // Fallback - just use the slug
    return categoryData.slug.en;
  },

  // Get category by ID
  async getCategoryById(categoryId: string): Promise<Category | null> {
    try {
      const docRef = doc(db, 'categories', categoryId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as Category;
      }
      return null;
    } catch (error) {
      console.error('Error fetching category by ID:', error);
      throw error;
    }
  },

  // Create category
  async createCategory(categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'path'>): Promise<string> {
    try {
      const now = new Date();
      
      // Get the next sort order for this level
      const sortOrder = await this.getNextSortOrder(categoryData.level, categoryData.parentId);
      
      // Generate the category path
      const path = await this.generateCategoryPath(categoryData);
      
      // Build category object, only including defined fields
      const category: any = {
        name: categoryData.name,
        slug: categoryData.slug,
        level: categoryData.level,
        isEnabled: categoryData.isEnabled,
        sortOrder,
        path,
        createdAt: now,
        updatedAt: now
      };
      
      // Add optional fields only if they have values
      if (categoryData.description) {
        category.description = categoryData.description;
      }
      
      if (categoryData.image && categoryData.image.trim()) {
        category.image = categoryData.image;
      }
      
      if (categoryData.parentId && categoryData.parentId.trim()) {
        category.parentId = categoryData.parentId;
      }
      
      const docRef = await addDoc(collection(db, 'categories'), category);
      return docRef.id;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  },

  async getNextSortOrder(level: number, parentId?: string): Promise<number> {
    try {
      let q;
      if (parentId) {
        q = query(
          collection(db, 'categories'),
          where('parentId', '==', parentId),
          orderBy('sortOrder', 'desc'),
          limit(1)
        );
      } else {
        q = query(
          collection(db, 'categories'),
          where('level', '==', level),
          where('parentId', '==', null),
          orderBy('sortOrder', 'desc'),
          limit(1)
        );
      }
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return 0;
      }
      
      const lastCategory = querySnapshot.docs[0].data() as Category;
      return (lastCategory.sortOrder || 0) + 1;
    } catch (error) {
      console.error('Error getting next sort order:', error);
      return 0;
    }
  },

  // Update category
  async updateCategory(id: string, categoryData: Partial<Category>): Promise<void> {
    try {
      const docRef = doc(db, 'categories', id);
      await updateDoc(docRef, {
        ...categoryData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  },

  // Delete category
  async deleteCategory(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'categories', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  },

  // Toggle category enabled status
  async toggleCategoryStatus(id: string, isEnabled: boolean): Promise<void> {
    try {
      const docRef = doc(db, 'categories', id);
      await updateDoc(docRef, {
        isEnabled,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error toggling category status:', error);
      throw error;
    }
  },

  // Delete category and all its children
  async deleteCategoryWithChildren(id: string): Promise<void> {
    try {
      // Get all sub-categories
      const subCategories = await this.getSubCategories(id);
      
      // Recursively delete all sub-categories
      for (const subCategory of subCategories) {
        if (subCategory.id) {
          await this.deleteCategoryWithChildren(subCategory.id);
        }
      }
      
      // Delete the main category
      await this.deleteCategory(id);
    } catch (error) {
      console.error('Error deleting category with children:', error);
      throw error;
    }
  },

  // NEW: Get navigation categories (level 0 only)
  async getNavigationCategories(): Promise<Category[]> {
    try {
      const q = query(
        collection(db, 'categories'),
        where('level', '==', 0),
        where('isEnabled', '==', true),
        orderBy('sortOrder', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
    } catch (error) {
      console.error('Error fetching navigation categories:', error);
      throw error;
    }
  },

  // NEW: Get category tree (hierarchical structure)
  async getCategoryTree(): Promise<Category[]> {
    try {
      const allCategories = await this.getAllCategories();
      return this.buildCategoryTree(allCategories);
    } catch (error) {
      console.error('Error fetching category tree:', error);
      throw error;
    }
  },

  // NEW: Build category tree from flat list
  buildCategoryTree(categories: Category[]): Category[] {
    const categoryMap = new Map<string, Category & { children: Category[] }>();
    const rootCategories: (Category & { children: Category[] })[] = [];

    // Create map of all categories with children array
    categories.forEach(cat => {
      categoryMap.set(cat.id!, { ...cat, children: [] });
    });

    // Build hierarchy
    categories.forEach(cat => {
      const categoryWithChildren = categoryMap.get(cat.id!);
      if (!categoryWithChildren) return;

      if (cat.level === 0) {
        // Root category
        rootCategories.push(categoryWithChildren);
      } else if (cat.parentId) {
        // Child category
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(categoryWithChildren);
        }
      }
    });

    return rootCategories;
  },

  // NEW: Get category path as array
  async getCategoryPathArray(categoryId: string): Promise<string[]> {
    try {
      const category = await this.getCategoryById(categoryId);
      if (!category) return [];
      
      return category.path.split('/');
    } catch (error) {
      console.error('Error getting category path array:', error);
      throw error;
    }
  },

  // NEW: Get categories by path
  async getCategoriesByPath(path: string): Promise<Category[]> {
    try {
      const q = query(
        collection(db, 'categories'),
        where('path', '==', path)
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
    } catch (error) {
      console.error('Error fetching categories by path:', error);
      throw error;
    }
  },

  // NEW: Bulk create categories
  async bulkCreateCategories(categoriesData: Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'path'>[]): Promise<string[]> {
    try {
      const categoryIds: string[] = [];
      
      for (const categoryData of categoriesData) {
        const categoryId = await this.createCategory(categoryData);
        categoryIds.push(categoryId);
      }
      
      return categoryIds;
    } catch (error) {
      console.error('Error bulk creating categories:', error);
      throw error;
    }
  }
};

// Authentication Services
export const authService = {
  // Sign in
  async signIn(email: string, password: string): Promise<AppUser> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as AppUser;
      }
      
      throw new Error('User data not found');
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  },

  // Sign up
  async signUp(email: string, password: string, name: string): Promise<string> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user document in Firestore
      const userData: Omit<AppUser, 'id' | 'createdAt' | 'updatedAt'> = {
        email,
        name,
        role: 'USER'
      };
      
      const now = new Date();
      await addDoc(collection(db, 'users'), {
        ...userData,
        createdAt: now,
        updatedAt: now
      });
      
      return user.uid;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  },

  // Sign out
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  // Get current user
  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  },

  // Listen to auth state changes
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  }
};

// Storage Services
export const storageService = {
  // Upload image
  async uploadImage(file: File, path: string): Promise<string> {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  },

  // Delete image
  async deleteImage(path: string): Promise<void> {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }
};

// Bilingual Import Service
export const importService = {
  async importFromGoogleSheets(sheetData: any[]): Promise<{ 
    success: number; 
    errors: number; 
    errorsList: string[];
    missingTranslations: string[];
    created: number;
    updated: number;
  }> {
    const results = {
      success: 0,
      errors: 0,
      errorsList: [] as string[],
      missingTranslations: [] as string[],
      created: 0,
      updated: 0
    };

    for (const row of sheetData) {
      try {
        console.log('Processing product:', row.name?.en || 'Unknown');
        
        // Validate bilingual data
        const validation = productHelpers.validateBilingualProduct(row);
        if (!validation.isValid) {
          console.log('Validation failed for product:', row.name?.en, 'Errors:', validation.errors);
          results.errors++;
          results.errorsList.push(`Product validation failed: ${validation.errors.join(', ')}`);
          continue;
        }
        
        console.log('Validation passed for product:', row.name?.en);

        // Create or find category
        const categoryQuery = query(collection(db, 'categories'), where('name', '==', row.category), limit(1));
        const categorySnapshot = await getDocs(categoryQuery);
        
        let categoryId: string;
        if (categorySnapshot.empty) {
          // Create new category
          const categoryData = {
            name: row.category,
            slug: row.category.toLowerCase().replace(/\s+/g, '-'),
            description: `${row.category} products`,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          const categoryRef = await addDoc(collection(db, 'categories'), categoryData);
          categoryId = categoryRef.id;
        } else {
          categoryId = categorySnapshot.docs[0].id;
        }

        // Generate slugs if not provided
        const enSlug = row.slug?.en || productHelpers.generateSlug(row.name.en);
        const heSlug = row.slug?.he || productHelpers.generateSlug(row.name.he);

        // Check if product already exists by SKU
        if (!row.sku || row.sku.trim() === '') {
          results.errors++;
          results.errorsList.push(`Product "${row.name.en}" is missing required SKU`);
          continue;
        }

        const skuQuery = query(collection(db, 'products'), where('sku', '==', row.sku.trim()), limit(1));
        const skuSnapshot = await getDocs(skuQuery);

        let isUpdate = false;
        let existingProductId: string | null = null;

        if (!skuSnapshot.empty) {
          isUpdate = true;
          existingProductId = skuSnapshot.docs[0].id;
        }

        // Check for slug conflicts (only for new products)
        if (!isUpdate) {
          const enSlugQuery = query(collection(db, 'products'), where('slug.en', '==', enSlug), limit(1));
          const heSlugQuery = query(collection(db, 'products'), where('slug.he', '==', heSlug), limit(1));
          
          const [enSlugSnapshot, heSlugSnapshot] = await Promise.all([
            getDocs(enSlugQuery),
            getDocs(heSlugQuery)
          ]);

          if (!enSlugSnapshot.empty) {
            results.errors++;
            results.errorsList.push(`Product with English slug "${enSlug}" already exists`);
            continue;
          }

          if (!heSlugSnapshot.empty) {
            results.errors++;
            results.errorsList.push(`Product with Hebrew slug "${heSlug}" already exists`);
            continue;
          }
        }

        // Parse data
        const imageUrls = row.images.split(',').map((url: string) => url.trim()).filter(Boolean);
        const sizes = row.sizes.split(',').map((size: string) => size.trim()).filter(Boolean);
        const colors = row.colors.split(',').map((color: string) => color.trim()).filter(Boolean);

        // Parse stock by size
        let stockBySize: Record<string, number> = {};
        let totalStock = 0;
        
        if (row.stockBySize) {
          const stockEntries = row.stockBySize.split(',').map((entry: string) => entry.trim()).filter(Boolean);
          stockBySize = {};
          
          for (const entry of stockEntries) {
            const [size, quantity] = entry.split(':').map((s: string) => s.trim());
            if (size && quantity && !isNaN(parseInt(quantity))) {
              stockBySize[size] = parseInt(quantity);
              totalStock += parseInt(quantity);
            }
          }
        } else if (row.stock) {
          const stockPerSize = Math.floor(parseInt(row.stock.toString()) / sizes.length);
          sizes.forEach((size: string) => {
            stockBySize[size] = stockPerSize;
            totalStock += stockPerSize;
          });
        }

        // Create bilingual product data
        const productData = {
          name: {
            en: row.name.en,
            he: row.name.he
          },
          slug: {
            en: enSlug,
            he: heSlug
          },
          description: {
            en: row.description.en,
            he: row.description.he
          },
          price: parseFloat(row.price.toString()),
          salePrice: row.salePrice ? parseFloat(row.salePrice.toString()) : null,
          saleStartDate: row.saleStartDate ? new Date(row.saleStartDate) : null,
          saleEndDate: row.saleEndDate ? new Date(row.saleEndDate) : null,
          sku: row.sku,
          stock: totalStock,
          featured: row.featured || false,
          isNew: row.new || false,
          isActive: true,
          categoryId,
          images: imageUrls.map((url: string, index: number) => ({
            url,
            alt: {
              en: `${row.name.en} - Image ${index + 1}`,
              he: `${row.name.he} - תמונה ${index + 1}`
            },
            isPrimary: index === 0,
            order: index,
            createdAt: new Date()
          })),
          variants: sizes.flatMap((size: string) =>
            colors.map((color: string) => ({
              size,
              color,
              stock: stockBySize[size] || 0,
              sku: row.sku ? `${row.sku}-${size}-${color}` : undefined,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          ),
          tags: [],
          createdAt: isUpdate ? undefined : new Date(),
          updatedAt: new Date()
        };

        if (isUpdate && existingProductId) {
          // Update existing product
          await updateDoc(doc(db, 'products', existingProductId), productData);
          results.updated++;
        } else {
          // Create new product
          await addDoc(collection(db, 'products'), {
            ...productData,
            createdAt: new Date()
          });
          results.created++;
        }

        results.success++;
        console.log('Successfully processed product:', row.name?.en);
      } catch (error) {
        console.log('Error processing product:', row.name?.en, error);
        results.errors++;
        results.errorsList.push(`Error importing "${row.name?.en || 'Unknown'}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('Import completed. Results:', results);
    return results;
  }
};

// Newsletter Service
export const newsletterService = {
  // Subscribe to newsletter
  async subscribeToNewsletter(email: string): Promise<string> {
    try {
      // Check if email already exists
      const q = query(collection(db, 'NewsletterEmails'), where('email', '==', email), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Email already exists, update to active
        const existingDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'NewsletterEmails', existingDoc.id), {
          isActive: true,
          subscribedAt: new Date()
        });
        return existingDoc.id;
      } else {
        // Create new subscription
        const emailData: Omit<NewsletterEmail, 'id'> = {
          email,
          subscribedAt: new Date(),
          isActive: true
        };
        
        const docRef = await addDoc(collection(db, 'NewsletterEmails'), emailData);
        return docRef.id;
      }
    } catch (error) {
      console.error('Error subscribing to newsletter:', error);
      throw error;
    }
  },

  // Unsubscribe from newsletter
  async unsubscribeFromNewsletter(email: string): Promise<void> {
    try {
      const q = query(collection(db, 'NewsletterEmails'), where('email', '==', email), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docRef = doc(db, 'NewsletterEmails', querySnapshot.docs[0].id);
        await updateDoc(docRef, {
          isActive: false
        });
      }
    } catch (error) {
      console.error('Error unsubscribing from newsletter:', error);
      throw error;
    }
  },

  // Get all newsletter subscribers
  async getAllSubscribers(): Promise<NewsletterEmail[]> {
    try {
      const q = query(collection(db, 'NewsletterEmails'), orderBy('subscribedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NewsletterEmail[];
    } catch (error) {
      console.error('Error fetching newsletter subscribers:', error);
      throw error;
    }
  }
}; 