// Import the functions you need from the SDKs you need
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAnalytics, logEvent as firebaseLogEvent, Analytics } from "firebase/analytics";
import { getFirestore, Firestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, setDoc, deleteDoc, query, where, orderBy, limit, startAfter, onSnapshot, Query, Unsubscribe, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { getAuth, Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getStorage, FirebaseStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import type { CampaignMerchandising } from '@/lib/campaign-merchandising-types';
import {
  defaultCampaignMerchandising,
  parseVariantKey,
  MERCHANDISING_COLLECTION,
} from '@/lib/campaign-merchandising-types';
import {
  parseFacetFiltersFromSearchParams,
  parsePageFromSearchParams,
  parseSortFromSearchParams,
  productMatchesListingFilters,
} from '@/lib/collectionFilters';
import {
  inStockSizeKeysFromVariant,
  variantHasSizeInStock,
} from '@/lib/product-size';
import { getBaseSku } from '@/lib/sku-parser';
import type {
  Product,
  ColorVariant,
  ColorVariantImage,
  ColorVariantSize,
  VariantItem,
} from '@/lib/product-types';
import { productHelpers } from '@/lib/product-types';

export type {
  Product,
  ColorVariant,
  ColorVariantImage,
  ColorVariantSize,
  VariantItem,
} from '@/lib/product-types';
export { productHelpers } from '@/lib/product-types';

export { productMatchesListingFilters } from '@/lib/collectionFilters';

export type MerchandisingMode = 'auto' | 'pinned' | 'manual';

export const CATEGORY_MERCHANDISING_COLLECTION = 'categoryMerchandising';

export type CategoryMerchandising = {
  categoryId: string;
  mode: MerchandisingMode;
  orderedVariantKeys: string[];
  updatedAt: string;
  updatedBy?: string;
  version: number;
};

export function defaultCategoryMerchandising(categoryId: string): CategoryMerchandising {
  return {
    categoryId,
    mode: 'auto',
    orderedVariantKeys: [],
    updatedAt: new Date().toISOString(),
    version: 1,
  };
}

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

/** Lazily initialized on first call (not at module import). */
export function getClientAnalytics(): Analytics | null {
  return getAnalyticsInstance();
}

// Export Firebase instances (app, db, auth, storage are lazy via proxy)
export { app, db, auth, storage };

/** Use with modular API: logEvent(analytics, 'event_name', params). No-op if analytics is null. */
export function logEvent(
  analyticsInstance: Analytics | null | undefined,
  eventName: string,
  params?: Record<string, unknown>
): void {
  const instance = analyticsInstance ?? getAnalyticsInstance();
  if (instance) {
    try {
      firebaseLogEvent(instance, eventName, params);
    } catch (e) {
      console.warn('Analytics logEvent error:', e);
    }
  }
}



// Types
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
  contentTitle?: LocalizedString;
  seoTitle?: LocalizedString;
  seoDescription?: LocalizedString;
  seoContent?: LocalizedString;
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

export type BlogArticleStatus = 'draft' | 'published';

// Only 'random' is implemented today; other modes are reserved so the schema
// doesn't need to change when manual/bestsellers/new-arrivals/custom selection
// modes are added later (mirrors CampaignProductFilterMode above).
export type RelatedProductsSelectionMode =
  | 'random'
  | 'manual'
  | 'bestsellers'
  | 'new-arrivals'
  | 'custom';

export interface RelatedProductsCarouselConfig {
  enabled: boolean;
  mode: RelatedProductsSelectionMode;
  categoryIds: string[]; // hierarchical path, e.g. [womenId, shoesId, oxfordId]
  maxProducts: number;
}

export interface BlogArticle {
  id: string;
  slug: string;
  title: LocalizedString;
  excerpt: LocalizedString;
  content: LocalizedString;
  featuredImage: string;
  featuredImageAlt: LocalizedString;
  status: BlogArticleStatus;
  publishedAt: string;
  seoTitle?: LocalizedString;
  seoDescription?: LocalizedString;
  ogTitle?: LocalizedString;
  ogDescription?: LocalizedString;
  ogImage?: string;
  canonicalUrl?: string;
  relatedProductsCarousel?: RelatedProductsCarouselConfig;
  createdAt: string;
  updatedAt: string;
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

export type {
  CampaignMerchandising,
  CampaignMerchandisingMode,
} from '@/lib/campaign-merchandising-types';

export {
  defaultCampaignMerchandising,
  parseVariantKey,
} from '@/lib/campaign-merchandising-types';

export type AdminProductFilter = 'all' | 'featured' | 'new' | 'active' | 'inactive';

export const ADMIN_PRODUCTS_PAGE_SIZE = 25;
const ADMIN_FIRESTORE_BATCH_SIZE = 75;

export function productMatchesAdminFilter(
  product: Product,
  filter: AdminProductFilter = 'all'
): boolean {
  if (filter === 'all') return true;

  const isFeatured = product.featuredProduct ?? product.featured ?? false;
  const isNew = product.newProduct ?? product.isNew ?? false;
  const isActive = product.isEnabled ?? product.isActive ?? false;

  switch (filter) {
    case 'featured':
      return isFeatured;
    case 'new':
      return isNew;
    case 'active':
      return isActive;
    case 'inactive':
      return !isActive;
    default:
      return true;
  }
}

function productMatchesAdminSearch(product: Product, term: string): boolean {
  if (!term) return true;

  const haystacks = [
    product.sku,
    product.baseSku,
    product.title_en,
    product.title_he,
    product.brand,
    productHelpers.getField(product, 'name', 'en'),
    productHelpers.getField(product, 'name', 'he'),
    productHelpers.getField(product, 'slug', 'en'),
    productHelpers.getField(product, 'slug', 'he'),
    ...(product.searchKeywords ?? []),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return haystacks.some((value) => value.includes(term));
}

function mapProductDoc(docSnapshot: QueryDocumentSnapshot<DocumentData>): Product {
  return { id: docSnapshot.id, ...docSnapshot.data() } as Product;
}

async function collectFilteredProducts(
  filter: AdminProductFilter,
  searchTerm?: string
): Promise<Product[]> {
  const term = searchTerm?.trim().toLowerCase() ?? '';
  const matches: Product[] = [];
  let lastDoc: QueryDocumentSnapshot<DocumentData> | undefined;

  while (true) {
    const constraints: Parameters<typeof query>[1][] = [orderBy('createdAt', 'desc')];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    constraints.push(limit(ADMIN_FIRESTORE_BATCH_SIZE));

    const snapshot = await getDocs(query(collection(db, 'products'), ...constraints));
    if (snapshot.empty) break;

    for (const docSnapshot of snapshot.docs) {
      const product = mapProductDoc(docSnapshot);
      if (!productMatchesAdminFilter(product, filter)) continue;
      if (term && !productMatchesAdminSearch(product, term)) continue;
      matches.push(product);
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < ADMIN_FIRESTORE_BATCH_SIZE) break;
  }

  return matches;
}

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

  async getProductsPage(options?: {
    pageSize?: number;
    cursorId?: string | null;
    page?: number;
    filter?: AdminProductFilter;
  }): Promise<{
    products: Product[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const pageSize = options?.pageSize ?? ADMIN_PRODUCTS_PAGE_SIZE;
    const filter = options?.filter ?? 'all';

    if (filter !== 'all') {
      const page = Math.max(1, options?.page ?? 1);
      const allMatches = await collectFilteredProducts(filter);
      const start = (page - 1) * pageSize;
      const products = allMatches.slice(start, start + pageSize);
      return {
        products,
        nextCursor: null,
        hasMore: start + pageSize < allMatches.length,
      };
    }

    const constraints: Parameters<typeof query>[1][] = [orderBy('createdAt', 'desc')];

    if (options?.cursorId) {
      const cursorSnap = await getDoc(doc(db, 'products', options.cursorId));
      if (cursorSnap.exists()) {
        constraints.push(startAfter(cursorSnap));
      }
    }

    constraints.push(limit(pageSize + 1));

    const snapshot = await getDocs(query(collection(db, 'products'), ...constraints));
    const hasMore = snapshot.docs.length > pageSize;
    const pageDocs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
    const products = pageDocs.map(mapProductDoc);
    const nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    return { products, nextCursor, hasMore };
  },

  async searchProducts(
    searchQuery: string,
    options?: {
      page?: number;
      pageSize?: number;
      filter?: AdminProductFilter;
    }
  ): Promise<{
    products: Product[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const trimmed = searchQuery.trim();
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = options?.pageSize ?? ADMIN_PRODUCTS_PAGE_SIZE;
    const filter = options?.filter ?? 'all';

    if (!trimmed) {
      return { products: [], total: 0, page: 1, totalPages: 0 };
    }

    const baseSku = getBaseSku(trimmed);
    const skuCandidates = Array.from(new Set([baseSku, trimmed].filter(Boolean)));

    for (const sku of skuCandidates) {
      const skuProduct = await productService.getProductBySku(sku);
      if (skuProduct && productMatchesAdminFilter(skuProduct, filter)) {
        return { products: [skuProduct], total: 1, page: 1, totalPages: 1 };
      }
    }

    const matches = await collectFilteredProducts(filter, trimmed);
    const total = matches.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const products = matches.slice(start, start + pageSize);

    return { products, total, page, totalPages };
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
  tag?: string; // Campaign: products with this tag (array-contains)
};

export type ProductSortOption = 'relevance' | 'newest' | 'priceAsc' | 'priceDesc';

export type PaginationOptions = {
  page?: number;
  pageSize?: number;
  lastDocument?: QueryDocumentSnapshot<DocumentData>;
};

export type FilteredProductsResult = {
  products: Product[]; // Keep for backward compatibility
  variantItems?: VariantItem[]; // New: explicit variant items (one per color variant)
  hasMore: boolean;
  total: number;  // Total matching variants (if variantItems) or products (if products)
  page: number;   // Current page number
  pageSize: number; // Page size used
  lastDocument?: QueryDocumentSnapshot<DocumentData>;
  /** Stable filter options from full collection (not from filtered result) so UI list does not collapse */
  availableFilterOptions?: {
    colors: string[];
    sizes: string[];
    subSubCategoryIds?: string[];
  };
};

/**
 * Options for filtering which variants are expanded into variant items.
 * When provided, only variants matching these filters are included (AND between color and size).
 */
export type ExpandProductsToVariantsOptions = {
  colorSlugs?: string[];
  sizes?: string[];
};

/**
 * Expand products into variant items (one item per active color variant)
 * Each variant item represents a single color variant that should be displayed as its own card.
 * When options are provided, only variants matching the color/size filters are included.
 */
export function expandProductsToVariants(
  products: Product[],
  options?: ExpandProductsToVariantsOptions
): VariantItem[] {
  const variantItems: VariantItem[] = [];
  const colorSlugs = options?.colorSlugs?.length ? options.colorSlugs : undefined;
  const sizes = options?.sizes?.length ? options.sizes : undefined;

  for (const product of products) {
    if (!product.colorVariants || Object.keys(product.colorVariants).length === 0) {
      // Product with no variants - skip (products without variants won't be displayed)
      continue;
    }

    // Get all active variants
    let activeVariants = Object.values(product.colorVariants)
      .filter(v => v.isActive !== false);

    // Apply variant-level filters when options are provided
    if (colorSlugs) {
      activeVariants = activeVariants.filter(
        v => v.colorSlug && colorSlugs.includes(v.colorSlug)
      );
    }
    if (sizes) {
      activeVariants = activeVariants.filter((v) =>
        variantHasSizeInStock(v, sizes)
      );
    }

    // Create one VariantItem per matching variant
    for (const variant of activeVariants) {
      if (!variant.colorSlug) continue; // Skip variants without color slug

      variantItems.push({
        product,
        variant,
        variantKey: `${product.id || product.sku}-${variant.colorSlug}`
      });
    }
  }

  return variantItems;
}

/**
 * When product has no embedded colorVariants, load them from the colorVariants collection
 * (supports legacy product structure so collection page can show one card per color).
 */
async function loadColorVariantsForProduct(product: Product): Promise<void> {
  if (product.colorVariants && Object.keys(product.colorVariants).length > 0) {
    return;
  }
  try {
    const colorVariantsQuery = query(
      collection(db, 'colorVariants'),
      where('productId', '==', product.id),
      orderBy('createdAt', 'asc')
    );
    const colorVariantsSnapshot = await getDocs(colorVariantsQuery);
    product.colorVariants = {};
    for (const variantDoc of colorVariantsSnapshot.docs) {
      const variant = { id: variantDoc.id, ...variantDoc.data() } as ColorVariant;
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
      const sizesQuery = query(
        collection(db, 'colorVariantSizes'),
        where('colorVariantId', '==', variant.id),
        orderBy('size', 'asc')
      );
      const sizesSnapshot = await getDocs(sizesQuery);
      variant.sizes = sizesSnapshot.docs.map(sizeDoc => ({
        id: sizeDoc.id,
        ...sizeDoc.data()
      } as ColorVariantSize));
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
    console.warn('Failed to load color variants for product', product.id, error);
    product.colorVariants = {};
  }
}

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

    // Tag-based filtering (campaign): alternative to category; when set, skip category constraints
    if (filters.tag) {
      constraints.push(where('tags', 'array-contains', filters.tag));
    }

    // Category filtering using categories_path_id with dot notation for array index matching
    // Firestore supports querying array elements by index using dot notation
    // Note: Arrays are 0-indexed, so we use .0, .1, .2 for indices 0, 1, 2
    if (!filters.tag && filters.categoryIds && filters.categoryIds.length > 0) {
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
    } else if (!filters.tag && filters.categoryId && filters.categoryLevel !== undefined) {
      // Use array-contains to get products that have this category ID in their path
      // We'll filter by exact level client-side
      constraints.push(where('categories_path_id', 'array-contains', filters.categoryId));
    } else if (!filters.tag && filters.categoryPath) {
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

    // Process results - hydrate variants in parallel batches, then enrich categories
    const docs = querySnapshot.docs;
    const hydratedProducts = await hydrateProductsForListing(docs);

    await Promise.all(
      hydratedProducts.map(async (product) => {
        if (!product.categoryId) return;
        try {
          const categoryDoc = await getDoc(doc(db, 'categories', product.categoryId));
          if (categoryDoc.exists()) {
            product.categoryObj = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
          }
        } catch (err) {
          console.warn(`Failed to fetch category for product ${product.id}:`, err);
        }
      })
    );

    products.push(...hydratedProducts);
    if (docs.length > 0) {
      lastDoc = docs[docs.length - 1];
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

    // Size filtering (client-side): variant must have at least one selected size with stock > 0
    if (filters.size && (Array.isArray(filters.size) ? filters.size.length > 0 : true)) {
      const sizeSet = new Set(
        (Array.isArray(filters.size) ? filters.size : [filters.size]).map((s) => String(s).trim()).filter(Boolean)
      );
      filteredProducts = filteredProducts.filter((product) => {
        if (!product.colorVariants) return false;
        return Object.values(product.colorVariants)
          .filter(variant => variant.isActive !== false)
          .some((variant) => {
            const stockBySize = variant.stockBySize || {};
            return Array.from(sizeSet).some((sizeKey) => {
              const qty = stockBySize[sizeKey];
              return typeof qty === 'number' && qty > 0;
            });
          });
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

        // Exclude if any variant price exceeds maxPrice
        const maxVariantPrice = Math.max(...variantPrices);
        return maxVariantPrice <= filters.maxPrice!;
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

const LISTING_PAGE_SIZE = 24;
const LISTING_FIRESTORE_BATCH_SIZE = 75;

function buildFirestoreProductConstraints(
  filters: ProductFilters,
  sort: ProductSortOption
): any[] {
  const constraints: any[] = [];

  constraints.push(where('isEnabled', '==', true));
  constraints.push(where('isDeleted', '==', false));

  if (filters.tag) {
    constraints.push(where('tags', 'array-contains', filters.tag));
  }

  if (!filters.tag && filters.categoryIds && filters.categoryIds.length > 0) {
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
  } else if (!filters.tag && filters.categoryId && filters.categoryLevel !== undefined) {
    constraints.push(where('categories_path_id', 'array-contains', filters.categoryId));
  } else if (!filters.tag && filters.categoryPath) {
    const categoryPathLower = filters.categoryPath.toLowerCase();
    const pathSegments = categoryPathLower.split('/');
    if (pathSegments.length > 0) {
      constraints.push(where('categories_path', 'array-contains', pathSegments[0]));
    }
  }

  if (filters.isOutlet) {
    constraints.push(where('salePrice', '>', 0));
  }

  if (filters.isOnSaleOnly) {
    constraints.push(where('salePrice', '>', 0));
  }

  if (filters.includeSkus && filters.includeSkus.length > 0 && filters.includeSkus.length <= 10) {
    constraints.push(where('sku', 'in', filters.includeSkus));
  }

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
      constraints.push(orderBy('createdAt', 'desc'));
      break;
  }

  return constraints;
}

async function hydrateProductsForListing(
  docSnapshots: QueryDocumentSnapshot<DocumentData>[]
): Promise<Product[]> {
  const products = docSnapshots.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...docSnapshot.data(),
  })) as Product[];

  const needsVariantLoad = products.filter(
    (product) => !product.colorVariants || Object.keys(product.colorVariants).length === 0
  );
  const concurrency = 8;
  for (let i = 0; i < needsVariantLoad.length; i += concurrency) {
    await Promise.all(
      needsVariantLoad
        .slice(i, i + concurrency)
        .map((product) => loadColorVariantsForProduct(product))
    );
  }

  return products;
}

function getVariantPriceForSort(item: VariantItem): number {
  if (item.variant.salePrice && item.variant.salePrice > 0) return item.variant.salePrice;
  if (item.product.salePrice && item.product.salePrice > 0) return item.product.salePrice;
  if (item.variant.priceOverride && item.variant.priceOverride > 0) return item.variant.priceOverride;
  return item.product.price;
}

function sortVariantItemsForListing(
  items: VariantItem[],
  sort: ProductSortOption
): VariantItem[] {
  const sorted = [...items];
  if (sort === 'priceAsc' || sort === 'priceDesc') {
    sorted.sort((a, b) => {
      const priceA = getVariantPriceForSort(a);
      const priceB = getVariantPriceForSort(b);
      return sort === 'priceAsc' ? priceA - priceB : priceB - priceA;
    });
  } else if (sort === 'newest') {
    sorted.sort((a, b) => {
      const dateA = a.product.createdAt ? new Date(a.product.createdAt).getTime() : 0;
      const dateB = b.product.createdAt ? new Date(b.product.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }
  return sorted;
}

function collectFacetOptionsFromProduct(
  product: Product,
  colorSlugs: Set<string>,
  sizes: Set<string>,
  subSubCategoryIds: Set<string>
): void {
  if (
    product.categories_path_id &&
    product.categories_path_id.length >= 3 &&
    product.categories_path_id[2]
  ) {
    subSubCategoryIds.add(product.categories_path_id[2]);
  }

  if (!product.colorVariants) {
    return;
  }

  for (const variant of Object.values(product.colorVariants)) {
    if (variant.isActive === false) {
      continue;
    }
    if (variant.colorSlug) {
      colorSlugs.add(variant.colorSlug);
    }
    for (const sizeKey of inStockSizeKeysFromVariant(variant)) {
      sizes.add(sizeKey);
    }
  }
}

function buildAvailableFilterOptions(
  colorSlugs: Set<string>,
  sizes: Set<string>,
  subSubCategoryIds: Set<string>
): { colors: string[]; sizes: string[]; subSubCategoryIds: string[] } {
  return {
    colors: [...colorSlugs].sort(),
    sizes: [...sizes].sort((a, b) => {
      const aNum = parseFloat(a);
      const bNum = parseFloat(b);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
      return String(a).localeCompare(String(b));
    }),
    subSubCategoryIds: [...subSubCategoryIds].sort(),
  };
}

type ResolveListingVariantPageOptions = {
  filters: ProductFilters;
  sort: ProductSortOption;
  page: number;
  pageSize?: number;
  productLimit?: number;
};

async function resolveListingVariantPage(
  options: ResolveListingVariantPageOptions
): Promise<FilteredProductsResult> {
  const { filters, sort, page, productLimit } = options;
  const pageSize = options.pageSize ?? LISTING_PAGE_SIZE;
  const validatedPage = Number.isInteger(page) && page > 0 ? page : 1;
  const startIndex = (validatedPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const filtersNoColorSize = { ...filters, color: undefined, size: undefined };
  const normalizedColors = filters.color
    ? (Array.isArray(filters.color) ? filters.color : [filters.color]).filter(Boolean)
    : undefined;
  const normalizedSizes = filters.size
    ? (Array.isArray(filters.size) ? filters.size : [filters.size]).filter(Boolean)
    : undefined;
  const expandOptions =
    normalizedColors || normalizedSizes
      ? { colorSlugs: normalizedColors, sizes: normalizedSizes }
      : undefined;

  const colorFacetSet = new Set<string>();
  const sizeFacetSet = new Set<string>();
  const subSubFacetSet = new Set<string>();
  const pageVariantItems: VariantItem[] = [];
  const priceSortItems: VariantItem[] = [];
  let variantIndex = 0;
  let matchedProductCount = 0;
  let facetProductCount = 0;
  const usePriceSort = sort === 'priceAsc' || sort === 'priceDesc';

  let baseConstraints = buildFirestoreProductConstraints(filters, sort);
  let useCategoryPathFallback = false;
  let lastDoc: QueryDocumentSnapshot<DocumentData> | undefined;

  while (true) {
    const pageConstraints = [...baseConstraints];
    if (lastDoc) {
      pageConstraints.push(startAfter(lastDoc));
    }
    pageConstraints.push(limit(LISTING_FIRESTORE_BATCH_SIZE));

    let snapshot;
    try {
      snapshot = await getDocs(query(collection(db, 'products'), ...pageConstraints));
    } catch (queryError: any) {
      if (
        !useCategoryPathFallback &&
        filters.categoryPath &&
        queryError?.code === 'failed-precondition'
      ) {
        useCategoryPathFallback = true;
        baseConstraints = buildFirestoreProductConstraints(
          { ...filters, categoryPath: undefined },
          sort
        );
        lastDoc = undefined;
        continue;
      }
      throw queryError;
    }

    if (snapshot.empty) {
      break;
    }

    const products = await hydrateProductsForListing(snapshot.docs);
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    for (const product of products) {
      if (productMatchesListingFilters(product, filtersNoColorSize)) {
        if (!productLimit || facetProductCount < productLimit) {
          collectFacetOptionsFromProduct(
            product,
            colorFacetSet,
            sizeFacetSet,
            subSubFacetSet
          );
          facetProductCount += 1;
        }
      }

      if (!productMatchesListingFilters(product, filters)) {
        continue;
      }

      if (productLimit && productLimit > 0 && matchedProductCount >= productLimit) {
        continue;
      }
      matchedProductCount += 1;

      const variantItems = expandProductsToVariants([product], expandOptions);
      if (usePriceSort) {
        priceSortItems.push(...variantItems);
        continue;
      }

      for (const item of variantItems) {
        if (variantIndex >= startIndex && variantIndex < endIndex) {
          pageVariantItems.push(item);
        }
        variantIndex += 1;
      }
    }

    if (snapshot.docs.length < LISTING_FIRESTORE_BATCH_SIZE) {
      break;
    }
  }

  let totalVariants: number;
  let paginatedVariantItems: VariantItem[];

  if (usePriceSort) {
    const sortedVariantItems = sortVariantItemsForListing(priceSortItems, sort);
    totalVariants = sortedVariantItems.length;
    paginatedVariantItems = sortedVariantItems.slice(startIndex, endIndex);
  } else {
    totalVariants = variantIndex;
    paginatedVariantItems = pageVariantItems;
  }

  const hasMore = endIndex < totalVariants;
  const uniqueProducts = new Map<string, Product>();
  paginatedVariantItems.forEach((item) => {
    const productId = item.product.id || item.product.sku;
    if (!uniqueProducts.has(productId)) {
      uniqueProducts.set(productId, item.product);
    }
  });

  return {
    products: Array.from(uniqueProducts.values()),
    variantItems: paginatedVariantItems,
    hasMore,
    total: totalVariants,
    page: validatedPage,
    pageSize,
    lastDocument: lastDoc,
    availableFilterOptions: buildAvailableFilterOptions(
      colorFacetSet,
      sizeFacetSet,
      subSubFacetSet
    ),
  };
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
  let deepestCategoryId: string | undefined;

  // Category filtering: resolve all category IDs from path
  if (categoryPath) {
    try {
      const categoryInfo = await categoryService.getCategoryIdsFromPath(categoryPath, language);
      if (categoryInfo && categoryInfo.categoryIds.length > 0) {
        filters.categoryIds = categoryInfo.categoryIds;
        deepestCategoryId = categoryInfo.categoryIds[categoryInfo.categoryIds.length - 1];
      } else {
        // Fallback to path-based filtering if category not found
        filters.categoryPath = categoryPath;
      }
    } catch (error) {
      // Fallback to path-based filtering
      filters.categoryPath = categoryPath;
    }
  }

  Object.assign(filters, parseFacetFiltersFromSearchParams(searchParams));

  const sort = parseSortFromSearchParams(searchParams);
  const page = parsePageFromSearchParams(searchParams);

  const useMerchandising = sort === 'relevance';
  if (useMerchandising && deepestCategoryId) {
    const merchandising = await getCategoryMerchandising(deepestCategoryId);
    if (merchandising.mode !== 'auto') {
      return resolveCategoryMerchandisedVariantPage({
        categoryId: deepestCategoryId,
        merchandising,
        filters,
        page,
        pageSize: LISTING_PAGE_SIZE,
      });
    }
  }

  return resolveListingVariantPage({
    filters,
    sort,
    page,
    pageSize: LISTING_PAGE_SIZE,
  });
}

/** Read per-campaign merchandising config (defaults to auto when missing). */
export async function getCampaignMerchandising(campaignSlug: string): Promise<CampaignMerchandising> {
  try {
    const snap = await getDoc(doc(db, MERCHANDISING_COLLECTION, campaignSlug));
    if (!snap.exists()) {
      return defaultCampaignMerchandising(campaignSlug);
    }
    const data = snap.data() as Partial<CampaignMerchandising>;
    return {
      campaignSlug,
      mode: data.mode ?? 'auto',
      orderedVariantKeys: Array.isArray(data.orderedVariantKeys) ? data.orderedVariantKeys : [],
      updatedAt: data.updatedAt ?? new Date().toISOString(),
      updatedBy: data.updatedBy,
      version: data.version ?? 1,
    };
  } catch (error) {
    console.error('Error fetching campaign merchandising:', error);
    return defaultCampaignMerchandising(campaignSlug);
  }
}

/** Read per-category merchandising config (defaults to auto when missing). */
export async function getCategoryMerchandising(categoryId: string): Promise<CategoryMerchandising> {
  try {
    const snap = await getDoc(doc(db, CATEGORY_MERCHANDISING_COLLECTION, categoryId));
    if (!snap.exists()) {
      return defaultCategoryMerchandising(categoryId);
    }
    const data = snap.data() as Partial<CategoryMerchandising>;
    return {
      categoryId,
      mode: (data.mode as MerchandisingMode) ?? 'auto',
      orderedVariantKeys: Array.isArray(data.orderedVariantKeys) ? data.orderedVariantKeys : [],
      updatedAt: data.updatedAt ?? new Date().toISOString(),
      updatedBy: data.updatedBy,
      version: data.version ?? 1,
    };
  } catch (error) {
    console.error('Error fetching category merchandising:', error);
    return defaultCategoryMerchandising(categoryId);
  }
}

function sortProductsForCampaignAuto(
  products: Product[],
  orderBy: CampaignProductFilter['orderBy'] = 'createdAt',
  orderDirection: CampaignProductFilter['orderDirection'] = 'desc'
): Product[] {
  const dir = orderDirection === 'asc' ? 1 : -1;
  const sorted = [...products];
  sorted.sort((a, b) => {
    if (orderBy === 'salePrice') {
      const priceA = a.salePrice && a.salePrice > 0 ? a.salePrice : a.price;
      const priceB = b.salePrice && b.salePrice > 0 ? b.salePrice : b.price;
      return (priceA - priceB) * dir;
    }
    const dateA = a.createdAt ? new Date(a.createdAt as string | Date).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt as string | Date).getTime() : 0;
    return (dateA - dateB) * dir;
  });
  return sorted;
}

function variantItemMatchesFilters(item: VariantItem, filters: ProductFilters): boolean {
  const productFilters: ProductFilters = {
    ...filters,
    color: undefined,
    size: undefined,
    minPrice: undefined,
    maxPrice: undefined,
  };
  if (!productMatchesListingFilters(item.product, productFilters)) {
    return false;
  }

  if (filters.color && (Array.isArray(filters.color) ? filters.color.length > 0 : true)) {
    const colors = Array.isArray(filters.color) ? filters.color : [filters.color];
    if (!colors.includes(item.variant.colorSlug || '')) {
      return false;
    }
  }

  if (filters.size && (Array.isArray(filters.size) ? filters.size.length > 0 : true)) {
    const sizes = Array.isArray(filters.size) ? filters.size : [filters.size];
    if (!variantHasSizeInStock(item.variant, sizes)) {
      return false;
    }
  }

  const price = getVariantPriceForSort(item);
  if (filters.minPrice !== undefined && filters.minPrice > 0 && price < filters.minPrice) {
    return false;
  }
  if (filters.maxPrice !== undefined && filters.maxPrice > 0 && price > filters.maxPrice) {
    return false;
  }

  return true;
}

async function fetchVariantItemsByKeys(
  keys: string[],
  expandOptions?: ExpandProductsToVariantsOptions
): Promise<VariantItem[]> {
  if (keys.length === 0) return [];

  const productIds = [
    ...new Set(
      keys
        .map((key) => parseVariantKey(key)?.productId)
        .filter((id): id is string => !!id)
    ),
  ];

  const productMap = new Map<string, Product>();
  const chunkSize = 30;
  for (let i = 0; i < productIds.length; i += chunkSize) {
    const chunk = productIds.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (productId) => {
        try {
          const snap = await getDoc(doc(db, 'products', productId));
          if (!snap.exists()) return;
          const product = { id: snap.id, ...snap.data() } as Product;
          if (product.isDeleted || product.isEnabled === false) return;
          await loadColorVariantsForProduct(product);
          productMap.set(productId, product);
        } catch (error) {
          console.warn(`Error fetching product ${productId} for merchandising:`, error);
        }
      })
    );
  }

  const items: VariantItem[] = [];
  for (const key of keys) {
    const parsed = parseVariantKey(key);
    if (!parsed) continue;
    const product = productMap.get(parsed.productId);
    if (!product) continue;
    const expanded = expandProductsToVariants([product], {
      ...expandOptions,
      colorSlugs: expandOptions?.colorSlugs ?? [parsed.colorSlug],
    });
    const match = expanded.find((item) => item.variantKey === key);
    if (match) {
      items.push(match);
    }
  }
  return items;
}

type CollectTagVariantsOptions = {
  filters: ProductFilters;
  excludeVariantKeys: Set<string>;
  productLimit?: number;
  expandOptions?: ExpandProductsToVariantsOptions;
  productFilter?: CampaignProductFilter;
};

async function collectTagMatchedVariantItems(
  options: CollectTagVariantsOptions
): Promise<{
  items: VariantItem[];
  availableFilterOptions: {
    colors: string[];
    sizes: string[];
    subSubCategoryIds?: string[];
  };
}> {
  const { filters, excludeVariantKeys, productLimit, expandOptions, productFilter } = options;
  const filtersNoColorSize = { ...filters, color: undefined, size: undefined };
  const colorFacetSet = new Set<string>();
  const sizeFacetSet = new Set<string>();
  const subSubFacetSet = new Set<string>();
  const matchedProducts: Product[] = [];
  let facetProductCount = 0;
  let matchedProductCount = 0;

  let baseConstraints = buildFirestoreProductConstraints(filters, 'relevance');
  let lastDoc: QueryDocumentSnapshot<DocumentData> | undefined;

  while (true) {
    const pageConstraints = [...baseConstraints];
    if (lastDoc) {
      pageConstraints.push(startAfter(lastDoc));
    }
    pageConstraints.push(limit(LISTING_FIRESTORE_BATCH_SIZE));

    const snapshot = await getDocs(query(collection(db, 'products'), ...pageConstraints));
    if (snapshot.empty) {
      break;
    }

    const products = await hydrateProductsForListing(snapshot.docs);
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    for (const product of products) {
      if (productMatchesListingFilters(product, filtersNoColorSize)) {
        if (!productLimit || facetProductCount < productLimit) {
          collectFacetOptionsFromProduct(
            product,
            colorFacetSet,
            sizeFacetSet,
            subSubFacetSet
          );
          facetProductCount += 1;
        }
      }

      if (!productMatchesListingFilters(product, filters)) {
        continue;
      }

      if (productLimit && productLimit > 0 && matchedProductCount >= productLimit) {
        continue;
      }
      matchedProductCount += 1;
      matchedProducts.push(product);
    }

    if (snapshot.docs.length < LISTING_FIRESTORE_BATCH_SIZE) {
      break;
    }
  }

  const sortedProducts = sortProductsForCampaignAuto(
    matchedProducts,
    productFilter?.orderBy ?? 'createdAt',
    productFilter?.orderDirection ?? 'desc'
  );

  const items: VariantItem[] = [];
  for (const product of sortedProducts) {
    const variantItems = expandProductsToVariants([product], expandOptions);
    for (const item of variantItems) {
      if (!excludeVariantKeys.has(item.variantKey)) {
        items.push(item);
      }
    }
  }

  return {
    items,
    availableFilterOptions: buildAvailableFilterOptions(
      colorFacetSet,
      sizeFacetSet,
      subSubFacetSet
    ),
  };
}

type ResolveCampaignMerchandisedOptions = {
  campaign: Campaign;
  merchandising: CampaignMerchandising;
  filters: ProductFilters;
  page: number;
  pageSize?: number;
  productLimit?: number;
};

async function resolveCampaignMerchandisedVariantPage(
  options: ResolveCampaignMerchandisedOptions
): Promise<FilteredProductsResult> {
  const { campaign, merchandising, filters, productLimit } = options;
  const pageSize = options.pageSize ?? LISTING_PAGE_SIZE;
  const validatedPage = Number.isInteger(options.page) && options.page > 0 ? options.page : 1;
  const startIndex = (validatedPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const normalizedColors = filters.color
    ? (Array.isArray(filters.color) ? filters.color : [filters.color]).filter(Boolean)
    : undefined;
  const normalizedSizes = filters.size
    ? (Array.isArray(filters.size) ? filters.size : [filters.size]).filter(Boolean)
    : undefined;
  const expandOptions =
    normalizedColors || normalizedSizes
      ? { colorSlugs: normalizedColors, sizes: normalizedSizes }
      : undefined;

  const curatedKeys = merchandising.orderedVariantKeys;
  const excludeSet = new Set(curatedKeys);

  const useKeySlice =
    merchandising.mode === 'manual' && curatedKeys.length > pageSize;

  let pageItems: VariantItem[] = [];
  let availableFilterOptions = { colors: [] as string[], sizes: [] as string[] };
  let total = 0;

  if (useKeySlice) {
    const curatedCount = curatedKeys.length;
    const { items: tailItems, availableFilterOptions: facets } = await collectTagMatchedVariantItems({
      filters,
      excludeVariantKeys: excludeSet,
      productLimit,
      expandOptions,
      productFilter: campaign.productFilter,
    });
    availableFilterOptions = facets;
    total = curatedCount + tailItems.length;

    if (endIndex <= curatedCount) {
      const sliceKeys = curatedKeys.slice(startIndex, endIndex);
      pageItems = await fetchVariantItemsByKeys(sliceKeys, expandOptions);
    } else if (startIndex >= curatedCount) {
      const tailOffset = startIndex - curatedCount;
      pageItems = tailItems.slice(tailOffset, tailOffset + pageSize);
    } else {
      const curatedSlice = curatedKeys.slice(startIndex, curatedCount);
      const curatedItems = await fetchVariantItemsByKeys(curatedSlice, expandOptions);
      const tailNeeded = pageSize - curatedItems.length;
      pageItems = [...curatedItems, ...tailItems.slice(0, tailNeeded)];
    }
  } else {
    const pinnedItems = await fetchVariantItemsByKeys(curatedKeys, expandOptions);
    const { items: tailItems, availableFilterOptions: facets } = await collectTagMatchedVariantItems({
      filters,
      excludeVariantKeys: merchandising.mode === 'pinned' || merchandising.mode === 'manual' ? excludeSet : new Set(),
      productLimit,
      expandOptions,
      productFilter: campaign.productFilter,
    });
    availableFilterOptions = facets;

    let merged: VariantItem[];
    if (merchandising.mode === 'manual') {
      const pinnedByKey = new Map(pinnedItems.map((item) => [item.variantKey, item]));
      const orderedPinned = curatedKeys
        .map((key) => pinnedByKey.get(key))
        .filter((item): item is VariantItem => !!item);
      const pinnedKeySet = new Set(orderedPinned.map((item) => item.variantKey));
      const tail = tailItems.filter((item) => !pinnedKeySet.has(item.variantKey));
      merged = [...orderedPinned, ...tail];
    } else {
      const pinnedByKey = new Map(pinnedItems.map((item) => [item.variantKey, item]));
      const orderedPinned = curatedKeys
        .map((key) => pinnedByKey.get(key))
        .filter((item): item is VariantItem => !!item);
      merged = [...orderedPinned, ...tailItems];
    }

    const filtered = merged.filter((item) => variantItemMatchesFilters(item, filters));
    total = filtered.length;
    pageItems = filtered.slice(startIndex, endIndex);
  }

  const filteredPageItems = pageItems.filter((item) => variantItemMatchesFilters(item, filters));
  const hasMore = endIndex < total;
  const uniqueProducts = new Map<string, Product>();
  filteredPageItems.forEach((item) => {
    const productId = item.product.id || item.product.sku;
    if (!uniqueProducts.has(productId)) {
      uniqueProducts.set(productId, item.product);
    }
  });

  return {
    products: Array.from(uniqueProducts.values()),
    variantItems: filteredPageItems,
    hasMore,
    total,
    page: validatedPage,
    pageSize,
    availableFilterOptions,
  };
}

type ResolveCategoryMerchandisedOptions = {
  categoryId: string;
  merchandising: CategoryMerchandising;
  filters: ProductFilters;
  page: number;
  pageSize?: number;
};

async function resolveCategoryMerchandisedVariantPage(
  options: ResolveCategoryMerchandisedOptions
): Promise<FilteredProductsResult> {
  const { merchandising, filters } = options;
  const pageSize = options.pageSize ?? LISTING_PAGE_SIZE;
  const validatedPage = Number.isInteger(options.page) && options.page > 0 ? options.page : 1;
  const startIndex = (validatedPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const normalizedColors = filters.color
    ? (Array.isArray(filters.color) ? filters.color : [filters.color]).filter(Boolean)
    : undefined;
  const normalizedSizes = filters.size
    ? (Array.isArray(filters.size) ? filters.size : [filters.size]).filter(Boolean)
    : undefined;
  const expandOptions =
    normalizedColors || normalizedSizes
      ? { colorSlugs: normalizedColors, sizes: normalizedSizes }
      : undefined;

  const curatedKeys = merchandising.orderedVariantKeys;
  const excludeSet = new Set(curatedKeys);
  const useKeySlice = merchandising.mode === 'manual' && curatedKeys.length > pageSize;

  let pageItems: VariantItem[] = [];
  let availableFilterOptions = { colors: [] as string[], sizes: [] as string[] };
  let total = 0;

  if (useKeySlice) {
    const curatedCount = curatedKeys.length;
    const { items: tailItems, availableFilterOptions: facets } = await collectTagMatchedVariantItems({
      filters,
      excludeVariantKeys: excludeSet,
      productLimit: undefined,
      expandOptions,
      productFilter: undefined,
    });
    availableFilterOptions = facets;
    total = curatedCount + tailItems.length;

    if (endIndex <= curatedCount) {
      const sliceKeys = curatedKeys.slice(startIndex, endIndex);
      pageItems = await fetchVariantItemsByKeys(sliceKeys, expandOptions);
    } else if (startIndex >= curatedCount) {
      const tailOffset = startIndex - curatedCount;
      pageItems = tailItems.slice(tailOffset, tailOffset + pageSize);
    } else {
      const curatedSlice = curatedKeys.slice(startIndex, curatedCount);
      const curatedItems = await fetchVariantItemsByKeys(curatedSlice, expandOptions);
      const tailNeeded = pageSize - curatedItems.length;
      pageItems = [...curatedItems, ...tailItems.slice(0, tailNeeded)];
    }
  } else {
    const pinnedItems = await fetchVariantItemsByKeys(curatedKeys, expandOptions);
    const { items: tailItems, availableFilterOptions: facets } = await collectTagMatchedVariantItems({
      filters,
      excludeVariantKeys: merchandising.mode === 'pinned' || merchandising.mode === 'manual' ? excludeSet : new Set(),
      productLimit: undefined,
      expandOptions,
      productFilter: undefined,
    });
    availableFilterOptions = facets;

    let merged: VariantItem[];
    if (merchandising.mode === 'manual') {
      const pinnedByKey = new Map(pinnedItems.map((item) => [item.variantKey, item]));
      const orderedPinned = curatedKeys
        .map((key) => pinnedByKey.get(key))
        .filter((item): item is VariantItem => !!item);
      const pinnedKeySet = new Set(orderedPinned.map((item) => item.variantKey));
      const tail = tailItems.filter((item) => !pinnedKeySet.has(item.variantKey));
      merged = [...orderedPinned, ...tail];
    } else {
      const pinnedByKey = new Map(pinnedItems.map((item) => [item.variantKey, item]));
      const orderedPinned = curatedKeys
        .map((key) => pinnedByKey.get(key))
        .filter((item): item is VariantItem => !!item);
      merged = [...orderedPinned, ...tailItems];
    }

    const filtered = merged.filter((item) => variantItemMatchesFilters(item, filters));
    total = filtered.length;
    pageItems = filtered.slice(startIndex, endIndex);
  }

  const filteredPageItems = pageItems.filter((item) => variantItemMatchesFilters(item, filters));
  const hasMore = endIndex < total;
  const uniqueProducts = new Map<string, Product>();
  filteredPageItems.forEach((item) => {
    const productId = item.product.id || item.product.sku;
    if (!uniqueProducts.has(productId)) {
      uniqueProducts.set(productId, item.product);
    }
  });

  return {
    products: Array.from(uniqueProducts.values()),
    variantItems: filteredPageItems,
    hasMore,
    total,
    page: validatedPage,
    pageSize,
    availableFilterOptions,
  };
}

/**
 * Get campaign collection products (tag-based only) with filters from searchParams.
 * Same filter/sort/paginate pipeline as getCollectionProducts, but base set is products with campaign tag.
 */
export async function getCampaignCollectionProducts(
  campaign: Campaign,
  searchParams: { [key: string]: string | string[] | undefined } = {},
  language: 'en' | 'he' = 'en'
): Promise<FilteredProductsResult> {
  if (campaign.productFilter?.mode !== 'tag' || !campaign.productFilter?.tag) {
    return {
      products: [],
      variantItems: [],
      hasMore: false,
      total: 0,
      page: 1,
      pageSize: 24,
      availableFilterOptions: { colors: [], sizes: [] },
    };
  }

  const filters: ProductFilters = {};

  filters.tag = campaign.productFilter.tag;
  Object.assign(filters, parseFacetFiltersFromSearchParams(searchParams));

  const sort = parseSortFromSearchParams(searchParams);
  const page = parsePageFromSearchParams(searchParams);

  const useMerchandising = sort === 'relevance';
  if (useMerchandising) {
    const merchandising = await getCampaignMerchandising(campaign.slug);
    if (merchandising.mode !== 'auto') {
      return resolveCampaignMerchandisedVariantPage({
        campaign,
        merchandising,
        filters,
        page,
        pageSize: LISTING_PAGE_SIZE,
        productLimit: campaign.productFilter?.limit,
      });
    }
  }

  return resolveListingVariantPage({
    filters,
    sort,
    page,
    pageSize: LISTING_PAGE_SIZE,
    productLimit: campaign.productFilter?.limit,
  });
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
  // Resolves each segment under the previous segment's category ID so duplicate slugs (e.g. men/shoes vs women/shoes) work.
  async getCategoryIdsFromPath(categoryPath: string, language: 'en' | 'he' = 'en'): Promise<{ categoryIds: string[]; targetLevel: number } | null> {
    try {
      const pathSegments = categoryPath.split('/').filter(Boolean);
      if (pathSegments.length === 0) {
        return null;
      }

      const segmentMatchesSlug = (cat: Category, segment: string): boolean => {
        const s = segment.toLowerCase();
        const slugEn = typeof cat.slug === 'object' ? cat.slug.en : (cat.slug as string) || '';
        const slugHe = typeof cat.slug === 'object' ? cat.slug.he : '';
        const slugLang =
          typeof cat.slug === 'object' ? (cat.slug[language] || cat.slug.en || '') : slugEn;
        return (
          slugEn.toLowerCase() === s ||
          (slugHe.length > 0 && slugHe.toLowerCase() === s) ||
          (slugLang.length > 0 && slugLang.toLowerCase() === s)
        );
      };

      const categoryIds: string[] = [];

      for (let i = 0; i < pathSegments.length; i++) {
        const segment = pathSegments[i];
        const expectedLevel = i;
        let category: Category | null = null;

        if (i === 0) {
          try {
            const q = query(
              collection(db, 'categories'),
              where(`slug.en`, '==', segment),
              where('level', '==', 0),
              limit(1)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const docSnapshot = querySnapshot.docs[0];
              category = { id: docSnapshot.id, ...docSnapshot.data() } as Category;
            }
          } catch {
            // fall through
          }

          if (!category && language !== 'en') {
            try {
              const slugField = language === 'he' ? 'slug.he' : `slug.${language}`;
              const q = query(
                collection(db, 'categories'),
                where(slugField, '==', segment),
                where('level', '==', 0),
                limit(1)
              );
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                const docSnapshot = querySnapshot.docs[0];
                category = { id: docSnapshot.id, ...docSnapshot.data() } as Category;
              }
            } catch {
              // fall through
            }
          }

          if (!category) {
            try {
              const bySlug = await this.getCategoryBySlug(segment, language);
              if (bySlug && bySlug.level === 0 && (!bySlug.parentId || bySlug.parentId.trim() === '')) {
                category = bySlug;
              }
            } catch {
              // fall through
            }
          }

          if (!category) {
            const allCategories = await this.getAllCategories();
            const roots = allCategories.filter(
              (cat) =>
                cat.level === 0 &&
                (!cat.parentId || String(cat.parentId).trim() === '') &&
                segmentMatchesSlug(cat, segment)
            );
            category = roots[0] || null;
          }
        } else {
          const parentId = categoryIds[i - 1];
          const children = await this.getSubCategories(parentId);
          category =
            children.find(
              (cat) => cat.level === expectedLevel && segmentMatchesSlug(cat, segment)
            ) ||
            children.find((cat) => segmentMatchesSlug(cat, segment)) ||
            null;
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
          targetLevel: pathSegments.length - 1,
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

  // NOTE: enable/disable and delete (including cascade + product-reference
  // checks) are handled server-side via /api/admin/categories/:id — see
  // lib/category-mutations.ts and lib/admin/category-client.ts. They used to
  // live here as unguarded client-SDK writes with no children/product
  // validation; removed to avoid two competing code paths.

  // Get sub-categories that are enabled — used by storefront navigation so a
  // disabled sub-category/sub-sub-category doesn't keep showing up in menus
  // even though its parent is enabled. Admin pickers that need to see every
  // sub-category regardless of status should keep using getSubCategories().
  async getEnabledSubCategories(parentId: string): Promise<Category[]> {
    try {
      const q = query(
        collection(db, 'categories'),
        where('parentId', '==', parentId),
        where('isEnabled', '==', true),
        orderBy('sortOrder', 'asc')
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
    } catch (error) {
      console.error('Error fetching enabled sub categories:', error);
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

  /** Get a single page of campaign products (e.g. for "Load more"). */
  async getCampaignProductsPaginated(
    campaign: Campaign,
    page: number,
    pageSize: number
  ): Promise<{ products: Product[]; total: number; hasMore: boolean; page: number }> {
    const all = await this.getCampaignProducts(campaign);
    const total = all.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const products = all.slice(start, end);
    const hasMore = end < total;
    return { products, total, hasMore, page };
  },

  /** Campaign products as variant items (one per color), paginated – same as collection page. */
  async getCampaignVariantItemsPaginated(
    campaign: Campaign,
    page: number,
    pageSize: number
  ): Promise<{ variantItems: VariantItem[]; total: number; hasMore: boolean; page: number }> {
    const products = await this.getCampaignProducts(campaign);
    for (const p of products) {
      await loadColorVariantsForProduct(p);
    }
    const allVariants = expandProductsToVariants(products);
    const total = allVariants.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const variantItems = allVariants.slice(start, end);
    const hasMore = end < total;
    return { variantItems, total, hasMore, page };
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

const BLOG_COLLECTION = 'blogArticles';

function hasLocalizedContent(value?: LocalizedString): boolean {
  return Boolean(value && (value.en?.trim() || value.he?.trim()));
}

function cleanBlogLocalizedFields(data: Partial<BlogArticle>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  if (data.title) clean.title = data.title;
  if (data.excerpt) clean.excerpt = data.excerpt;
  if (data.content) clean.content = data.content;
  if (data.featuredImage) clean.featuredImage = data.featuredImage;
  if (data.featuredImageAlt) clean.featuredImageAlt = data.featuredImageAlt;
  if (data.status) clean.status = data.status;
  if (data.publishedAt) clean.publishedAt = data.publishedAt;
  if (hasLocalizedContent(data.seoTitle)) clean.seoTitle = data.seoTitle;
  if (hasLocalizedContent(data.seoDescription)) clean.seoDescription = data.seoDescription;
  if (hasLocalizedContent(data.ogTitle)) clean.ogTitle = data.ogTitle;
  if (hasLocalizedContent(data.ogDescription)) clean.ogDescription = data.ogDescription;
  if (data.ogImage) clean.ogImage = data.ogImage;
  // Explicit undefined check (not truthy) so clearing the field reverts the
  // article to its own self-canonical URL instead of being silently ignored.
  if (data.canonicalUrl !== undefined) clean.canonicalUrl = data.canonicalUrl;
  if (data.relatedProductsCarousel) clean.relatedProductsCarousel = data.relatedProductsCarousel;

  return clean;
}

export const blogService = {
  async getAllArticles(): Promise<BlogArticle[]> {
    try {
      const q = query(collection(db, BLOG_COLLECTION), orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as BlogArticle[];
    } catch (error) {
      console.error('Error fetching blog articles:', error);
      throw error;
    }
  },

  async getPublishedArticles(
    page = 1,
    pageSize = 12
  ): Promise<{ articles: BlogArticle[]; total: number; page: number; hasMore: boolean }> {
    try {
      const q = query(
        collection(db, BLOG_COLLECTION),
        where('status', '==', 'published'),
        orderBy('publishedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const all = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as BlogArticle[];

      const total = all.length;
      const start = (page - 1) * pageSize;
      const articles = all.slice(start, start + pageSize);
      const hasMore = start + pageSize < total;

      return { articles, total, page, hasMore };
    } catch (error) {
      console.error('Error fetching published articles:', error);
      throw error;
    }
  },

  async getArticleById(id: string): Promise<BlogArticle | null> {
    try {
      const docRef = doc(db, BLOG_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as BlogArticle;
    } catch (error) {
      console.error('Error fetching blog article:', error);
      throw error;
    }
  },

  async getArticleBySlug(slug: string): Promise<BlogArticle | null> {
    try {
      const q = query(collection(db, BLOG_COLLECTION), where('slug', '==', slug), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as BlogArticle;
    } catch (error) {
      console.error('Error fetching blog article by slug:', error);
      throw error;
    }
  },

  // Public variant: adds status == 'published' so the query satisfies the
  // Firestore security rule for unauthenticated callers (storefront pages).
  // Use this everywhere the client SDK is called without a user auth token.
  async getPublishedArticleBySlug(slug: string): Promise<BlogArticle | null> {
    try {
      const q = query(
        collection(db, BLOG_COLLECTION),
        where('slug', '==', slug),
        where('status', '==', 'published'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as BlogArticle;
    } catch (error) {
      console.error('Error fetching published blog article by slug:', error);
      throw error;
    }
  },

  async checkSlugUnique(slug: string, excludeId?: string): Promise<boolean> {
    const existing = await this.getArticleBySlug(slug);
    if (!existing) return true;
    return excludeId ? existing.id === excludeId : false;
  },

  async createArticle(data: Omit<BlogArticle, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, BLOG_COLLECTION), {
        ...cleanBlogLocalizedFields(data),
        slug: data.slug,
        featuredImage: data.featuredImage || '',
        featuredImageAlt: data.featuredImageAlt || { en: '', he: '' },
        status: data.status,
        publishedAt: data.publishedAt || now,
        createdAt: now,
        updatedAt: now,
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating blog article:', error);
      throw error;
    }
  },

  async updateArticle(id: string, data: Partial<BlogArticle>): Promise<void> {
    try {
      const docRef = doc(db, BLOG_COLLECTION, id);
      await updateDoc(docRef, {
        ...cleanBlogLocalizedFields(data),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.featuredImage !== undefined ? { featuredImage: data.featuredImage } : {}),
        ...(data.featuredImageAlt !== undefined ? { featuredImageAlt: data.featuredImageAlt } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.publishedAt !== undefined ? { publishedAt: data.publishedAt } : {}),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating blog article:', error);
      throw error;
    }
  },

  async deleteArticle(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, BLOG_COLLECTION, id));
    } catch (error) {
      console.error('Error deleting blog article:', error);
      throw error;
    }
  },
}; 