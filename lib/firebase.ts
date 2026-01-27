// Import the functions you need from the SDKs you need
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAnalytics, logEvent as firebaseLogEvent, Analytics } from "firebase/analytics";
import { getFirestore, Firestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, setDoc, deleteDoc, query, where, orderBy, limit, startAfter, onSnapshot, Query, Unsubscribe, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { getAuth, Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getStorage, FirebaseStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// Lazy-init Firebase to avoid auth/invalid-api-key during Next.js build (when env may be missing).
// Initialization runs on first use of db/auth/storage/app, not at import time.
let _app: FirebaseApp | null = null;
let _analytics: Analytics | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;
let _storage: FirebaseStorage | null = null;

function getApp(): FirebaseApp {
  if (_app) return _app;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.length === 0) {
    throw new Error(
      'Firebase API key is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY (and other NEXT_PUBLIC_FIREBASE_* vars) in .env.local.'
    );
  }
  const defaultProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const firebaseConfig = {
    apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: defaultProjectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
  };
  _app = initializeApp(firebaseConfig);
  return _app;
}

function getDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getApp());
  return _db;
}

function getAuthInstance(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(getApp());
  return _auth;
}

function getStorageInstance(): FirebaseStorage {
  if (_storage) return _storage;
  _storage = getStorage(getApp());
  return _storage;
}

function getAnalyticsInstance(): Analytics | null {
  if (typeof window === 'undefined') return null;
  if (_analytics) return _analytics;
  try {
    _analytics = getAnalytics(getApp());
    return _analytics;
  } catch (error) {
    console.warn('Analytics initialization failed:', error);
    return null;
  }
}

function createLazyProxy<T extends object>(getter: () => T): T {
  let instance: T | null = null;
  return new Proxy({} as T, {
    get(_, prop) {
      if (!instance) instance = getter();
      return (instance as Record<string | symbol, unknown>)[prop];
    }
  }) as T;
}

const app = createLazyProxy(getApp);
const db = getDb();
const auth = getAuthInstance();
const storage = getStorageInstance();

let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalyticsInstance();
  } catch {
    analytics = null;
  }
}

// Export Firebase instances (app, db, auth, storage are lazy; analytics is client-only)
export { app, analytics, db, auth, storage };

/** Use with modular API: logEvent(analytics, 'event_name', params). No-op if analytics is null. */
export function logEvent(
  analyticsInstance: Analytics | null,
  eventName: string,
  params?: Record<string, unknown>
): void {
  if (analyticsInstance) {
    try {
      firebaseLogEvent(analyticsInstance, eventName, params);
    } catch (e) {
      console.warn('Analytics logEvent error:', e);
    }
  }
}



// Types
export interface Product {
  id?: string;
  // New structure fields
  sku: string;
  title_en: string;
  title_he: string;
  description_en: string;
  description_he: string;
  category: string;
  subCategory?: string;
  subSubCategory?: string;
  categories_path: string[];
  categories_path_id: string[];
  brand: string;
  price: number;
  salePrice?: number;
  currency: string;
  colorVariants: Record<string, {
    colorSlug: string;
    isActive?: boolean;
    priceOverride?: number;
    salePrice?: number;
    stockBySize: Record<string, number>;
    metaTitle?: string;
    metaDescription?: string;
    images: string[];
    primaryImage?: string;
    videos?: string[];
  }>;
  isEnabled: boolean;
  isDeleted: boolean;
  newProduct: boolean;
  featuredProduct: boolean;
  materialCare?: {
    upperMaterial_en?: string;
    upperMaterial_he?: string;
    materialInnerSole_en?: string;
    materialInnerSole_he?: string;
    lining_en?: string;
    lining_he?: string;
    sole_en?: string;
    sole_he?: string;
    heelHeight_en?: string;
    heelHeight_he?: string;
    height_en?: string;
    height_he?: string;
    depth_en?: string;
    depth_he?: string;
    width_en?: string;
    width_he?: string;
  };
  seo?: {
    title_en?: string;
    title_he?: string;
    description_en?: string;
    description_he?: string;
    slug?: string;
  };
  searchKeywords?: string[];
  createdAt: Date;
  updatedAt: Date;

  // Legacy fields for backward compatibility
  name?: {
    en: string;
    he: string;
  };
  slug?: {
    en: string;
    he: string;
  };
  description?: {
    en: string;
    he: string;
  };
  baseSku?: string;
  featured?: boolean;
  isNew?: boolean;
  isActive?: boolean;
  categoryId?: string;
  categorySlug?: string;
  categoryObj?: Category;
  categoryPath?: string;

  // Material & Care information
  upperMaterial?: {
    en: string;
    he: string;
  };
  materialInnerSole?: {
    en: string;
    he: string;
  };
  lining?: {
    en: string;
    he: string;
  };
  sole?: {
    en: string;
    he: string;
  };
  heelHeight?: {
    en: string;
    he: string;
  };

  // Shipping & Returns information
  shippingReturns?: {
    en: string;
    he: string;
  };

  tags: string[];
  videoUrl?: string;
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

// Color-specific variant with its own images, pricing, and stock
export interface ColorVariant {
  id?: string;
  // Color information
  colorName: string; // Display name (e.g., "Black", "Red")
  colorSlug: string; // URL slug (e.g., "black", "red")
  colorHex?: string; // Hex color code for swatches

  // Pricing (can override base product pricing)
  price?: number; // Override price for this color
  salePrice?: number; // Sale price for this color
  saleStartDate?: Date;
  saleEndDate?: Date;

  // Stock and availability
  stock: number;
  isActive: boolean;

  // Video
  videoUrl?: string; // Video URL for this color variant

  // SEO
  metaTitle?: string;
  metaDescription?: string;

  createdAt: Date;
  updatedAt: Date;

