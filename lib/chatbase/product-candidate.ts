import { prisma } from '@/lib/prisma'
import { CANDIDATE_COLUMNS, type ProductCandidate } from '@/lib/chatbase/product-query'

/**
 * Load one product's specification row by SKU.
 *
 * find_similar_shoes needs the source product's specifications to decide what
 * "similar" means, and they live in Postgres alongside everything it compares
 * against. Reading the source from the same place as the candidates is what
 * keeps the comparison apples-to-apples.
 */
export async function loadCandidateBySku(sku: string): Promise<ProductCandidate | null> {
  const rows = await prisma.$queryRaw<ProductCandidate[]>`
    SELECT ${CANDIDATE_COLUMNS}
    FROM products p
    WHERE p.sku = ${sku}
      AND p."isEnabled" = true
      AND p."isDeleted" = false
    LIMIT 1
  `
  return rows[0] ?? null
}
