import 'server-only'

import { createHash, randomUUID } from 'node:crypto'

import { adminStorage } from '@/lib/firebase-admin'
import { CONTENT_MEDIA_PREFIX, STORAGE_HOST } from '@/lib/mcp/field-allowlist'
import {
  DEFAULT_DEPS,
  decodeBase64Image,
  extensionFor,
  fetchRemoteImage,
  type ImageImportDeps,
} from '@/lib/mcp/image-fetch'
import {
  conformEditorialImage,
  conformInlineImage,
  type ImagePurpose,
} from '@/lib/mcp/image-transform'
import { McpValidationError } from '@/lib/mcp/validation'

/**
 * Writing a validated article image into Firebase Storage.
 *
 * All the deciding happens in lib/mcp/image-fetch.ts -- the SSRF guard, the
 * size caps, the format and magic-byte checks. This file only stores what that
 * one approved, which is why it is the only half that needs `server-only`.
 */

interface StoredImage {
  storagePath: string
  url: string
  contentType: string
  bytes: number
  /** True when the object already existed and the upload was skipped. */
  reused: boolean
}

export interface ImportedImage extends StoredImage {
  /** Dimensions of what was actually stored, measured rather than assumed. */
  width: number
  height: number
  /** Dimensions and type of the file as supplied. */
  source: { width: number; height: number; contentType: string }
  /** True when the stored bytes differ from the supplied ones. */
  resized: boolean
  warnings: string[]
}

/**
 * Store the bytes under a content-addressed path and return a download URL.
 *
 * The path is derived from a SHA-1 of the content, the same scheme
 * scripts/upload-new-collection-banners.ts uses: re-importing an identical
 * image is a no-op that returns the existing URL, so a retried article import
 * does not litter the bucket with duplicates.
 *
 * The download token is minted here rather than read back, because the Admin
 * SDK has no getDownloadURL -- the token goes into the object's metadata and
 * the URL is assembled from it, again following the existing script.
 */
async function storeImage(bytes: Buffer, contentType: string): Promise<StoredImage> {
  const extension = extensionFor(contentType)
  if (!extension) {
    // Unreachable while image-fetch gates the type, which it does. Checked
    // anyway rather than defaulting to .jpg: a wrong extension on an immutable,
    // content-addressed object is not something a later upload can correct.
    throw new McpValidationError('INVALID_REQUEST', [
      `No storage extension is defined for "${contentType}".`,
    ])
  }

  const digest = createHash('sha1').update(bytes).digest('hex').slice(0, 16)
  const storagePath = `${CONTENT_MEDIA_PREFIX}${digest}.${extension}`

  const bucketName =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    `${process.env.FIREBASE_PROJECT_ID ?? 'sako-or'}.firebasestorage.app`

  const bucket = adminStorage.bucket(bucketName)
  const file = bucket.file(storagePath)

  const [exists] = await file.exists()
  if (exists) {
    const [metadata] = await file.getMetadata()
    const existingToken = (
      metadata.metadata?.firebaseStorageDownloadTokens as string | undefined
    )?.split(',')[0]
    if (existingToken) {
      return {
        storagePath,
        url: downloadUrl(bucketName, storagePath, existingToken),
        contentType,
        bytes: bytes.byteLength,
        reused: true,
      }
    }
    // Present but tokenless (uploaded by something else). Fall through and
    // re-save so it gets a token, rather than returning a URL that 403s.
  }

  const token = randomUUID()
  await file.save(bytes, {
    resumable: false,
    contentType,
    metadata: {
      // Matches storageService.uploadImage. Content-addressed paths are
      // immutable by construction, so a one-year immutable cache is honest.
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })

  return {
    storagePath,
    url: downloadUrl(bucketName, storagePath, token),
    contentType,
    bytes: bytes.byteLength,
    reused: false,
  }
}

function downloadUrl(bucket: string, objectPath: string, token: string): string {
  return (
    `https://${STORAGE_HOST}/v0/b/${bucket}/o/` +
    `${encodeURIComponent(objectPath)}?alt=media&token=${token}`
  )
}

/** The one entry point: exactly one of imageBase64 or sourceUrl. */
export async function importArticleImage(
  input: {
    imageBase64?: string
    mimeType?: string
    sourceUrl?: string
    /** 'editorial' (featured/OG, forced to 1200x628) or 'inline' (body images). */
    purpose?: ImagePurpose
    /** Consent to a centre crop when an editorial source is the wrong shape. */
    allowCrop?: boolean
  },
  deps: ImageImportDeps = DEFAULT_DEPS
): Promise<ImportedImage> {
  const hasBase64 = Boolean(input.imageBase64?.trim())
  const hasUrl = Boolean(input.sourceUrl?.trim())

  if (hasBase64 === hasUrl) {
    throw new McpValidationError('INVALID_REQUEST', [
      'Provide exactly one of imageBase64 or sourceUrl.',
    ])
  }

  const fetched = hasBase64
    ? decodeBase64Image(input.imageBase64!, input.mimeType)
    : await fetchRemoteImage(input.sourceUrl!, deps)

  // Dimensions are settled before anything is written, so a refusal costs a
  // decode rather than an object in the bucket that nothing will ever
  // reference.
  const conformed =
    input.purpose === 'inline'
      ? await conformInlineImage(fetched.bytes, fetched.contentType)
      : await conformEditorialImage(fetched.bytes, fetched.contentType, {
          allowCrop: input.allowCrop === true,
        })

  const stored = await storeImage(conformed.bytes, conformed.contentType)

  return {
    ...stored,
    width: conformed.width,
    height: conformed.height,
    source: conformed.source,
    resized: !conformed.unchanged,
    warnings: conformed.warnings,
  }
}

export { MAX_IMAGE_BYTES, MAX_REMOTE_IMAGE_BYTES } from '@/lib/mcp/image-fetch'
export type { ImageImportDeps } from '@/lib/mcp/image-fetch'
