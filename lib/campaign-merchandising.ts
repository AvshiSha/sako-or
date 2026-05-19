import 'server-only';

import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  CAMPAIGN_MERCHANDISING_VERSION,
  CampaignMerchandising,
  CampaignMerchandisingMode,
  MAX_MERCHANDISING_VARIANT_KEYS,
  MERCHANDISING_COLLECTION,
  MerchandisingPreviewRow,
  dedupeVariantKeys,
  defaultCampaignMerchandising,
  isValidVariantKey,
  parseVariantKey,
} from '@/lib/campaign-merchandising-types';

export type {
  CampaignMerchandising,
  CampaignMerchandisingMode,
  MerchandisingPreviewRow,
} from '@/lib/campaign-merchandising-types';

export {
  CAMPAIGN_MERCHANDISING_VERSION,
  MAX_MERCHANDISING_VARIANT_KEYS,
  dedupeVariantKeys,
  defaultCampaignMerchandising,
  isValidVariantKey,
  parseVariantKey,
} from '@/lib/campaign-merchandising-types';

function docRef(slug: string) {
  return adminDb.collection(MERCHANDISING_COLLECTION).doc(slug);
}

export async function getCampaignMerchandisingAdmin(
  campaignSlug: string
): Promise<CampaignMerchandising> {
  const snap = await docRef(campaignSlug).get();
  if (!snap.exists) {
    return defaultCampaignMerchandising(campaignSlug);
  }
  const data = snap.data() as Partial<CampaignMerchandising>;
  return {
    campaignSlug,
    mode: data.mode ?? 'auto',
    orderedVariantKeys: Array.isArray(data.orderedVariantKeys)
      ? dedupeVariantKeys(data.orderedVariantKeys)
      : [],
    updatedAt: data.updatedAt ?? new Date().toISOString(),
    updatedBy: data.updatedBy,
    version: data.version ?? CAMPAIGN_MERCHANDISING_VERSION,
  };
}

export async function saveCampaignMerchandisingAdmin(
  campaignSlug: string,
  payload: {
    mode: CampaignMerchandisingMode;
    orderedVariantKeys: string[];
    updatedBy?: string;
  }
): Promise<CampaignMerchandising> {
  const orderedVariantKeys = dedupeVariantKeys(payload.orderedVariantKeys);
  if (orderedVariantKeys.length > MAX_MERCHANDISING_VARIANT_KEYS) {
    throw new Error(`Cannot save more than ${MAX_MERCHANDISING_VARIANT_KEYS} variant keys`);
  }
  for (const key of orderedVariantKeys) {
    if (!isValidVariantKey(key)) {
      throw new Error(`Invalid variant key: ${key}`);
    }
  }

  const now = new Date().toISOString();
  const doc: CampaignMerchandising = {
    campaignSlug,
    mode: payload.mode,
    orderedVariantKeys,
    updatedAt: now,
    updatedBy: payload.updatedBy,
    version: CAMPAIGN_MERCHANDISING_VERSION,
  };

  await docRef(campaignSlug).set(doc, { merge: true });
  return doc;
}

type AdminColorVariant = {
  colorSlug?: string;
  colorName?: string;
  isActive?: boolean;
  stockBySize?: Record<string, number>;
  primaryImage?: string;
  images?: string[];
};

type AdminProduct = {
  id: string;
  sku?: string;
  name?: { en?: string; he?: string };
  isEnabled?: boolean;
  isDeleted?: boolean;
  tags?: string[];
  colorVariants?: Record<string, AdminColorVariant>;
};

function looksLikeFirebaseId(value: string): boolean {
  return /^[a-zA-Z0-9]{18,28}$/.test(value);
}

function looksLikeVariantKey(value: string): boolean {
  return /^[a-zA-Z0-9]{18,28}-[a-z0-9]+(-[a-z0-9]+)*$/i.test(value);
}

function productDisplayName(
  product: AdminProduct,
  lang: 'en' | 'he' = 'en',
  colorSlug?: string
): string {
  const title = (product.name?.[lang] || product.name?.en || '').trim();
  if (title) return title;

  const sku = product.sku?.trim();
  if (sku && !looksLikeFirebaseId(sku) && !looksLikeVariantKey(sku)) {
    return sku;
  }

  if (sku) {
    return colorSlug ? `${sku} (${colorSlug})` : sku;
  }

  if (looksLikeFirebaseId(product.id) && colorSlug) {
    return `Product ${colorSlug}`;
  }

  return product.id;
}

