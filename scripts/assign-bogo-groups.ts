import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { parseSku } from '../lib/sku-parser'
import { GROUP_SKUS, GROUP_PAIR_PRICES } from './bogo-groups-data'

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  if (DRY_RUN) {
    console.log('--- DRY RUN: no writes will be made ---')
  }

  // 0) Ensure BogoGroups exist (e.g. for fresh production/Neon)
  const existingGroups = await prisma.bogoGroup.findMany()
  const groupByName = new Map(existingGroups.map(g => [g.name, g.id]))

  for (const groupName of Object.keys(GROUP_SKUS)) {
    if (groupByName.has(groupName)) continue
    const pairPriceIls = GROUP_PAIR_PRICES[groupName] ?? 0
    if (DRY_RUN) {
      console.log(`Would create BogoGroup: ${groupName} (pairPriceIls: ${pairPriceIls})`)
      continue
    }
    const created = await prisma.bogoGroup.create({
      data: { name: groupName, pairPriceIls }
    })
    groupByName.set(groupName, created.id)
    console.log(`Created BogoGroup: ${groupName} (pairPriceIls: ${pairPriceIls})`)
  }

  // 1) Disable groups that are no longer in GROUP_SKUS (e.g. Group 450/500/800):
  // unassign every product still pointing at them, but leave the group row itself intact.
  const activeGroupIds = new Set(
    Object.keys(GROUP_SKUS)
      .map(name => groupByName.get(name))
      .filter((id): id is string => Boolean(id))
  )

  for (const group of existingGroups) {
    if (activeGroupIds.has(group.id)) continue

    const affected = await prisma.product.count({ where: { bogoGroupId: group.id } })
    if (affected === 0) continue

    if (DRY_RUN) {
      console.log(`Would disable ${group.name}: unassign ${affected} products`)
      continue
    }

    const cleared = await prisma.product.updateMany({
      where: { bogoGroupId: group.id },
      data: { bogoGroupId: null },
    })
    console.log(`Disabled ${group.name}: unassigned ${cleared.count} products`)
  }

  // 2) Sync each active group's membership to exactly the SKUs listed above.
  for (const [groupName, skus] of Object.entries(GROUP_SKUS)) {
    const groupId = groupByName.get(groupName)
    if (!groupId) {
      console.warn(`Skipping ${groupName} – BogoGroup not found`)
      continue
    }

    // Normalize to base SKU (handles full SKUs like 0000-0001-black-37)
    const baseSkus = Array.from(
      new Set(
        skus
          .map(sku => parseSku(sku).baseSku || sku)
          .filter(Boolean)
      )
    )

    // Remove products currently in this group that are no longer in the new list
    const staleCount = await prisma.product.count({
      where: { bogoGroupId: groupId, sku: { notIn: baseSkus } },
    })
    if (staleCount > 0) {
      if (DRY_RUN) {
        console.log(`[${groupName}] Would remove ${staleCount} products no longer in the list`)
      } else {
        const removed = await prisma.product.updateMany({
          where: { bogoGroupId: groupId, sku: { notIn: baseSkus } },
          data: { bogoGroupId: null },
        })
        console.log(`[${groupName}] Removed ${removed.count} products no longer in the list`)
      }
    }

    if (baseSkus.length === 0) continue

    // Check which of the requested SKUs actually exist in the Product table
    const existingProducts = await prisma.product.findMany({
      where: { sku: { in: baseSkus } },
      select: { sku: true },
    })
    const foundSkus = new Set(existingProducts.map(p => p.sku))
    const missingSkus = baseSkus.filter(sku => !foundSkus.has(sku))

    if (missingSkus.length > 0) {
      console.log(
        `[${groupName}] Requested ${baseSkus.length} SKUs. Missing in DB (${missingSkus.length}): ${missingSkus.join(', ')}`
      )
    }

    if (DRY_RUN) {
      console.log(`[${groupName}] Would assign ${foundSkus.size} products (SKUs in list: ${baseSkus.length})`)
      continue
    }

    const result = await prisma.product.updateMany({
      where: { sku: { in: baseSkus } },
      data: { bogoGroupId: groupId },
    })

    console.log(
      `Assigned ${result.count} products to ${groupName} (SKUs in list: ${baseSkus.length}, updated: ${result.count}${missingSkus.length > 0 ? `, not in DB: ${missingSkus.join(', ')}` : ''})`
    )
  }
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })