import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { productService, categoryService } from '@/lib/firebase'
import { buildProductSearchDerivedFields } from '@/lib/build-product-search-keywords'
import { deleteMeilisearchProduct, upsertMeilisearchProduct } from '@/lib/meilisearch'
import { prisma } from '@/lib/prisma'
import { productExtensionsSchema, type ProductExtensionsInput } from '@/lib/schemas/product-schema'
import { requireAdmin } from '@/lib/server/auth'
import {
  getOptionLabel,
  type EnumOption,
  UPPER_MATERIAL_OPTIONS,
  LINING_OPTIONS,
  OUTSOLE_OPTIONS,
} from '@/lib/product-enums'
import { deriveBagFacts } from '@/lib/bag-derived'

/** Resolves a single dropdown value to its label, falling back to the legacy
 * free-text value for products that haven't been reconciled onto the new
 * dropdown yet. Used to keep populating the legacy *_en/*_he Postgres columns
 * that lib/inventory.ts and scripts/backfill-generated-search-keywords.ts
 * still read directly. */
function resolveAttributeLabel<T extends string>(
  options: EnumOption<T>[],
  value: T | null | undefined,
  locale: 'en' | 'he',
  legacyFallback: string | null
): string | null {
  if (value) {
    const label = getOptionLabel(options, value, locale)
    if (label) return label
  }
  return legacyFallback
}

/**
 * The five derived bag columns: computed from the product's dimensions, unless
 * an admin stored an override in Firestore, in which case the override wins.
 *
 * Derivation happens here rather than at read time so filtering stays plain SQL
 * — the same reason `generated_search_keywords` and `colors_search_norm` are
 * precomputed. It re-runs on every sync, so correcting a bag's dimensions
 * automatically corrects everything downstream of them.
 */
function resolveBagDerivedColumns(extensions: ProductExtensionsInput | null) {
  const bagSpecs = extensions?.bagSpecs
  const derived = deriveBagFacts({
    heightCm: extensions?.heightCm,
    widthCm: extensions?.widthCm,
    depthCm: extensions?.depthCm,
    bagStructure: bagSpecs?.bagStructure ?? null,
  })

  return {
    bagCapacityLiters: derived.bagCapacityLiters,
    bagSizeCategory: bagSpecs?.bagSizeCategory ?? derived.bagSizeCategory,
    fitsA4: bagSpecs?.fitsA4 ?? derived.fitsA4,
    fitsTablet: bagSpecs?.fitsTablet ?? derived.fitsTablet,
    fitsLaptopInches: bagSpecs?.fitsLaptopInches ?? derived.fitsLaptopInches,
  }
}