function findVariantByColorSlug(
  colorVariants: Record<string, AdminColorVariant> | undefined,
  colorSlug: string
): AdminColorVariant | undefined {
  if (!colorVariants) return undefined;
  const byKey = colorVariants[colorSlug];
  if (byKey) return byKey;
  return Object.values(colorVariants).find((v) => v.colorSlug === colorSlug);
}

function normalizeImageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => {
      if (typeof img === 'string') return img;
      if (img && typeof img === 'object' && 'url' in img) {
        return String((img as { url?: string }).url || '');
      }
      return '';
    })
    .filter(Boolean);
}

function variantImage(variant: { primaryImage?: string; images?: unknown }): string | undefined {
  if (variant.primaryImage) return variant.primaryImage;
  const urls = normalizeImageUrls(variant.images);
  return urls[0];
}

async function loadColorVariantImagesFromCollection(
  colorVariantDocId: string
): Promise<{ primaryImage?: string; images?: string[] }> {
  try {
    const snap = await adminDb
      .collection('colorVariantImages')
      .where('colorVariantId', '==', colorVariantDocId)
      .get();

    const urls = snap.docs
      .map((doc) => doc.data().url as string | undefined)
      .filter((url): url is string => !!url);

    const primaryDoc = snap.docs.find((doc) => doc.data().isPrimary === true);
    const primaryImage = (primaryDoc?.data().url as string | undefined) || urls[0];

    return { primaryImage, images: urls };
  } catch {
    return {};
  }
}

async function enrichVariantWithImages(
  product: AdminProduct,
  colorSlug: string,
  variant: AdminColorVariant
): Promise<AdminColorVariant> {
  if (variantImage(variant)) {
    const urls = normalizeImageUrls(variant.images);
    return {
      ...variant,
      images: urls.length > 0 ? urls : variant.images,
      primaryImage: variant.primaryImage || urls[0],
    };
  }

  try {
    const snap = await adminDb
      .collection('colorVariants')
      .where('productId', '==', product.id)
      .where('colorSlug', '==', colorSlug)
      .limit(1)
      .get();

    if (snap.empty) return variant;

    const images = await loadColorVariantImagesFromCollection(snap.docs[0].id);
    return { ...variant, ...images };
  } catch {
    return variant;
  }
}

async function loadColorVariantsAdmin(product: AdminProduct): Promise<void> {
  const hasEmbedded =
    product.colorVariants && Object.keys(product.colorVariants).length > 0;

  if (!hasEmbedded) {
    const snap = await adminDb
      .collection('colorVariants')
      .where('productId', '==', product.id)
      .get();
    product.colorVariants = {};

    for (const variantDoc of snap.docs) {
      const data = variantDoc.data() as {
        colorSlug?: string;
        colorName?: string;
        isActive?: boolean;
        stockBySize?: Record<string, number>;
      };
      if (!data.colorSlug) continue;

      const images = await loadColorVariantImagesFromCollection(variantDoc.id);
      product.colorVariants[data.colorSlug] = {
        colorSlug: data.colorSlug,
        colorName: data.colorName,
        isActive: data.isActive,
        stockBySize: data.stockBySize,
        ...images,
      };
    }
    return;
  }

  const normalized: Record<string, AdminColorVariant> = {};
  for (const [, variant] of Object.entries(product.colorVariants!)) {
    if (!variant.colorSlug) continue;
    const enriched = await enrichVariantWithImages(product, variant.colorSlug, variant);
    normalized[variant.colorSlug] = enriched;
  }
  product.colorVariants = normalized;
}

function variantStockTotal(variant: { stockBySize?: Record<string, number> }): number {
  return Object.values(variant.stockBySize || {}).reduce((sum, n) => sum + (n > 0 ? n : 0), 0);
}