  // Relations
  images: ColorVariantImage[];
  sizes: ColorVariantSize[];
}

// Images specific to each color variant
export interface ColorVariantImage {
  id?: string;
  url: string;
  alt?: string;
  isPrimary: boolean;
  order: number;
  createdAt: Date;
}

// Size and stock information per color variant
export interface ColorVariantSize {
  id?: string;
  size: string; // Size value (e.g., "S", "M", "L", "36", "37")
  stock: number;
  sku?: string; // Full SKU for this size/color combination
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

// Campaign Types
export type Locale = 'he' | 'en';

export interface LocalizedString {
  he: string;
  en: string;
}

export type CampaignProductFilterMode = 'tag' | 'sale' | 'manual';

export interface CampaignProductFilter {
  mode: CampaignProductFilterMode;
  tag?: string;
  limit?: number;
  orderBy?: 'createdAt' | 'salePrice' | 'popularity';
  orderDirection?: 'asc' | 'desc';
}

export interface Campaign {
  id: string; // doc ID == slug
  slug: string;
  title: LocalizedString;
  subtitle?: LocalizedString;
  description?: LocalizedString;
  seoTitle?: LocalizedString;
  seoDescription?: LocalizedString;
  bannerDesktopUrl?: string;
  bannerMobileUrl?: string;
  bannerDesktopVideoUrl?: string;
  bannerMobileVideoUrl?: string;
  active: boolean;
  priority: number;
  startAt?: string; // ISO string
  endAt?: string;   // ISO string
  productFilter: CampaignProductFilter;
  productIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Helper functions for bilingual products
export const productHelpers = {
  // Get product field in specific language
  getField: (product: Product, field: 'name' | 'description' | 'slug', language: 'en' | 'he'): string => {
    return product[field]?.[language] || product[field]?.en || '';
  },

  // Get product image alt text in specific language
  getImageAlt: (image: ColorVariantImage, _language: 'en' | 'he'): string => {
    return image.alt || '';
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
    brand?: string;
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
        constraints.push(where('isEnabled', '==', filters.isActive));
      }
      if (filters?.brand) {
        constraints.push(where('brand', '==', filters.brand));
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
            product.categoryObj = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
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
            product.categoryObj = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
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
            product.categoryObj = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
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

  // Get product by base SKU (new system)
  async getProductByBaseSku(baseSku: string): Promise<Product | null> {
    try {
      console.log('🔍 Firebase: Searching for base SKU:', baseSku);
      // Force fresh data by adding a timestamp to bypass cache
      const q = query(collection(db, 'products'), where('sku', '==', baseSku), limit(1));
      const querySnapshot = await getDocs(q);

      console.log('📊 Firebase: Query returned', querySnapshot.docs.length, 'documents');

      if (!querySnapshot.empty) {
        const docSnapshot = querySnapshot.docs[0];
        const productData = docSnapshot.data();

        const product = {
          id: docSnapshot.id,
          ...productData,
          colorVariants: productData.colorVariants || {}
        } as Product;

        // Fetch category data
        if (product.categoryId) {
          const categoryDoc = await getDoc(doc(db, 'categories', product.categoryId));
          if (categoryDoc.exists()) {
            product.categoryObj = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
          }
        }

        return product;
      }
      console.log('❌ Firebase: No product found with base SKU:', baseSku);
      return null;
    } catch (error) {
      console.error('❌ Firebase: Error fetching product by base SKU:', error);
      throw error;
    }
  },

  // Get product by base SKU with real-time listener
  onProductByBaseSku: (baseSku: string, callback: (product: Product | null) => void): Unsubscribe => {
    const q = query(collection(db, 'products'), where('sku', '==', baseSku), limit(1));

    return onSnapshot(q,
      (querySnapshot) => {
        if (!querySnapshot.empty) {
          const docSnapshot = querySnapshot.docs[0];
          const productData = docSnapshot.data();

          const product = {
            id: docSnapshot.id,
            ...productData,
            colorVariants: productData.colorVariants || {}
          } as Product;

          // Fetch category data
          if (product.categoryId) {
            getDoc(doc(db, 'categories', product.categoryId)).then(categoryDoc => {
              if (categoryDoc.exists()) {
                product.categoryObj = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
                callback(product);
              } else {
                callback(product);
              }
            }).catch(() => callback(product));
          } else {
            callback(product);
          }
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Firebase real-time listener error:', error);
        callback(null);
      }
    );
  },

  // Get product with all color variants
  async getProductWithColorVariants(baseSku: string): Promise<Product | null> {
    try {
      const product = await this.getProductByBaseSku(baseSku);
      if (!product) return null;

      // Fetch color variants
      const colorVariantsQuery = query(
        collection(db, 'colorVariants'),
        where('productId', '==', product.id),
        orderBy('createdAt', 'asc')
      );
      const colorVariantsSnapshot = await getDocs(colorVariantsQuery);

      const colorVariants: ColorVariant[] = [];

      for (const variantDoc of colorVariantsSnapshot.docs) {
        const variant = { id: variantDoc.id, ...variantDoc.data() } as ColorVariant;

        // Fetch variant images
        const imagesQuery = query(
          collection(db, 'colorVariantImages'),
          where('colorVariantId', '==', variant.id),
          orderBy('order', 'asc')
        );
        const imagesSnapshot = await getDocs(imagesQuery);
        variant.images = imagesSnapshot.docs.map(imgDoc => ({
          id: imgDoc.id,
          ...imgDoc.data()
        })) as ColorVariantImage[];

        // Fetch variant sizes
        const sizesQuery = query(
          collection(db, 'colorVariantSizes'),
          where('colorVariantId', '==', variant.id),
          orderBy('size', 'asc')
        );
        const sizesSnapshot = await getDocs(sizesQuery);
        variant.sizes = sizesSnapshot.docs.map(sizeDoc => ({
          id: sizeDoc.id,
          ...sizeDoc.data()
        })) as ColorVariantSize[];

        colorVariants.push(variant);
      }

      // Convert array to Record format for new structure
      product.colorVariants = colorVariants.reduce((acc, variant) => {
        if (variant.colorSlug) {
          acc[variant.colorSlug] = {
            colorSlug: variant.colorSlug,
            priceOverride: variant.price,
            salePrice: variant.salePrice,
            stockBySize: variant.sizes?.reduce((sizeAcc, size) => {
              sizeAcc[size.size] = size.stock;
              return sizeAcc;
            }, {} as Record<string, number>) || {},
            metaTitle: variant.metaTitle,
            metaDescription: variant.metaDescription,
            images: variant.images?.map(img => img.url) || [],
            primaryImage: variant.images?.find(img => img.isPrimary)?.url,
            videos: variant.videoUrl ? [variant.videoUrl] : []
          };
        }
        return acc;
      }, {} as Record<string, any>);
      return product;
    } catch (error) {
      console.error('Error fetching product with color variants:', error);
      throw error;
    }
  },

  // Get product by SKU (legacy support)
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
            product.categoryObj = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
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

      // Deep clean function to remove undefined values recursively
      const deepClean = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(deepClean);

        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            cleaned[key] = deepClean(value);
          }
        }
        return cleaned;
      };

      // Clean dimensions data - remove undefined values from nested objects
      const cleanDimensions = (dimensions: any) => {
        if (!dimensions) return null;

        const cleaned = {
          heightCm: dimensions.heightCm ?? null,
          widthCm: dimensions.widthCm ?? null,
          depthCm: dimensions.depthCm ?? null,
          quantity: dimensions.quantity ?? undefined
        };

        // If all dimension values are null/undefined, return null
        if (cleaned.heightCm === null && cleaned.widthCm === null && cleaned.depthCm === null) {
          return null;
        }

        return cleaned;
      };