/** Same as resolveAttributeLabel, but for multi-select fields (e.g. Upper Material) — joins matched labels. */
function resolveMultiAttributeLabel<T extends string>(
  options: EnumOption<T>[],
  values: T[] | null | undefined,
  locale: 'en' | 'he',
  legacyFallback: string | null
): string | null {
  if (values && values.length > 0) {
    const labels = values
      .map((value) => getOptionLabel(options, value, locale))
      .filter((label): label is string => !!label)
    if (labels.length > 0) return labels.join(', ')
  }
  return legacyFallback
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof NextResponse) return auth

    console.log('Starting product synchronization from Firebase to Neon DB...')
    
    // Get all products and categories from Firebase
    const firebaseProducts = await productService.getAllProducts()
    const firebaseCategories = await categoryService.getAllCategories()
    console.log(`Found ${firebaseProducts.length} products in Firebase`)
    
    // Create a mapping from Firebase category IDs to category objects (with both EN and HE names)
    const firebaseCategoryMap = new Map<string, { en: string; he: string; level?: number; parentId?: string }>()
    firebaseCategories.forEach(cat => {
      if (cat.id) {
        const categoryNameEn = typeof cat.name === 'object' ? cat.name.en : cat.name
        const categoryNameHe = typeof cat.name === 'object' ? cat.name.he : cat.name
        firebaseCategoryMap.set(cat.id, {
          en: categoryNameEn,
          he: categoryNameHe,
          level: cat.level,
          parentId: cat.parentId
        })
      }
    })
    
    // Also create a simple mapping for backward compatibility
    const firebaseCategoryNameMap = new Map<string, string>()
    firebaseCategories.forEach(cat => {
      if (cat.id) {
        const categoryName = typeof cat.name === 'object' ? cat.name.en : cat.name
        firebaseCategoryNameMap.set(cat.id, categoryName)
      }
    })
    
    let syncedCount = 0
    let createdCount = 0
    let updatedCount = 0
    let deletedCount = 0
    const errors: string[] = []
    
    // Get all existing products in Neon DB
    const existingNeonProducts = await prisma.product.findMany()
    const firebaseProductSkus = new Set(
      firebaseProducts.map(product => product.sku || product.baseSku || '')
    )
    
    // Delete products that exist in Neon DB but not in Firebase
    for (const neonProduct of existingNeonProducts) {
      if (!firebaseProductSkus.has(neonProduct.sku)) {
        try {
          await prisma.product.delete({
            where: { id: neonProduct.id }
          })
          try {
            await deleteMeilisearchProduct(neonProduct.id)
          } catch (meiliError) {
            console.warn(`Meilisearch delete skipped for ${neonProduct.title_en}:`, meiliError)
          }
          deletedCount++
          console.log(`Deleted product: ${neonProduct.title_en}`)
        } catch (error) {
          const errorMsg = `Failed to delete product "${neonProduct.title_en}": ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }
    }
    
    for (const firebaseProduct of firebaseProducts) {
      try {
        // Extract product data, handling both old and new Firebase structures
        const productSku = firebaseProduct.sku || firebaseProduct.baseSku || ''
        const productTitleEn = firebaseProduct.title_en || (typeof firebaseProduct.name === 'object' ? firebaseProduct.name?.en : firebaseProduct.name) || 'Unnamed Product'
        const productTitleHe = firebaseProduct.title_he || (typeof firebaseProduct.name === 'object' ? firebaseProduct.name?.he : firebaseProduct.name) || productTitleEn
        const productDescEn = firebaseProduct.description_en || (typeof firebaseProduct.description === 'object' ? firebaseProduct.description?.en : firebaseProduct.description) || ''
        const productDescHe = firebaseProduct.description_he || (typeof firebaseProduct.description === 'object' ? firebaseProduct.description?.he : firebaseProduct.description) || productDescEn

        // Normalize array-like fields to always be arrays (for Prisma schema)
        const rawCategoriesPath = (firebaseProduct as any).categories_path
        const rawCategoriesPathId = (firebaseProduct as any).categories_path_id
        const rawSearchKeywords = (firebaseProduct as any).searchKeywords

        const categoriesPath =
          Array.isArray(rawCategoriesPath)
            ? rawCategoriesPath
            : rawCategoriesPath
            ? [String(rawCategoriesPath)]
            : []

        const categoriesPathId =
          Array.isArray(rawCategoriesPathId)
            ? rawCategoriesPathId
            : rawCategoriesPathId
            ? [String(rawCategoriesPathId)]
            : []

        const searchKeywords =
          Array.isArray(rawSearchKeywords)
            ? rawSearchKeywords.map((kw: any) => String(kw))
            : rawSearchKeywords
            ? [String(rawSearchKeywords)]
            : []

        // Normalize colorVariants to a plain object (record) – Prisma Json field
        const rawColorVariants = (firebaseProduct as any).colorVariants
        const colorVariants =
          rawColorVariants &&
          !Array.isArray(rawColorVariants) &&
          typeof rawColorVariants === 'object'
            ? rawColorVariants
            : {}

        // Debug logging for new product field
        console.log(`Product "${productTitleEn}" - isNew: ${firebaseProduct.isNew}, newProduct: ${(firebaseProduct as any).newProduct}`)

        // Check if product already exists in Neon DB by SKU
        const existingProduct = await prisma.product.findFirst({
          where: { sku: productSku }
        })

        // Resolve category path from Firebase IDs to names (both EN and HE)
        // This handles cases like ["women", "outlet", "outlet-boots"] → ["Women", "Outlet", "Outlet Boots"] + Hebrew
        let categoryEn = null
        let categoryHe = null
        let subCategoryEn = null
        let subCategoryHe = null
        let subSubCategoryEn = null
        let subSubCategoryHe = null
        let categoryId: string | null = null

        // Priority 1: Check if category names are already resolved and stored in Firebase
        // This is the most reliable source since admin pages store resolved names
        const productWithResolvedCategories = firebaseProduct as any
        if (productWithResolvedCategories.category_en) {
          categoryEn = productWithResolvedCategories.category_en
          categoryHe = productWithResolvedCategories.category_he || null
          subCategoryEn = productWithResolvedCategories.subCategory_en || null
          subCategoryHe = productWithResolvedCategories.subCategory_he || null
          subSubCategoryEn = productWithResolvedCategories.subSubCategory_en || null
          subSubCategoryHe = productWithResolvedCategories.subSubCategory_he || null

          // Look up main category in Neon DB to get categoryId
          const mainCategory = await prisma.category.findFirst({
            where: { name_en: categoryEn, level: 0 }
          })
          if (mainCategory) {
            categoryId = mainCategory.id
            // Ensure Hebrew name is set if not already provided
            if (!categoryHe) {
              categoryHe = mainCategory.name_he
            }

            // If subcategory exists but Hebrew name is missing, look it up from Neon DB
            if (subCategoryEn && !subCategoryHe) {
              const subCategory = await prisma.category.findFirst({
                where: {
                  name_en: subCategoryEn,
                  level: 1,
                  parentId: mainCategory.id
                }
              })
              if (subCategory) {
                subCategoryHe = subCategory.name_he
              }
            }

            // If sub-subcategory exists but Hebrew name is missing, look it up from Neon DB
            if (subSubCategoryEn && !subSubCategoryHe && subCategoryEn) {
              const subCategoryForLookup = await prisma.category.findFirst({
                where: {
                  name_en: subCategoryEn,
                  level: 1,
                  parentId: mainCategory.id
                }
              })
              if (subCategoryForLookup) {
                const subSubCategory = await prisma.category.findFirst({
                  where: {
                    name_en: subSubCategoryEn,
                    level: 2,
                    parentId: subCategoryForLookup.id
                  }
                })
                if (subSubCategory) {
                  subSubCategoryHe = subSubCategory.name_he
                }
              }
            }
          }
        }

        // Priority 2: Resolve category path using categories_path_id array (preserves hierarchy)
        if (!categoryEn && firebaseProduct.categories_path_id && firebaseProduct.categories_path_id.length > 0) {
          type ResolvedCategory = { en: string; he: string; level?: number; parentId?: string }
          const resolvedPath = firebaseProduct.categories_path_id.map((firebaseId: string): ResolvedCategory | null => {
            const firebaseCat = firebaseCategoryMap.get(firebaseId)
            return firebaseCat ? {
              en: firebaseCat.en,
              he: firebaseCat.he,
              level: firebaseCat.level,
              parentId: firebaseCat.parentId
            } : null
          }).filter((item): item is ResolvedCategory => item !== null)

          if (resolvedPath.length > 0) {
            categoryEn = resolvedPath[0].en
            categoryHe = resolvedPath[0].he

            // Look up main category in Neon DB to get categoryId
            const mainCategory = await prisma.category.findFirst({
              where: { name_en: categoryEn, level: 0 }
            })
            if (mainCategory) {
              categoryId = mainCategory.id
            }

            if (resolvedPath.length > 1) {
              subCategoryEn = resolvedPath[1].en
              // Look up Hebrew name from Neon DB with parent matching
              const subCategory = await prisma.category.findFirst({
                where: {
                  name_en: subCategoryEn,
                  level: 1,
                  parentId: mainCategory?.id || undefined
                }
              })
              subCategoryHe = subCategory?.name_he || resolvedPath[1].he
            }

            if (resolvedPath.length > 2) {
              subSubCategoryEn = resolvedPath[2].en
              // Look up Hebrew name from Neon DB with parent matching
              const subCategoryForLookup = await prisma.category.findFirst({
                where: {
                  name_en: subCategoryEn,
                  level: 1,
                  parentId: mainCategory?.id || undefined
                }
              })
              const subSubCategory = await prisma.category.findFirst({
                where: {
                  name_en: subSubCategoryEn,
                  level: 2,
                  parentId: subCategoryForLookup?.id || undefined
                }
              })
              subSubCategoryHe = subSubCategory?.name_he || resolvedPath[2].he
            }
          }
        }

        // Priority 3: Fallback - Use old method if categories_path_id is not available
        // This tries to resolve from Firebase category ID (not recommended, but handles legacy data)
        if (!categoryEn && firebaseProduct.category) {
          const categoryInfo = firebaseCategoryNameMap.get(firebaseProduct.category)
          if (categoryInfo) {
            categoryEn = categoryInfo
            const category = await prisma.category.findFirst({
              where: { name_en: categoryEn }
            })
            if (category) {
              categoryId = category.id
              categoryHe = category.name_he
            }
          }
        }

        // Skip products without a valid categoryId (required by Prisma schema)
        if (!categoryId) {
          const categoryIdentifier =
            categoryEn ||
            (Array.isArray(firebaseProduct.categories_path) && firebaseProduct.categories_path.length > 0
              ? firebaseProduct.categories_path.join(' > ')
              : firebaseProduct.category || 'Unknown')
          const errorMsg = `Skipping product "${productTitleEn}" - category "${categoryIdentifier}" not found in Neon DB`
          console.warn(errorMsg)
          errors.push(errorMsg)
          continue
        }

        // Validate the new optional field groups before they reach Postgres. These fields
        // are all optional, so a legacy product with none of them always passes; only
        // genuinely invalid values (bad enum, negative heel height, etc.) are dropped here —
        // the rest of the product still syncs normally.
        const materialCareSource = (firebaseProduct as any).materialCare || {}
        const shoeFitSource = (firebaseProduct as any).shoeFit
        const bagSpecsSource = (firebaseProduct as any).bagSpecs
        const seoSource = firebaseProduct.seo || {}
        const extensionsResult = productExtensionsSchema.safeParse({
          shortTitle_en: (firebaseProduct as any).shortTitle_en,
          shortTitle_he: (firebaseProduct as any).shortTitle_he,
          shortDescription_en: (firebaseProduct as any).shortDescription_en,
          shortDescription_he: (firebaseProduct as any).shortDescription_he,
          toeShape_en: materialCareSource.toeShape_en,
          toeShape_he: materialCareSource.toeShape_he,
          closureType_en: materialCareSource.closureType_en,
          closureType_he: materialCareSource.closureType_he,
          heelType_en: materialCareSource.heelType_en,
          heelType_he: materialCareSource.heelType_he,
          careInstructions_en: materialCareSource.careInstructions_en,
          careInstructions_he: materialCareSource.careInstructions_he,
          upperMaterial: materialCareSource.upperMaterial,
          lining: materialCareSource.lining,
          insole: materialCareSource.insole,
          outsole: materialCareSource.outsole,
          soleType: materialCareSource.soleType,
          toeShape: materialCareSource.toeShape,
          heelType: materialCareSource.heelType,
          closureType: materialCareSource.closureType,
          heelHeight: materialCareSource.heelHeight,
          heightCm: materialCareSource.heightCm,
          widthCm: materialCareSource.widthCm,
          depthCm: materialCareSource.depthCm,
          weightGrams: materialCareSource.weightGrams,
          shoeFit: shoeFitSource,
          bagSpecs: bagSpecsSource,
          seo: {
            slug: seoSource.slug,
            he: { focusKeyword: seoSource.focusKeyword_he, secondaryKeywords: seoSource.secondaryKeywords_he },
            en: { focusKeyword: seoSource.focusKeyword_en, secondaryKeywords: seoSource.secondaryKeywords_en },
          },
        })
        if (!extensionsResult.success) {
          console.warn(
            `Product "${productTitleEn}" (${productSku}) has invalid structured field data — syncing without it:`,
            extensionsResult.error.issues
          )
        }
        const extensions = extensionsResult.success ? extensionsResult.data : null

        const productData = {
          title_en: productTitleEn,
          title_he: productTitleHe,
          shortTitle_en: extensions?.shortTitle_en || null,
          shortTitle_he: extensions?.shortTitle_he || null,
          description_en: productDescEn,
          description_he: productDescHe,
          shortDescription_en: extensions?.shortDescription_en || null,
          shortDescription_he: extensions?.shortDescription_he || null,
          sku: productSku,
          brand: firebaseProduct.brand || '',
          price: firebaseProduct.price || 0,
          salePrice: firebaseProduct.salePrice || null,
          currency: firebaseProduct.currency || 'ILS',
          // Store resolved English names (not Firebase IDs)
          category: categoryEn || firebaseProduct.category || '',
          subCategory: subCategoryEn || firebaseProduct.subCategory || null,
          subSubCategory: subSubCategoryEn || firebaseProduct.subSubCategory || null,
          // Store Hebrew names for search
          category_he: categoryHe || null,
          subCategory_he: subCategoryHe || null,
          subSubCategory_he: subSubCategoryHe || null,
          categories_path: categoriesPath,
          categories_path_id: categoriesPathId,
          // categoryId is guaranteed to be non-null here due to the guard above
          categoryId: categoryId!,
          isEnabled: firebaseProduct.isEnabled !== undefined ? firebaseProduct.isEnabled : true,
          isDeleted: firebaseProduct.isDeleted !== undefined ? firebaseProduct.isDeleted : false,
          featured: firebaseProduct.featured !== undefined ? firebaseProduct.featured : false,
          isNew: firebaseProduct.isNew !== undefined ? firebaseProduct.isNew : (firebaseProduct as any).newProduct !== undefined ? (firebaseProduct as any).newProduct : false,
          isActive: firebaseProduct.isActive !== undefined ? firebaseProduct.isActive : true,
          // SEO fields
          seo_title_en: firebaseProduct.seo?.title_en || null,
          seo_title_he: firebaseProduct.seo?.title_he || null,
          seo_description_en: firebaseProduct.seo?.description_en || null,
          seo_description_he: firebaseProduct.seo?.description_he || null,
          seo_slug: extensions?.seo?.slug || firebaseProduct.seo?.slug || null,
          seoFocusKeyword_en: extensions?.seo?.en?.focusKeyword || null,
          seoFocusKeyword_he: extensions?.seo?.he?.focusKeyword || null,
          seoSecondaryKeywords_en: extensions?.seo?.en?.secondaryKeywords || [],
          seoSecondaryKeywords_he: extensions?.seo?.he?.secondaryKeywords || [],
          searchKeywords,
          // Material & Care fields (from materialCare object). upperMaterial_en/he,
          // lining_en/he and sole_en/he are resolved from the new dropdown value when
          // present (falling back to the legacy free text otherwise) because
          // lib/inventory.ts and scripts/backfill-generated-search-keywords.ts read
          // these three legacy columns directly, independent of this sync route.
          upperMaterial_en: resolveMultiAttributeLabel(
            UPPER_MATERIAL_OPTIONS,
            extensions?.upperMaterial,
            'en',
            (firebaseProduct as any).materialCare?.upperMaterial_en || null
          ),
          upperMaterial_he: resolveMultiAttributeLabel(
            UPPER_MATERIAL_OPTIONS,
            extensions?.upperMaterial,
            'he',
            (firebaseProduct as any).materialCare?.upperMaterial_he || null
          ),
          materialInnerSole_en: (firebaseProduct as any).materialCare?.materialInnerSole_en || null,
          materialInnerSole_he: (firebaseProduct as any).materialCare?.materialInnerSole_he || null,
          lining_en: resolveAttributeLabel(
            LINING_OPTIONS,
            extensions?.lining,
            'en',
            (firebaseProduct as any).materialCare?.lining_en || null
          ),
          lining_he: resolveAttributeLabel(
            LINING_OPTIONS,
            extensions?.lining,
            'he',
            (firebaseProduct as any).materialCare?.lining_he || null
          ),
          sole_en: resolveAttributeLabel(
            OUTSOLE_OPTIONS,
            extensions?.outsole,
            'en',
            (firebaseProduct as any).materialCare?.sole_en || null
          ),
          sole_he: resolveAttributeLabel(
            OUTSOLE_OPTIONS,
            extensions?.outsole,
            'he',
            (firebaseProduct as any).materialCare?.sole_he || null
          ),
          heelHeight_en: (firebaseProduct as any).materialCare?.heelHeight_en || null,
          heelHeight_he: (firebaseProduct as any).materialCare?.heelHeight_he || null,
          shippingReturns_en: (firebaseProduct as any).materialCare?.shippingReturns_en || null,
          shippingReturns_he: (firebaseProduct as any).materialCare?.shippingReturns_he || null,
          // Structured specification additions (legacy free-text pairs)
          toeShape_en: extensions?.toeShape_en || null,
          toeShape_he: extensions?.toeShape_he || null,
          closureType_en: extensions?.closureType_en || null,
          closureType_he: extensions?.closureType_he || null,
          heelType_en: extensions?.heelType_en || null,
          heelType_he: extensions?.heelType_he || null,
          careInstructions_en: extensions?.careInstructions_en || null,
          careInstructions_he: extensions?.careInstructions_he || null,
          // Dropdown-backed attribute fields (single stable value; bare column
          // names distinct from the legacy *_en/*_he pairs above)
          upperMaterial: extensions?.upperMaterial || [],
          lining: extensions?.lining || null,
          insole: extensions?.insole || null,
          outsole: extensions?.outsole || null,
          soleType: extensions?.soleType || null,
          toeShape: extensions?.toeShape || null,
          heelType: extensions?.heelType || null,
          closureType: extensions?.closureType || null,
          heelHeight: extensions?.heelHeight || null,
          // Shoe fit & sizing
          sizeFit: extensions?.shoeFit?.sizeFit || null,
          footWidthFit: extensions?.shoeFit?.footWidthFit || null,
          archFit: extensions?.shoeFit?.archFit || null,
          adjustableFeatures: extensions?.shoeFit?.adjustableFeatures || [],
          fitRecommendation_en: extensions?.shoeFit?.recommendation_en || null,
          fitRecommendation_he: extensions?.shoeFit?.recommendation_he || null,
          fitNotes_en: extensions?.shoeFit?.notes_en || null,
          fitNotes_he: extensions?.shoeFit?.notes_he || null,
          // Structured measurements. `?? null` rather than `|| null` throughout
          // this block: `||` would turn a genuine 0 (zero external pockets) into
          // null, i.e. lose a real answer and call it unknown.
          heightCm: extensions?.heightCm ?? null,
          widthCm: extensions?.widthCm ?? null,
          depthCm: extensions?.depthCm ?? null,
          weightGrams: extensions?.weightGrams ?? null,
          // Bag attributes
          bagType: extensions?.bagSpecs?.bagType || null,
          intendedUse: extensions?.bagSpecs?.intendedUse || [],
          carryingOptions: extensions?.bagSpecs?.carryingOptions || [],
          bagStyle: extensions?.bagSpecs?.bagStyle || [],
          bagStructure: extensions?.bagSpecs?.bagStructure || null,
          strapType: extensions?.bagSpecs?.strapType || null,
          strapDropCm: extensions?.bagSpecs?.strapDropCm ?? null,
          adjustableStrap: extensions?.bagSpecs?.adjustableStrap ?? null,
          removableStrap: extensions?.bagSpecs?.removableStrap ?? null,
          mainCompartments: extensions?.bagSpecs?.mainCompartments ?? null,
          internalPockets: extensions?.bagSpecs?.internalPockets ?? null,
          externalPockets: extensions?.bagSpecs?.externalPockets ?? null,
          hardwareColor: extensions?.bagSpecs?.hardwareColor || null,
          baseFeet: extensions?.bagSpecs?.baseFeet ?? null,
          // Derived from the dimensions, with any admin override taking precedence.
          ...resolveBagDerivedColumns(extensions),
          colorVariants,
          tags: (firebaseProduct as any).tags || []
        }

        const searchDerived = buildProductSearchDerivedFields({
          title_he: productTitleHe,
          title_en: productTitleEn,
          category: categoryEn || firebaseProduct.category || '',
          subCategory: subCategoryEn || firebaseProduct.subCategory || null,
          subSubCategory: subSubCategoryEn || firebaseProduct.subSubCategory || null,
          category_he: categoryHe || null,
          subCategory_he: subCategoryHe || null,
          subSubCategory_he: subSubCategoryHe || null,
          brand: firebaseProduct.brand || '',
          tags: (firebaseProduct as any).tags || [],
          // Use the already-resolved (dropdown label, falling back to legacy text)
          // values computed above, so search keywords stay accurate once products
          // move onto the new dropdowns instead of the free-text fields.
          upperMaterial_he: productData.upperMaterial_he,
          lining_he: productData.lining_he,
          sole_he: productData.sole_he,
          // Bag attributes get resolved to HE+EN labels inside the builder, so a
          // search for "תיק צד" matches a crossbody structurally rather than
          // depending on the description happening to contain that phrase.
          bagType: productData.bagType,
          intendedUse: productData.intendedUse,
          carryingOptions: productData.carryingOptions,
          bagStyle: productData.bagStyle,
          colorVariants,
        })

        const productDataWithSearch = {
          ...productData,
          colors_search_norm: searchDerived.colors_search_norm,
          generated_search_keywords: searchDerived.generated_search_keywords,
        }

        if (existingProduct) {
          const updated = await prisma.product.update({
            where: { id: existingProduct.id },
            data: productDataWithSearch
          })
          updatedCount++
          console.log(`Updated product: ${productTitleEn}`)
          try {
            await upsertMeilisearchProduct(updated)
          } catch (meiliError) {
            console.warn(`Meilisearch upsert skipped for ${productTitleEn}:`, meiliError)
          }
        } else {
          const created = await prisma.product.create({
            data: productDataWithSearch
          })
          createdCount++
          console.log(`Created product: ${productTitleEn}`)
          try {
            await upsertMeilisearchProduct(created)
          } catch (meiliError) {
            console.warn(`Meilisearch upsert skipped for ${productTitleEn}:`, meiliError)
          }
        }
        
        syncedCount++
      } catch (error) {
        // Log full context for easier debugging in dev server logs
        console.error('Failed to sync product with detailed context:', {
          sku: (firebaseProduct as any).sku,
          baseSku: (firebaseProduct as any).baseSku,
          title_en: (firebaseProduct as any).title_en,
          error
        })

        const errorMsg = `Failed to sync product "${firebaseProduct.title_en || firebaseProduct.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }
    
    const result = {
      success: true,
      message: `Successfully synchronized ${syncedCount} products`,
      stats: {
        total: firebaseProducts.length,
        synced: syncedCount,
        created: createdCount,
        updated: updatedCount,
        deleted: deletedCount,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    }
    
    console.log('Product synchronization completed:', result)
    return NextResponse.json(result)
    
  } catch (error) {
    Sentry.captureException(error);
    console.error('Product synchronization error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to synchronize products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof NextResponse) return auth

    // Get products from both Firebase and Neon DB for comparison
    const firebaseProducts = await productService.getAllProducts()
    const neonProducts = await prisma.product.findMany({
      orderBy: { title_en: 'asc' }
    })
    
    // Compare products
    const firebaseSkus = firebaseProducts.map(product => product.sku || product.baseSku || '')
    const neonSkus = neonProducts.map(product => product.sku)
    
    const missingInNeon = firebaseSkus.filter(sku => !neonSkus.includes(sku))
    const extraInNeon = neonSkus.filter(sku => !firebaseSkus.includes(sku))
    
    return NextResponse.json({
      success: true,
      comparison: {
        firebase: {
          count: firebaseProducts.length,
          products: firebaseSkus
        },
        neon: {
          count: neonProducts.length,
          products: neonSkus
        },
        differences: {
          missingInNeon,
          extraInNeon,
          needsSync: missingInNeon.length > 0 || extraInNeon.length > 0
        }
      }
    })
    
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error comparing products:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to compare products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
