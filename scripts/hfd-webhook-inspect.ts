import 'dotenv/config'
import { createScriptPrisma } from './script-prisma'

/**
 * Shows what HFD actually sends to our webhook, so the right auth mode can be
 * chosen from evidence rather than guessed.
 *
 * Every inbound delivery is recorded in `webhook_events`, including a snapshot of
 * the request headers with credential values replaced by a length + SHA-256
 * fingerprint. That is enough to answer the two questions that matter:
 *   1. Which header carries a credential?
 *   2. Is its value the same on every delivery (a static token) or different each
 *      time (a signature over the body)?
 *
 * Usage:
 *   npm run hfd:inspect              # last 20 deliveries
 *   npm run hfd:inspect -- 50        # last 50
 *
 * Read-only.
 */

const prisma = createScriptPrisma()

/** Headers that carry no signal about authentication. */
const BORING = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'connection',
  'content-length',
  'content-type',
  'host',
  'user-agent',
  'cache-control',
  'pragma',
])

function isInteresting(name: string): boolean {
  const lower = name.toLowerCase()
  if (BORING.has(lower)) return false
  if (lower.startsWith('x-vercel-')) return false
  if (lower.startsWith('x-forwarded-')) return false
  if (lower.startsWith('sec-')) return false
  return true
}

async function main() {
  const limit = Math.min(Math.max(parseInt(process.argv[2] ?? '20', 10) || 20, 1), 200)

  const events = await prisma.webhookEvent.findMany({
    where: { provider: 'hfd' },
    orderBy: { receivedAt: 'desc' },
    take: limit,
    select: {
      receivedAt: true,
      authOutcome: true,
      status: true,
      orderNumber: true,
      headers: true,
      error: true,
    },
  })

  if (events.length === 0) {
    console.log('\nNo HFD webhook deliveries recorded yet.')
    console.log('Once HFD sends a real PUSH, re-run this to see which headers they use.\n')
    return
  }

  console.log(`\nLast ${events.length} HFD webhook deliveries:\n`)
  for (const event of events) {
    const when = event.receivedAt.toISOString().replace('T', ' ').slice(0, 19)
    console.log(
      `  ${when}  ${event.authOutcome.padEnd(16)} ${event.status.padEnd(14)} ${event.orderNumber ?? '-'}`
    )
    if (event.error) console.log(`      error: ${event.error}`)
  }

  // Which candidate credential headers appear, and are their values stable?
  const seen = new Map<string, Set<string>>()
  for (const event of events) {
    const headers = (event.headers ?? {}) as Record<string, string>
    for (const [name, value] of Object.entries(headers)) {
      if (!isInteresting(name)) continue
      if (!seen.has(name)) seen.set(name, new Set())
      seen.get(name)!.add(value)
    }
  }

  console.log('\nCandidate auth headers (credential values are fingerprinted, not stored):\n')
  if (seen.size === 0) {
    console.log('  None. HFD sent no distinctive headers — ask them how PUSH authenticates.\n')
    return
  }

  for (const [name, values] of [...seen.entries()].sort()) {
    const distinct = values.size
    const sample = [...values][0]
    const verdict =
      distinct === 1
        ? 'CONSTANT across deliveries -> a static token (use "secret" or "bearer")'
        : `${distinct} distinct values -> changes per request (likely an HMAC signature)`
    console.log(`  ${name}`)
    console.log(`    ${sample}`)
    console.log(`    ${verdict}\n`)
  }

  console.log('Then set, in production:')
  console.log('  HFD_WEBHOOK_AUTH_MODE = secret | bearer | hmac   (never "on")')
  console.log('  HFD_WEBHOOK_SECRET    = <the value HFD sends>')
  console.log('  HFD_WEBHOOK_HEADER    = <header name, if not the default>\n')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
