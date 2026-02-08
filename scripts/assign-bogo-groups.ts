import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { parseSku } from '../lib/sku-parser'

const GROUP_SKUS: Record<string, string[]> = {
  'Group 450': [
    '4925-2703',
    '4925-2704',
    '4725-1310',
    '4725-2725'

  ],
  'Group 500': [
    '4929-3123',
    '4724-0231',
    '4725-1201',
    '4725-1326',
    '4725-2521',
    '4725-2718',
    '4725-4007',
    '4725-6110',
    '4725-6119',
    '4726-8916'
  ],
  'Group 600': [
    '4925-1304',
    '4925-1309',
    '4925-1320',
    '4925-1327',
    '4925-2714',
    '4925-2715',
    '4925-2901',
    '4925-2913',
    '4925-4013',
    '4925-4031',
    '4925-6113',
    '4929-9281',
    '4929-9988',
    '4715-0603',
    '4715-0701',
    '4725-1007',
    '4725-1011',
    '4725-1207',
    '4725-1305',
    '4725-2915',
    '4725-6108',
    '4725-6109',
  ],
  'Group 700': [
    '4922-1804',
    '4924-0001',
    '4925-0301',
    '4925-0310',
    '4925-1205',
    '4925-1210',
    '4925-1329',
    '4925-2512',
    '4925-4001',
    '4925-6107',
    '4925-6108',
    '4925-6170',
    '4925-6180',
    '4929-2318',
    '4929-3985',
    '4929-9521',
    '4725-1210',
    '4725-3315',
    '4725-6105'
  ],
  'Group 800': [
    '4922-5394',
    '4924-0605',
    '4924-7168',
    '4924-7187',
    '4924-8017',
    '4925-1302',
    '4929-2668',
    '4704-0007',
    '4704-0010',
    '4704-0061',
    '4712-4218',
    '4713-0100',
    '4713-0201'
  ]
}

async function main() {
  // 1) Load all BogoGroups
  const groups = await prisma.bogoGroup.findMany()
  const groupByName = new Map(groups.map(g => [g.name, g.id]))

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