/**
 * Measure every image the blog actually references, and report what is off-spec.
 *
 * Reports. It does not convert anything, and there is deliberately no flag that
 * would make it. Re-cropping a published hero changes what the picture is of,
 * and doing that in bulk across a live blog is an editorial decision with a
 * person's name on it, not a migration.
 *
 * Every dimension here is read out of the file itself. The rendered size on the
 * page is a function of the layout and the viewport and tells you nothing about
 * the asset -- which is how a library at three different sizes went unnoticed
 * behind an `object-cover`.
 *
 * Usage:
 *   npm run audit:blog-images
 *   npm run audit:blog-images -- --json
 *
 * Needs the Firebase admin credentials, and `--conditions=react-server` so the
 * `server-only` import in lib/firebase-admin.ts resolves -- the same flag
 * scripts/verify-mcp-tools.ts runs under.
 */

import dotenv from 'dotenv'
import sharp from 'sharp'

dotenv.config({ path: '.env', quiet: true })
dotenv.config({ path: '.env.local', override: true, quiet: true })

import { assessBlogImage, BLOG_IMAGE_HEIGHT, BLOG_IMAGE_WIDTH } from '../lib/blog-image-spec'

const JSON_OUT = process.argv.includes('--json')

interface Finding {
  articleId: string
  slug: string
  status: string
  /** featuredImage | ogImage | body */
  role: string
  url: string
  width: number | null
  height: number | null
  format: string
  bytes: number
  verdict: string
  note: string
}

async function main() {
  const { adminDb } = await import('../lib/firebase-admin')

  const snapshot = await adminDb.collection('blogArticles').get()
  const findings: Finding[] = []
  const seen = new Map<string, { width: number; height: number; format: string; bytes: number }>()

  for (const doc of snapshot.docs) {
    const article = doc.data()
    const slug = String(article.slug ?? '')
    const status = String(article.status ?? '')

    const targets: Array<{ role: string; url: string }> = []
    if (article.featuredImage) targets.push({ role: 'featuredImage', url: String(article.featuredImage) })
    if (article.ogImage && article.ogImage !== article.featuredImage) {
      targets.push({ role: 'ogImage', url: String(article.ogImage) })
    }
    for (const locale of ['he', 'en'] as const) {
      const body = String(article.content?.[locale] ?? '')
      for (const match of body.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
        targets.push({ role: `body.${locale}`, url: decodeEntities(match[1]) })
      }
    }

    for (const target of targets) {
      // Measured once per distinct URL. The same hero is referenced by the
      // article and its OG tag, and the bodies reuse images across articles.
      let measured = seen.get(target.url)
      if (!measured) {
        const probed = await probe(target.url)
        if (!probed) {
          findings.push({
            articleId: doc.id,
            slug,
            status,
            role: target.role,
            url: target.url,
            width: null,
            height: null,
            format: '-',
            bytes: 0,
            verdict: 'unreadable',
            note: 'Could not be fetched or decoded. It may be a dead link on a live page.',
          })
          continue
        }
        measured = probed
        seen.set(target.url, probed)
      }

      // Body images are not editorial assets and are not held to the ratio.
      // They are still measured, because an oversized one is real download
      // weight on a phone and nothing else reports it.
      const isEditorial = target.role === 'featuredImage' || target.role === 'ogImage'
      const assessment = assessBlogImage({ width: measured.width, height: measured.height })

      const verdict = isEditorial
        ? assessment.verdict
        : measured.width > 1600
          ? 'oversized_body'
          : 'ok_body'

      if (verdict === 'exact' || verdict === 'ok_body') continue

      findings.push({
        articleId: doc.id,
        slug,
        status,
        role: target.role,
        url: target.url,
        width: measured.width,
        height: measured.height,
        format: measured.format,
        bytes: measured.bytes,
        verdict,
        note: isEditorial
          ? assessment.message
          : `${measured.width}px wide for a ~736px column.`,
      })
    }
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ target: { width: BLOG_IMAGE_WIDTH, height: BLOG_IMAGE_HEIGHT }, findings }, null, 2))
    return
  }

  report(findings, seen.size)
}

function report(findings: Finding[], distinctImages: number) {
  console.log(`\nBlog image audit — target ${BLOG_IMAGE_WIDTH}x${BLOG_IMAGE_HEIGHT}`)
  console.log(`${distinctImages} distinct images referenced.\n`)

  if (findings.length === 0) {
    console.log('Everything conforms. Nothing to do.')
    return
  }

  const groups = new Map<string, Finding[]>()
  for (const finding of findings) {
    const list = groups.get(finding.verdict) ?? []
    list.push(finding)
    groups.set(finding.verdict, list)
  }

  for (const [verdict, list] of groups) {
    console.log(`${verdict.toUpperCase()}  (${list.length})`)
    for (const f of list) {
      const size = f.width ? `${f.width}x${f.height}` : '?'
      console.log(`  ${f.slug || f.articleId} [${f.status}] ${f.role}: ${size} ${f.format}`)
      console.log(`      ${f.note}`)
      console.log(`      ${f.url}`)
    }
    console.log('')
  }

  console.log(
    'Nothing was changed. To re-cut an editorial image, re-upload it through the admin\n' +
      'panel or upload_article_image — both now store exactly ' +
      `${BLOG_IMAGE_WIDTH}x${BLOG_IMAGE_HEIGHT}.`
  )
}

async function probe(
  url: string
): Promise<{ width: number; height: number; format: string; bytes: number } | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    const metadata = await sharp(buffer).metadata()
    const height = metadata.pageHeight ?? metadata.height
    if (!metadata.width || !height) return null
    return {
      width: metadata.width,
      height,
      format: metadata.format ?? 'unknown',
      bytes: buffer.byteLength,
    }
  } catch {
    return null
  }
}

/** Article bodies are stored as HTML, so a src can carry &amp;. */
function decodeEntities(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