      // Clean colorVariants data if present
      const cleanedProductData = { ...productData };
      if (cleanedProductData.colorVariants) {
        const cleanedColorVariants: any = {};
        for (const [colorKey, variant] of Object.entries(cleanedProductData.colorVariants)) {
          cleanedColorVariants[colorKey] = {
            ...variant,
            dimensions: cleanDimensions((variant as any).dimensions)
          };
        }
        cleanedProductData.colorVariants = cleanedColorVariants;
      }

      // Apply deep cleaning to the entire product data
      const finalCleanedData = deepClean(cleanedProductData);

      const product = {
        ...finalCleanedData,
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
      // Deep clean function to remove undefined values recursively
      const deepClean = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(deepClean);

        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            cleaned[key] = deepClean(value);
          }
        }
        return cleaned;
      };

      // Clean dimensions data - remove undefined values from nested objects
      const cleanDimensions = (dimensions: any) => {
        if (!dimensions) return null;

        const cleaned = {
          heightCm: dimensions.heightCm ?? null,
          widthCm: dimensions.widthCm ?? null,
          depthCm: dimensions.depthCm ?? null,
          quantity: dimensions.quantity ?? undefined
        };

        // If all dimension values are null/undefined, return null
        if (cleaned.heightCm === null && cleaned.widthCm === null && cleaned.depthCm === null) {
          return null;
        }

        return cleaned;
      };

      // Clean colorVariants data if present
      const cleanedProductData = { ...productData };
      if (cleanedProductData.colorVariants) {
        const cleanedColorVariants: any = {};
        for (const [colorKey, variant] of Object.entries(cleanedProductData.colorVariants)) {
          cleanedColorVariants[colorKey] = {
            ...variant,
            dimensions: cleanDimensions((variant as any).dimensions)
          };
        }
        cleanedProductData.colorVariants = cleanedColorVariants;
      }

      // Apply deep cleaning to the entire product data
      const finalCleanedData = deepClean(cleanedProductData);

      const docRef = doc(db, 'products', id);
      await updateDoc(docRef, {
        ...finalCleanedData,
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
      constraints.push(where('isEnabled', '==', filters.isActive));
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
            product.categoryObj = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
          }
        }

        // Handle color variants - new products have them embedded, old products need separate fetch
        if (!product.colorVariants || Object.keys(product.colorVariants).length === 0) {
          // Old product structure - fetch from separate collection
          try {
            const colorVariantsQuery = query(
              collection(db, 'colorVariants'),
              where('productId', '==', product.id),
              where('isActive', '==', true)
            );
            const colorVariantsSnapshot = await getDocs(colorVariantsQuery);

            product.colorVariants = {};
            for (const variantDoc of colorVariantsSnapshot.docs) {
              const variant = { id: variantDoc.id, ...variantDoc.data() } as ColorVariant;

              // Fetch variant images
              const imagesQuery = query(
                collection(db, 'colorVariantImages'),
                where('colorVariantId', '==', variant.id),
                orderBy('order', 'asc')
              );
              const imagesSnapshot = await getDocs(imagesQuery);
              variant.images = imagesSnapshot.docs.map(imgDoc => ({
                id: imgDoc.id,
                ...imgDoc.data()
              } as ColorVariantImage));

              // Fetch variant sizes
              const sizesQuery = query(
                collection(db, 'colorVariantSizes'),
                where('colorVariantId', '==', variant.id)
              );
              const sizesSnapshot = await getDocs(sizesQuery);
              variant.sizes = sizesSnapshot.docs.map(sizeDoc => ({
                id: sizeDoc.id,
                ...sizeDoc.data()
              } as ColorVariantSize));

              // Convert to new Record format
              if (variant.colorSlug) {
                product.colorVariants[variant.colorSlug] = {
                  colorSlug: variant.colorSlug,
                  priceOverride: variant.price,
                  salePrice: variant.salePrice,
                  stockBySize: variant.sizes?.reduce((sizeAcc, size) => {
                    sizeAcc[size.size] = size.stock;
                    return sizeAcc;
                  }, {} as Record<string, number>) || {},
                  metaTitle: variant.metaTitle,
                  metaDescription: variant.metaDescription,
                  images: variant.images?.map(img => img.url) || [],
                  primaryImage: variant.images?.find(img => img.isPrimary)?.url,
                  videos: variant.videoUrl ? [variant.videoUrl] : []
                };
              }
            }
          } catch (error) {
            console.error('Error fetching color variants:', error);
            product.colorVariants = {};
          }
        } else {
          // New product structure - color variants are already embedded
        }

        products.push(product);
      }

      callback(products);
    });
  }
};

// Collection filtering types
export type ProductFilters = {
  categoryPath?: string;        // e.g., "women/shoes/boots"
  categoryId?: string;          // Category ID to filter by (single level)
  categoryLevel?: number;        // Level in the path (0, 1, or 2) where categoryId should match
  categoryIds?: string[];       // Array of category IDs for hierarchical filtering [womenId, shoesId, sneakersId]
  subSubCategoryIds?: string[]; // Array of sub-subcategory IDs to filter by (level 2 categories)
  color?: string | string[];
  size?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  isOutlet?: boolean;
  isOnSaleOnly?: boolean;
  excludeSkus?: string[];
  includeSkus?: string[];
};

export type ProductSortOption = 'relevance' | 'newest' | 'priceAsc' | 'priceDesc';

export type PaginationOptions = {
  page?: number;
  pageSize?: number;
  lastDocument?: QueryDocumentSnapshot<DocumentData>;
};

export type FilteredProductsResult = {
  products: Product[];
  hasMore: boolean;
  total: number;  // Total matching products
  page: number;   // Current page number
  pageSize: number; // Page size used
  lastDocument?: QueryDocumentSnapshot<DocumentData>;
};

/**
 * Get filtered products using Firestore queries
 * Handles category, price, and basic filtering on the server
 * Color and size filtering is done client-side on the filtered subset
 */
