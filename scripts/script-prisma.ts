import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Prisma client for standalone scripts (tsx).
 * Loads .env and falls back to DIRECT_URL when DATABASE_URL is unset.
 */
export function createScriptPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL

  if (!connectionString) {
    throw new Error(
      'Missing DATABASE_URL or DIRECT_URL. Add your Neon connection string to .env in the project root.'
    )
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })
}
