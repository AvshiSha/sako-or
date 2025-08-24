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
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Export Firebase instances
export { app, analytics, db, auth, storage };

// Types
export interface Product {
  id?: string;
  name: string;
  slug: string;
  description: string;
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
}

export interface Category {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductImage {
  id?: string;
  url: string;
  alt?: string;
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
      const constraints: any[] = [];
      
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

  // Get product by slug
  async getProductBySlug(slug: string): Promise<Product | null> {
    try {
      const q = query(collection(db, 'products'), where('slug', '==', slug), limit(1));
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
          categorySlug = categoryData.slug;
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
    const constraints: any[] = [];
    
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
      const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
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

  // Create category
  async createCategory(categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const now = new Date();
      const category = {
        ...categoryData,
        createdAt: now,
        updatedAt: now
      };
      
      const docRef = await addDoc(collection(db, 'categories'), category);
      return docRef.id;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
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

// Google Sheets Import Service
export const importService = {
  async importFromGoogleSheets(sheetData: any[]): Promise<{ success: number; errors: number; errorsList: string[] }> {
    const results = {
      success: 0,
      errors: 0,
      errorsList: [] as string[]
    };

    for (const row of sheetData) {
      try {
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

        // Create product slug
        const slug = row.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        // Check if product already exists
        const productQuery = query(collection(db, 'products'), where('slug', '==', slug), limit(1));
        const productSnapshot = await getDocs(productQuery);

        if (!productSnapshot.empty) {
          results.errors++;
          results.errorsList.push(`Product "${row.name}" already exists with slug "${slug}"`);
          continue;
        }

        // Parse data
        const imageUrls = row.images.split(',').map((url: string) => url.trim()).filter(Boolean);
        const sizes = row.sizes.split(',').map((size: string) => size.trim()).filter(Boolean);
        const colors = row.colors.split(',').map((color: string) => color.trim()).filter(Boolean);

        // Create product
        const productData = {
          name: row.name,
          slug,
          description: row.description,
          price: parseFloat(row.price.toString()),
          salePrice: row.salePrice ? parseFloat(row.salePrice.toString()) : null,
          saleStartDate: row.saleStartDate ? new Date(row.saleStartDate) : null,
          saleEndDate: row.saleEndDate ? new Date(row.saleEndDate) : null,
          sku: row.sku,
          stock: parseInt(row.stock.toString()),
          featured: row.featured || false,
          isNew: row.new || false,
          isActive: true,
          categoryId,
          images: imageUrls.map((url: string, index: number) => ({
            url,
            alt: `${row.name} - Image ${index + 1}`,
            isPrimary: index === 0,
            order: index,
            createdAt: new Date()
          })),
          variants: sizes.flatMap((size: string) =>
            colors.map((color: string) => ({
              size,
              color,
              stock: Math.floor(parseInt(row.stock.toString()) / (sizes.length * colors.length)),
              sku: row.sku ? `${row.sku}-${size}-${color}` : undefined,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          ),
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await addDoc(collection(db, 'products'), productData);
        results.success++;
      } catch (error) {
        results.errors++;
        results.errorsList.push(`Error importing "${row.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }
}; 