export async function getFilteredProducts(
  filters: ProductFilters = {},
  sort: ProductSortOption = 'relevance',
  pagination?: PaginationOptions
): Promise<FilteredProductsResult> {
  try {
    let q: Query = collection(db, 'products');
    const constraints: any[] = [];

    // Always filter active, non-deleted products
    constraints.push(where('isEnabled', '==', true));
    constraints.push(where('isDeleted', '==', false));

    // Category filtering using categories_path_id with dot notation for array index matching
    // Firestore supports querying array elements by index using dot notation
    // Note: Arrays are 0-indexed, so we use .0, .1, .2 for indices 0, 1, 2
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      // Add where clauses for each level using dot notation
      // If Level 0: categories_path_id.0 == categoryIds[0]
      // If Level 1: categories_path_id contains categoryIds[1]
      // If Level 2: categories_path_id contains categoryIds[2]
      switch (filters.categoryIds.length) {
        case 1:
          constraints.push(where('categories_path_id', 'array-contains', filters.categoryIds[0]));
          break;
        case 2:
          constraints.push(where('categories_path_id', 'array-contains', filters.categoryIds[1]));
          break;
        case 3:
          constraints.push(where('categories_path_id', 'array-contains', filters.categoryIds[2]));
          break;
        default:
          break;
      }
    } else if (filters.categoryId && filters.categoryLevel !== undefined) {
      // Use array-contains to get products that have this category ID in their path
      // We'll filter by exact level client-side
      constraints.push(where('categories_path_id', 'array-contains', filters.categoryId));
    } else if (filters.categoryPath) {
      // Fallback: use path-based filtering (for backward compatibility)
      const categoryPathLower = filters.categoryPath.toLowerCase();
      const pathSegments = categoryPathLower.split('/');

      // Use array-contains for the first segment (main category) to narrow down results
      if (pathSegments.length > 0) {
        const firstSegment = pathSegments[0];
        constraints.push(where('categories_path', 'array-contains', firstSegment));
      }
    }

    // Price filtering - Note: We do this entirely client-side because actual prices can be
    // variant.salePrice, product.salePrice, variant.priceOverride, or product.price
    // Firestore can't easily query nested variant prices, so we filter after fetching
    // We don't add any price constraints here to avoid excluding valid products

    // Outlet filter
    if (filters.isOutlet) {
      // Assuming there's an isOutlet field, or we can check salePrice
      // For now, we'll filter by having a significant sale price
      constraints.push(where('salePrice', '>', 0));
    }

    // On sale filter
    if (filters.isOnSaleOnly) {
      constraints.push(where('salePrice', '>', 0));
    }

    // SKU exclusion/inclusion
    if (filters.excludeSkus && filters.excludeSkus.length > 0) {
      // Firestore doesn't support NOT IN directly, so we'll filter this client-side
      // But we can limit the query if needed
    }
    if (filters.includeSkus && filters.includeSkus.length > 0) {
      // Use 'in' operator for SKU inclusion (max 10 items in Firestore)
      if (filters.includeSkus.length <= 10) {
        constraints.push(where('sku', 'in', filters.includeSkus));
      }
    }

    // Sorting - Always use consistent orderBy for stable pagination
    // Note: For stable sorting across pages, we always use the same field and direction
    // Client-side sorting will handle salePrice logic and ensure consistency when loading more pages
    switch (sort) {
      case 'newest':
        constraints.push(orderBy('createdAt', 'desc'));
        break;
      case 'priceAsc':
        constraints.push(orderBy('price', 'asc'));
        break;
      case 'priceDesc':
        constraints.push(orderBy('price', 'desc'));
        break;
      case 'relevance':
      default:
        // Default: newest first
        constraints.push(orderBy('createdAt', 'desc'));
        break;
    }

    let querySnapshot;
    try {
      q = query(q, ...constraints);
      querySnapshot = await getDocs(q);
    } catch (queryError: any) {
      // If query fails (e.g., missing composite index), try without category filter
      if (filters.categoryPath && queryError?.code === 'failed-precondition') {
        // Retry without category filter - we'll do all filtering client-side
        const fallbackConstraints = constraints.filter(c => {
          // Remove category-related constraints
          return !(c.fieldPath === 'categories_path');
        });
        q = query(collection(db, 'products'), ...fallbackConstraints);
        querySnapshot = await getDocs(q);
      } else {
        throw queryError;
      }
    }

    const products: Product[] = [];
    let lastDoc: QueryDocumentSnapshot<DocumentData> | undefined;
    let hasMore = false;

    // Process results - fetch all documents first (we'll paginate after client-side filtering)
    const docs = querySnapshot.docs;

    for (const docSnapshot of docs) {
      const docData = docSnapshot.data();
      const product = { id: docSnapshot.id, ...docData } as Product;

      // Fetch category data if needed
      if (product.categoryId) {
        try {
          const categoryDoc = await getDoc(doc(db, 'categories', product.categoryId));
          if (categoryDoc.exists()) {
            product.categoryObj = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
          }
        } catch (err) {
          // Continue if category fetch fails
          console.warn(`Failed to fetch category for product ${product.id}:`, err);
        }
      }

      products.push(product);
      lastDoc = docSnapshot;
    }

    // Apply client-side filtering for complex cases
    let filteredProducts = products;

    // Category filtering by IDs at all levels (hierarchical matching)
    // Note: Since we're using Firestore dot notation queries, products are already filtered at the database level
    // We still do a client-side verification to ensure data integrity, but most filtering happens in Firestore
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      const categoryIds = filters.categoryIds; // Store in local variable for TypeScript

      // Client-side verification (Firestore should have already filtered, but we verify for safety)
      filteredProducts = filteredProducts.filter((product) => {
        if (!product.categories_path_id || product.categories_path_id.length === 0) {
          return false;
        }

        // Product must have at least as many levels as we're filtering by
        if (product.categories_path_id.length < categoryIds.length) {
          return false; // Product doesn't have enough levels
        }

        // Verify each level matches (Firestore query should have already filtered, but we double-check)
        for (let i = 0; i < categoryIds.length; i++) {
          if (product.categories_path_id[i] !== categoryIds[i]) {
            return false;
          }
        }

        // Product matches up to the target level - include it
        return true;
      });
    } else if (filters.categoryId && filters.categoryLevel !== undefined) {
      const targetLevel = filters.categoryLevel;
      filteredProducts = filteredProducts.filter((product) => {
        if (!product.categories_path_id || product.categories_path_id.length === 0) {
          return false;
        }

        // Check if the category ID matches at the specified level
        // Level 0 = index 0, Level 1 = index 1, Level 2 = index 2
        if (product.categories_path_id.length > targetLevel) {
          return product.categories_path_id[targetLevel] === filters.categoryId;
        }

        return false;
      });
    } else if (filters.categoryPath) {
      // Fallback: Category path hierarchical matching (parent/child relationships)
      const categoryPathLower = filters.categoryPath.toLowerCase();
      const requestedPath = categoryPathLower;
      filteredProducts = filteredProducts.filter((product) => {
        if (!product.categories_path || product.categories_path.length === 0) {
          return false;
        }

        const productPath = product.categories_path.join('/').toLowerCase();

        // Exact match
        if (productPath === requestedPath) {
          return true;
        }

        // Parent match: product is in a child category of the requested path
        if (productPath.startsWith(requestedPath + '/')) {
          return true;
        }

        // Child match: requested path is a child of the product's path
        if (requestedPath.startsWith(productPath + '/')) {
          return true;
        }

        return false;
      });
    }

    // Sub-subcategory filtering (client-side)
    // Filter products where categories_path_id[2] (level 2) matches any of the selected sub-subcategory IDs
    if (filters.subSubCategoryIds && filters.subSubCategoryIds.length > 0) {
      const subSubCategoryIds = filters.subSubCategoryIds;
      filteredProducts = filteredProducts.filter((product) => {
        if (!product.categories_path_id || product.categories_path_id.length < 3) {
          return false; // Product doesn't have a sub-subcategory
        }
        // Check if the product's sub-subcategory (index 2) is in the selected list
        const productSubSubCategoryId = product.categories_path_id[2];
        return subSubCategoryIds.includes(productSubSubCategoryId);
      });
    }

    // SKU exclusion (client-side since Firestore doesn't support NOT IN easily)
    if (filters.excludeSkus && filters.excludeSkus.length > 0) {
      filteredProducts = filteredProducts.filter(
        (product) => !filters.excludeSkus!.includes(product.sku)
      );
    }

    // Color filtering (client-side due to nested structure)
    if (filters.color && (Array.isArray(filters.color) ? filters.color.length > 0 : true)) {
      const colors = Array.isArray(filters.color) ? filters.color : [filters.color];
      filteredProducts = filteredProducts.filter((product) => {
        if (!product.colorVariants) return false;
        return Object.values(product.colorVariants)
          .filter(variant => variant.isActive !== false)
          .some((variant) => colors.includes(variant.colorSlug || ''));
      });
    }

    // Size filtering (client-side due to nested structure)
    if (filters.size && (Array.isArray(filters.size) ? filters.size.length > 0 : true)) {
      const sizes = Array.isArray(filters.size) ? filters.size : [filters.size];
      filteredProducts = filteredProducts.filter((product) => {
        if (!product.colorVariants) return false;
        return Object.values(product.colorVariants)
          .filter(variant => variant.isActive !== false)
          .some((variant) =>
            Object.keys(variant.stockBySize || {}).some((size) => sizes.includes(size))
          );
      });
    }

    // In-stock filtering
    if (filters.inStockOnly) {
      filteredProducts = filteredProducts.filter((product) => {
        if (!product.colorVariants) return false;
        return Object.values(product.colorVariants)
          .filter(variant => variant.isActive !== false)
          .some((variant) =>
            Object.values(variant.stockBySize || {}).some((stock) => stock > 0)
          );
      });
    }

    // Price filtering (client-side to handle salePrice and variant prices)
    // The actual displayed price can be: variant.salePrice > product.salePrice > variant.priceOverride > product.price
    if (filters.minPrice !== undefined && filters.minPrice > 0) {
      filteredProducts = filteredProducts.filter((product) => {
        // Get the minimum price across all active variants
        if (!product.colorVariants || Object.keys(product.colorVariants).length === 0) {
          // No variants, use product-level price
          const productPrice = product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;
          return productPrice >= filters.minPrice!;
        }

        // Check all active variants to find the minimum price
        const variantPrices = Object.values(product.colorVariants)
          .filter(variant => variant.isActive !== false)
          .map((variant) => {
            // Priority: variant.salePrice > product.salePrice > variant.priceOverride > product.price
            if (variant.salePrice && variant.salePrice > 0) return variant.salePrice;
            if (product.salePrice && product.salePrice > 0) return product.salePrice;
            if ((variant as any).priceOverride && (variant as any).priceOverride > 0) return (variant as any).priceOverride;
            return product.price;
          });

        if (variantPrices.length === 0) {
          const productPrice = product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;
          return productPrice >= filters.minPrice!;
        }

        // Product matches if any variant's price is >= minPrice
        const minVariantPrice = Math.min(...variantPrices);
        return minVariantPrice >= filters.minPrice!;
      });
    }

    if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
      filteredProducts = filteredProducts.filter((product) => {
        // Get the minimum price across all active variants (we show the lowest price)
        if (!product.colorVariants || Object.keys(product.colorVariants).length === 0) {
          // No variants, use product-level price
          const productPrice = product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;
          return productPrice <= filters.maxPrice!;
        }

        // Check all active variants to find the minimum price (what's displayed)
        const variantPrices = Object.values(product.colorVariants)
          .filter(variant => variant.isActive !== false)
          .map((variant) => {
            // Priority: variant.salePrice > product.salePrice > variant.priceOverride > product.price
            if (variant.salePrice && variant.salePrice > 0) return variant.salePrice;
            if (product.salePrice && product.salePrice > 0) return product.salePrice;
            if ((variant as any).priceOverride && (variant as any).priceOverride > 0) return (variant as any).priceOverride;
            return product.price;
          });

        if (variantPrices.length === 0) {
          const productPrice = product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;
          return productPrice <= filters.maxPrice!;
        }

        // Product matches if the minimum variant price is <= maxPrice
        const minVariantPrice = Math.min(...variantPrices);
        return minVariantPrice <= filters.maxPrice!;
      });
    }

    // Calculate total count (before pagination)
    const total = filteredProducts.length;

    // Apply pagination if provided
    let paginatedProducts = filteredProducts;
    let currentPage = 1;
    let currentPageSize = total; // Default: return all if no pagination
    let calculatedHasMore = false;

    if (pagination && pagination.page && pagination.pageSize) {
      currentPage = pagination.page;
      currentPageSize = pagination.pageSize;
      const startIndex = (currentPage - 1) * currentPageSize;
      const endIndex = startIndex + currentPageSize;
      paginatedProducts = filteredProducts.slice(startIndex, endIndex);
      calculatedHasMore = endIndex < total;
    } else {
      calculatedHasMore = false;
    }

    return {
      products: paginatedProducts,
      hasMore: calculatedHasMore,
      total: total,
      page: currentPage,
      pageSize: currentPageSize,
      lastDocument: lastDoc
    };
  } catch (error) {
    console.error('Error fetching filtered products:', error);
    throw error;
  }
}