export async function resolveMerchandisingPreviewRows(
  variantKeys: string[],
  options?: { campaignTag?: string; lang?: 'en' | 'he' }
): Promise<MerchandisingPreviewRow[]> {
  const lang = options?.lang ?? 'en';
  const campaignTag = options?.campaignTag;
  const parsedKeys = variantKeys
    .map((key) => ({ key, parsed: parseVariantKey(key) }))
    .filter((e): e is { key: string; parsed: { productId: string; colorSlug: string } } => !!e.parsed);

  const productIds = [...new Set(parsedKeys.map((p) => p.parsed.productId))];
  const productMap = new Map<string, AdminProduct>();

  const chunkSize = 30;
  for (let i = 0; i < productIds.length; i += chunkSize) {
    const chunk = productIds.slice(i, i + chunkSize);
    const refs = chunk.map((id) => adminDb.collection('products').doc(id));
    const snaps = await adminDb.getAll(...refs);
    await Promise.all(
      snaps.map(async (snap) => {
        if (!snap.exists) return;
        const product = { id: snap.id, ...snap.data() } as AdminProduct;
        await loadColorVariantsAdmin(product);
        productMap.set(snap.id, product);
      })
    );
  }

  const rows: MerchandisingPreviewRow[] = [];
  for (const { key, parsed } of parsedKeys) {
    const product = productMap.get(parsed.productId);
    if (!product) {
      rows.push({
        variantKey: key,
        productId: parsed.productId,
        colorSlug: parsed.colorSlug,
        productName: parsed.productId,
        isActive: false,
        isStale: true,
      });
      continue;
    }

    const variant = findVariantByColorSlug(product.colorVariants, parsed.colorSlug);
    const tagMatch =
      !campaignTag || (product.tags && product.tags.includes(campaignTag));
    const isActive =
      !product.isDeleted &&
      product.isEnabled !== false &&
      variant?.isActive !== false;
    rows.push({
      variantKey: key,
      productId: parsed.productId,
      colorSlug: parsed.colorSlug,
      productName: productDisplayName(product, lang, parsed.colorSlug),
      colorName: variant?.colorName || parsed.colorSlug,
      sku: product.sku,
      imageUrl: variant ? variantImage(variant) : undefined,
      isActive: !!isActive,
      isStale: !tagMatch || !variant,
      totalStock: variant ? variantStockTotal(variant) : 0,
    });
  }

  return rows;
}

export async function syncCampaignMerchandisingVariantKeys(
  campaignSlug: string,
  tag: string,
  productLimit?: number
): Promise<string[]> {
  const keys: string[] = [];
  let matchedProducts = 0;
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    let q = adminDb
      .collection('products')
      .where('tags', 'array-contains', tag)
      .where('isEnabled', '==', true)
      .where('isDeleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(75);

    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }

    const snap = await q.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (data.isDeleted) continue;
      if (productLimit && productLimit > 0 && matchedProducts >= productLimit) {
        return keys;
      }

      const product = { id: docSnap.id, ...data } as AdminProduct;
      await loadColorVariantsAdmin(product);
      let addedForProduct = 0;
      for (const variant of Object.values(product.colorVariants || {})) {
        if (variant.isActive === false || !variant.colorSlug) continue;
        keys.push(`${product.id}-${variant.colorSlug}`);
        addedForProduct += 1;
      }
      if (addedForProduct > 0) {
        matchedProducts += 1;
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 75) break;
  }

  return keys;
}

export async function listCampaignMerchandisingPool(
  campaignSlug: string,
  tag: string,
  options: {
    page: number;
    pageSize: number;
    q?: string;
    excludeKeys?: string[];
    productLimit?: number;
  }
): Promise<{ variantKeys: string[]; total: number; page: number; hasMore: boolean }> {
  const allKeys = await syncCampaignMerchandisingVariantKeys(
    campaignSlug,
    tag,
    options.productLimit
  );
  const exclude = new Set(options.excludeKeys ?? []);
  let filtered = allKeys.filter((k) => !exclude.has(k));

  const query = options.q?.trim().toLowerCase();
  if (query) {
    const previews = await resolveMerchandisingPreviewRows(filtered.slice(0, 500), {
      campaignTag: tag,
    });
    const matchingKeys = new Set(
      previews
        .filter(
          (p) =>
            p.productName.toLowerCase().includes(query) ||
            (p.sku && p.sku.toLowerCase().includes(query)) ||
            p.colorSlug.toLowerCase().includes(query) ||
            p.variantKey.toLowerCase().includes(query)
        )
        .map((p) => p.variantKey)
    );
    filtered = filtered.filter((k) => matchingKeys.has(k));
  }

  const page = Math.max(1, options.page);
  const pageSize = Math.min(100, Math.max(1, options.pageSize));
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  return {
    variantKeys: slice,
    total: filtered.length,
    page,
    hasMore: start + pageSize < filtered.length,
  };
}
