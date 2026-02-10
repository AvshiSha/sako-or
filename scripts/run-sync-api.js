/**
 * Run the product sync API locally.
 * Start the dev server first: npm run dev
 * Then run: node scripts/run-sync-api.js
 */
const base = process.env.APP_BASE_URL || 'http://localhost:3000'
const SYNC_URL = base + '/api/admin/products/sync'

async function main() {
  console.log('Target:', SYNC_URL)
  console.log('Sending POST request...')
  console.log('(Sync can take 1–3 minutes; you will see progress below.)\n')

  const start = Date.now()
  const progressInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - start) / 1000)
    console.log(`  ... still waiting (${elapsed}s) – server is syncing Firebase → Neon ...`)
  }, 10000)

  let res
  try {
    res = await fetch(SYNC_URL, { method: 'POST' })
  } finally {
    clearInterval(progressInterval)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\nResponse received in ${elapsed}s.`)
  console.log('Status:', res.status, res.statusText)

  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }

  if (body && typeof body === 'object' && body.stats) {
    console.log('\nStats:', body.stats)
    if (body.errors && body.errors.length > 0) {
      console.log('\nErrors (' + body.errors.length + '):')
      body.errors.slice(0, 10).forEach((e, i) => console.log('  ', i + 1, e))
      if (body.errors.length > 10) {
        console.log('  ... and', body.errors.length - 10, 'more')
      }
    }
  }
  console.log('\nFull response:', JSON.stringify(body, null, 2))
  process.exit(res.ok ? 0 : 1)
}

main().catch((err) => {
  console.error('Request failed:', err.message)
  process.exit(1)
})