/**
 * Get collection products with filters parsed from URL params
 * This is the main function used by collection pages
 */
export async function getCollectionProducts(
  categoryPath: string | undefined,
  searchParams: { [key: string]: string | string[] | undefined } = {},
  language: 'en' | 'he' = 'en'
): Promise<FilteredProductsResult> {
  // Parse filters from searchParams
  const filters: ProductFilters = {};

  // Category filtering: resolve all category IDs from path
  if (categoryPath) {
    try {
      const categoryInfo = await categoryService.getCategoryIdsFromPath(categoryPath, language);
      if (categoryInfo && categoryInfo.categoryIds.length > 0) {
        filters.categoryIds = categoryInfo.categoryIds;
      } else {
        // Fallback to path-based filtering if category not found
        filters.categoryPath = categoryPath;
      }
    } catch (error) {
      // Fallback to path-based filtering
      filters.categoryPath = categoryPath;
    }
  }

  // Color filter
  const colorsParam = searchParams.colors;
  if (colorsParam) {
    const colors = typeof colorsParam === 'string'
      ? colorsParam.split(',').filter(Boolean)
      : Array.isArray(colorsParam)
        ? colorsParam.flatMap(c => c.split(',')).filter(Boolean)
        : [];
    if (colors.length > 0) {
      filters.color = colors;
    }
  }

  // Size filter
  const sizesParam = searchParams.sizes;
  if (sizesParam) {
    const sizes = typeof sizesParam === 'string'
      ? sizesParam.split(',').filter(Boolean)
      : Array.isArray(sizesParam)
        ? sizesParam.flatMap(s => s.split(',')).filter(Boolean)
        : [];
    if (sizes.length > 0) {
      filters.size = sizes;
    }
  }

  // Sub-subcategory filter
  const subSubCategoriesParam = searchParams.subSubCategories;
  if (subSubCategoriesParam) {
    const subSubCategoryIds = typeof subSubCategoriesParam === 'string'
      ? subSubCategoriesParam.split(',').filter(Boolean)
      : Array.isArray(subSubCategoriesParam)
        ? subSubCategoriesParam.flatMap(id => id.split(',')).filter(Boolean)
        : [];
    if (subSubCategoryIds.length > 0) {
      filters.subSubCategoryIds = subSubCategoryIds;
    }
  }

  // Price range
  const minPriceParam = searchParams.minPrice;
  const maxPriceParam = searchParams.maxPrice;

  if (minPriceParam) {
    const minPrice = typeof minPriceParam === 'string'
      ? parseFloat(minPriceParam)
      : Array.isArray(minPriceParam)
        ? parseFloat(minPriceParam[0])
        : undefined;
    if (!isNaN(minPrice!) && minPrice! > 0) {
      filters.minPrice = minPrice;
    }
  }
  if (maxPriceParam) {
    const maxPrice = typeof maxPriceParam === 'string'
      ? parseFloat(maxPriceParam)
      : Array.isArray(maxPriceParam)
        ? parseFloat(maxPriceParam[0])
        : undefined;
    if (!isNaN(maxPrice!) && maxPrice! > 0) {
      filters.maxPrice = maxPrice;
    }
  }

  // Sort option - map from URL params to internal sort values
  const sortParam = searchParams.sort;
  let sort: ProductSortOption = 'relevance';
  if (sortParam) {
    const sortValue = typeof sortParam === 'string' ? sortParam : Array.isArray(sortParam) ? sortParam[0] : '';
    if (sortValue === 'newest') {
      sort = 'newest';
    } else if (sortValue === 'price-low' || sortValue === 'priceAsc') {
      sort = 'priceAsc';
    } else if (sortValue === 'price-high' || sortValue === 'priceDesc') {
      sort = 'priceDesc';
    }
  }

  // Pagination
  const pageParam = searchParams.page;
  const page = pageParam
    ? (typeof pageParam === 'string' ? parseInt(pageParam) : Array.isArray(pageParam) ? parseInt(pageParam[0]) : 1)
    : 1;
  const pageSize = 24; // Mobile-first page size (24 products per page)

  // Validate page number
  const validatedPage = Number.isInteger(page) && page > 0 ? page : 1;

  return getFilteredProducts(filters, sort, { page: validatedPage, pageSize });
}

