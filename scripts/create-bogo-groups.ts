/**
 * One-off script to seed the automatic BOGO deal groups.
 *
 * Run this AFTER running the Prisma migration that creates:
 * - BogoGroup model
 * - Product.bogoGroupId
 */

import 'dotenv/config'
import { prisma } from '../lib/prisma'

async function createBogoGroups() {
  const groups = [
    { name: 'Group 450', pairPriceIls: 450 },
    { name: 'Group 500', pairPriceIls: 500 },
    { name: 'Group 600', pairPriceIls: 600 },
    { name: 'Group 700', pairPriceIls: 700 },
    { name: 'Group 800', pairPriceIls: 800 }
  ]

  console.log('Creating BogoGroup records...')

  // Use createMany via a loose cast to avoid type issues when the
  // local Prisma client types haven't been regenerated yet.
  // Once you run `prisma generate`, `prisma.bogoGroup` will be fully typed.
  await (prisma as any).bogoGroup.createMany({
    data: groups
  })

  console.log('Created BogoGroup rows:', groups)
}

async function main() {
  try {
    await createBogoGroups()
  } catch (error) {
    console.error('Failed to create BogoGroup records:', error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()