// Category Services
export const categoryService = {
  // Get all categories
  async getAllCategories(): Promise<Category[]> {
    try {
      console.log('Fetching all categories from Firebase...');
      const q = query(collection(db, 'categories'), orderBy('sortOrder', 'asc'));
      const querySnapshot = await getDocs(q);

      const categories = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];

      return categories;
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

  // Get category by slug (language-specific)
  async getCategoryBySlug(slug: string, language: 'en' | 'he' = 'en'): Promise<Category | null> {
    try {
      const q = query(
        collection(db, 'categories'),
        where(`slug.${language}`, '==', slug),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnapshot = querySnapshot.docs[0];
        return {
          id: docSnapshot.id,
          ...docSnapshot.data()
        } as Category;
      }
      return null;
    } catch (error) {
      console.error('Error fetching category by slug:', error);
      throw error;
    }
  },

  // Get category IDs from path (e.g., "women/shoes/pumps" -> returns all category IDs and the target level)
  // Returns an array of category IDs matching each segment of the path
  async getCategoryIdsFromPath(categoryPath: string, language: 'en' | 'he' = 'en'): Promise<{ categoryIds: string[]; targetLevel: number } | null> {
    try {
      const pathSegments = categoryPath.split('/').filter(Boolean);
      if (pathSegments.length === 0) {
        return null;
      }

      const categoryIds: string[] = [];

      // Resolve each segment to its category ID
      for (let i = 0; i < pathSegments.length; i++) {
        const segment = pathSegments[i];
        const expectedLevel = i; // Level 0, 1, or 2
        let category: Category | null = null;

        // First try: Query for category with this slug and level
        try {
          const q = query(
            collection(db, 'categories'),
            where(`slug.en`, '==', segment),
            where('level', '==', expectedLevel),
            limit(1)
          );
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const docSnapshot = querySnapshot.docs[0];
            category = {
              id: docSnapshot.id,
              ...docSnapshot.data()
            } as Category;
          }
        } catch (queryError) {
          // Continue to fallback
        }

        // Fallback 1: Try without level filter (in case level doesn't match)
        if (!category) {
          try {
            category = await this.getCategoryBySlug(segment, language);
          } catch (slugError) {
            // Continue to next fallback
          }
        }

        // Fallback 2: Try case-insensitive search by fetching all categories and matching manually
        if (!category) {
          try {
            const allCategories = await this.getAllCategories();
            const segmentLower = segment.toLowerCase();
            category = allCategories.find(cat => {
              const catSlug = typeof cat.slug === 'object'
                ? (cat.slug[language] || cat.slug.en || '')
                : (cat.slug || '');
              return catSlug.toLowerCase() === segmentLower &&
                (cat.level === expectedLevel || cat.level === undefined);
            }) || null;
          } catch (fallbackError) {
            // Continue
          }
        }

        if (category && category.id) {
          categoryIds.push(category.id);
        } else {
          return null;
        }
      }

      if (categoryIds.length === pathSegments.length) {
        return {
          categoryIds,
          targetLevel: pathSegments.length - 1 // The deepest level (0, 1, or 2)
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting category IDs from path:', error);
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
  async signIn(email: string, password: string): Promise<FirebaseUser> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  },

  // Sign up
  async signUp(email: string, password: string): Promise<FirebaseUser> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return userCredential.user;
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
  },

  // Note: end-user password reset has been removed (OTP-only auth).
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

// Color Variant Services
export const colorVariantService = {
  // Create color variant
  async createColorVariant(variantData: Omit<ColorVariant, 'id' | 'createdAt' | 'updatedAt' | 'images' | 'sizes'>): Promise<string> {
    try {
      const now = new Date();
      const variant = {
        ...variantData,
        images: [],
        sizes: [],
        createdAt: now,
        updatedAt: now
      };

      const docRef = await addDoc(collection(db, 'colorVariants'), variant);
      return docRef.id;
    } catch (error) {
      console.error('Error creating color variant:', error);
      throw error;
    }
  },

  // Update color variant
  async updateColorVariant(id: string, variantData: Partial<ColorVariant>): Promise<void> {
    try {
      const docRef = doc(db, 'colorVariants', id);
      await updateDoc(docRef, {
        ...variantData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating color variant:', error);
      throw error;
    }
  },

  // Delete color variant
  async deleteColorVariant(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'colorVariants', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting color variant:', error);
      throw error;
    }
  },

  // Add image to color variant
  async addColorVariantImage(variantId: string, imageData: Omit<ColorVariantImage, 'id' | 'createdAt'>): Promise<string> {
    try {
      const now = new Date();
      const image = {
        ...imageData,
        colorVariantId: variantId,
        createdAt: now
      };

      const docRef = await addDoc(collection(db, 'colorVariantImages'), image);
      return docRef.id;
    } catch (error) {
      console.error('Error adding color variant image:', error);
      throw error;
    }
  },

  // Update color variant image
  async updateColorVariantImage(id: string, imageData: Partial<ColorVariantImage>): Promise<void> {
    try {
      const docRef = doc(db, 'colorVariantImages', id);
      await updateDoc(docRef, imageData);
    } catch (error) {
      console.error('Error updating color variant image:', error);
      throw error;
    }
  },

  // Delete color variant image
  async deleteColorVariantImage(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'colorVariantImages', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting color variant image:', error);
      throw error;
    }
  },

  // Add size to color variant
  async addColorVariantSize(variantId: string, sizeData: Omit<ColorVariantSize, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const now = new Date();
      const size = {
        ...sizeData,
        colorVariantId: variantId,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await addDoc(collection(db, 'colorVariantSizes'), size);
      return docRef.id;
    } catch (error) {
      console.error('Error adding color variant size:', error);
      throw error;
    }
  },

  // Update color variant size
  async updateColorVariantSize(id: string, sizeData: Partial<ColorVariantSize>): Promise<void> {
    try {
      const docRef = doc(db, 'colorVariantSizes', id);
      await updateDoc(docRef, {
        ...sizeData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating color variant size:', error);
      throw error;
    }
  },

  // Delete color variant size
  async deleteColorVariantSize(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'colorVariantSizes', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting color variant size:', error);
      throw error;
    }
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

        // Note: Neon DB sync is handled by the API endpoint

        return existingDoc.id;
      } else {
        // Create new subscription
        const emailData: Omit<NewsletterEmail, 'id'> = {
          email,
          subscribedAt: new Date(),
          isActive: true
        };

        const docRef = await addDoc(collection(db, 'NewsletterEmails'), emailData);

        // Note: Neon DB sync is handled by the API endpoint

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

        // Note: Neon DB sync is handled by the API endpoint
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
  },

  // Alias for sync compatibility
  async getAllNewsletterEmails(): Promise<NewsletterEmail[]> {
    return this.getAllSubscribers();
  }
};

// Campaign Services
export const campaignService = {
  // Get all campaigns
  async getAllCampaigns(): Promise<Campaign[]> {
    try {
      const q = query(collection(db, 'campaigns'), orderBy('priority', 'desc'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        slug: doc.id,
        ...doc.data()
      } as Campaign));
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      throw error;
    }
  },

  // Get campaign by slug
  async getCampaignBySlug(slug: string): Promise<Campaign | null> {
    try {
      const docRef = doc(db, 'campaigns', slug);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return {
        id: docSnap.id,
        slug: docSnap.id,
        ...docSnap.data()
      } as Campaign;
    } catch (error) {
      console.error('Error fetching campaign:', error);
      throw error;
    }
  },

  // Get active campaign (highest priority active campaign within date range)
  async getActiveCampaign(): Promise<Campaign | null> {
    try {
      const now = new Date().toISOString();

      // Query for active campaigns
      const q = query(
        collection(db, 'campaigns'),
        where('active', '==', true),
        orderBy('priority', 'desc'),
        orderBy('startAt', 'desc')
      );

      const querySnapshot = await getDocs(q);

      // Filter by date range client-side (Firestore doesn't support multiple range queries easily)
      const campaigns = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          slug: doc.id,
          ...doc.data()
        } as Campaign))
        .filter(campaign => {
          // Check if campaign is within date range
          if (campaign.startAt && new Date(campaign.startAt) > new Date(now)) {
            return false; // Campaign hasn't started yet
          }
          if (campaign.endAt && new Date(campaign.endAt) < new Date(now)) {
            return false; // Campaign has ended
          }
          return true;
        });

      // Return the highest priority campaign
      return campaigns.length > 0 ? campaigns[0] : null;
    } catch (error) {
      console.error('Error fetching active campaign:', error);
      throw error;
    }
  },

  // Get products for a campaign based on productFilter
  async getCampaignProducts(campaign: Campaign): Promise<Product[]> {
    try {
      const { productFilter } = campaign;

      if (productFilter.mode === 'tag' && productFilter.tag) {
        // Tag-based selection
        let q: Query = query(
          collection(db, 'products'),
          where('tags', 'array-contains', productFilter.tag),
          where('isDeleted', '==', false),
          where('isEnabled', '==', true)
        );

        // Add ordering
        if (productFilter.orderBy) {
          const direction = productFilter.orderDirection === 'asc' ? 'asc' : 'desc';
          q = query(q, orderBy(productFilter.orderBy, direction));
        } else {
          q = query(q, orderBy('createdAt', 'desc'));
        }

        // Add limit
        if (productFilter.limit) {
          q = query(q, limit(productFilter.limit));
        }

        const querySnapshot = await getDocs(q);
        const products: Product[] = [];

        for (const docSnapshot of querySnapshot.docs) {
          const product = { id: docSnapshot.id, ...docSnapshot.data() } as Product;

          // Fetch category data if needed
          if (product.categoryId) {
            const categoryDoc = await getDoc(doc(db, 'categories', product.categoryId));
            if (categoryDoc.exists()) {
              product.categoryObj = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
            }
          }

          products.push(product);
        }

        return products;
      } else if (productFilter.mode === 'sale') {
        // All sale products
        let q: Query = query(
          collection(db, 'products'),
          where('salePrice', '>', 0),
          where('isDeleted', '==', false),
          where('isEnabled', '==', true)
        );

        // Add ordering
        if (productFilter.orderBy) {
          const direction = productFilter.orderDirection === 'asc' ? 'asc' : 'desc';
          q = query(q, orderBy(productFilter.orderBy, direction));
        } else {
          q = query(q, orderBy('createdAt', 'desc'));
        }

        // Add limit
        if (productFilter.limit) {
          q = query(q, limit(productFilter.limit));
        }

        const querySnapshot = await getDocs(q);
        const products: Product[] = [];

        for (const docSnapshot of querySnapshot.docs) {
          const product = { id: docSnapshot.id, ...docSnapshot.data() } as Product;

          if (product.categoryId) {
            const categoryDoc = await getDoc(doc(db, 'categories', product.categoryId));
            if (categoryDoc.exists()) {
              product.categoryObj = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
            }
          }

          products.push(product);
        }

        return products;
      } else if (productFilter.mode === 'manual' && campaign.productIds && campaign.productIds.length > 0) {
        // Manual selection - fetch products by IDs
        const products: Product[] = [];

        for (const productId of campaign.productIds) {
          try {
            const productDoc = await getDoc(doc(db, 'products', productId));
            if (productDoc.exists()) {
              const product = { id: productDoc.id, ...productDoc.data() } as Product;

              // Only include active, non-deleted products
              if (!product.isDeleted && product.isEnabled) {
                if (product.categoryId) {
                  const categoryDoc = await getDoc(doc(db, 'categories', product.categoryId));
                  if (categoryDoc.exists()) {
                    product.categoryObj = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
                  }
                }

                products.push(product);
              }
            }
          } catch (error) {
            console.warn(`Error fetching product ${productId}:`, error);
          }
        }

        return products;
      }

      return [];
    } catch (error) {
      console.error('Error fetching campaign products:', error);
      throw error;
    }
  },

  // Create campaign
  async createCampaign(campaignData: Omit<Campaign, 'id'>): Promise<string> {
    try {
      const now = new Date().toISOString();
      const docRef = doc(db, 'campaigns', campaignData.slug);

      const { slug, ...data } = campaignData;

      // Remove undefined values and empty optional objects
      const cleanData: any = {
        slug: slug,
        title: data.title,
        active: data.active,
        priority: data.priority,
        productFilter: data.productFilter,
        createdAt: now,
        updatedAt: now
      };

      // Only include optional fields if they have values
      if (data.subtitle && (data.subtitle.en || data.subtitle.he)) {
        cleanData.subtitle = data.subtitle;
      }
      if (data.description && (data.description.en || data.description.he)) {
        cleanData.description = data.description;
      }
      if (data.seoTitle && (data.seoTitle.en || data.seoTitle.he)) {
        cleanData.seoTitle = data.seoTitle;
      }
      if (data.seoDescription && (data.seoDescription.en || data.seoDescription.he)) {
        cleanData.seoDescription = data.seoDescription;
      }
      if (data.bannerDesktopUrl) {
        cleanData.bannerDesktopUrl = data.bannerDesktopUrl;
      }
      if (data.bannerMobileUrl) {
        cleanData.bannerMobileUrl = data.bannerMobileUrl;
      }
      if (data.bannerDesktopVideoUrl) {
        cleanData.bannerDesktopVideoUrl = data.bannerDesktopVideoUrl;
      }
      if (data.bannerMobileVideoUrl) {
        cleanData.bannerMobileVideoUrl = data.bannerMobileVideoUrl;
      }
      if (data.startAt) {
        cleanData.startAt = data.startAt;
      }
      if (data.endAt) {
        cleanData.endAt = data.endAt;
      }
      if (data.productIds && data.productIds.length > 0) {
        cleanData.productIds = data.productIds;
      }

      await setDoc(docRef, cleanData);

      return docRef.id;
    } catch (error) {
      console.error('Error creating campaign:', error);
      throw error;
    }
  },

  // Update campaign
  async updateCampaign(slug: string, campaignData: Partial<Campaign>): Promise<void> {
    try {
      const docRef = doc(db, 'campaigns', slug);

      // Build update data, removing undefined values
      const updateData: any = {
        updatedAt: new Date().toISOString()
      };

      // Only include fields that are actually provided (not undefined)
      if (campaignData.slug !== undefined) updateData.slug = campaignData.slug;
      if (campaignData.title !== undefined) updateData.title = campaignData.title;
      if (campaignData.subtitle !== undefined) {
        // Only include if it has at least one non-empty value
        if (campaignData.subtitle && (campaignData.subtitle.en || campaignData.subtitle.he)) {
          updateData.subtitle = campaignData.subtitle;
        } else {
          // If empty, we can delete it by setting to null (or omit it)
          // For now, we'll omit it - Firestore will keep the old value
        }
      }
      if (campaignData.description !== undefined) {
        if (campaignData.description && (campaignData.description.en || campaignData.description.he)) {
          updateData.description = campaignData.description;
        }
      }
      if (campaignData.seoTitle !== undefined) {
        if (campaignData.seoTitle && (campaignData.seoTitle.en || campaignData.seoTitle.he)) {
          updateData.seoTitle = campaignData.seoTitle;
        }
      }
      if (campaignData.seoDescription !== undefined) {
        if (campaignData.seoDescription && (campaignData.seoDescription.en || campaignData.seoDescription.he)) {
          updateData.seoDescription = campaignData.seoDescription;
        }
      }
      if (campaignData.bannerDesktopUrl !== undefined) {
        updateData.bannerDesktopUrl = campaignData.bannerDesktopUrl || null;
      }
      if (campaignData.bannerMobileUrl !== undefined) {
        updateData.bannerMobileUrl = campaignData.bannerMobileUrl || null;
      }
      if (campaignData.bannerDesktopVideoUrl !== undefined) {
        updateData.bannerDesktopVideoUrl = campaignData.bannerDesktopVideoUrl || null;
      }
      if (campaignData.bannerMobileVideoUrl !== undefined) {
        updateData.bannerMobileVideoUrl = campaignData.bannerMobileVideoUrl || null;
      }
      if (campaignData.active !== undefined) updateData.active = campaignData.active;
      if (campaignData.priority !== undefined) updateData.priority = campaignData.priority;
      if (campaignData.startAt !== undefined) {
        updateData.startAt = campaignData.startAt || null;
      }
      if (campaignData.endAt !== undefined) {
        updateData.endAt = campaignData.endAt || null;
      }
      if (campaignData.productFilter !== undefined) updateData.productFilter = campaignData.productFilter;
      if (campaignData.productIds !== undefined) {
        updateData.productIds = campaignData.productIds && campaignData.productIds.length > 0
          ? campaignData.productIds
          : null;
      }

      // Remove id if present
      delete updateData.id;

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating campaign:', error);
      throw error;
    }
  },

  // Toggle campaign active status
  async toggleCampaignActive(slug: string, active: boolean): Promise<void> {
    try {
      const docRef = doc(db, 'campaigns', slug);
      await updateDoc(docRef, {
        active,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error toggling campaign active status:', error);
      throw error;
    }
  },

  // Delete campaign
  async deleteCampaign(slug: string): Promise<void> {
    try {
      const docRef = doc(db, 'campaigns', slug);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting campaign:', error);
      throw error;
    }
  }
}; 