import { storageService } from '@/lib/firebase'
import { BLOG_IMAGE_HEIGHT, BLOG_IMAGE_WIDTH } from '@/lib/blog-image-spec'
import { resizeBlogEditorialImageFile, resizeImageFile } from '@/lib/resize-image-file'

const CMS_MAX_WIDTH = BLOG_IMAGE_WIDTH
const CMS_MAX_HEIGHT = BLOG_IMAGE_HEIGHT

export async function uploadCmsImage(
  file: File,
  folder: 'blog' | 'categories',
  resize = false
): Promise<string> {
  const processed = resize
    ? await resizeImageFile(file, CMS_MAX_WIDTH, CMS_MAX_HEIGHT)
    : file
  return store(processed, folder)
}

/**
 * Upload a blog featured or Open Graph image at exactly 1200×628.
 *
 * Separate from `uploadCmsImage` rather than another flag on it. That function
 * fits an image inside a box when asked, which is the right behaviour for a
 * picture inside an article and the wrong one for the asset a link preview
 * renders: a 2000×1000 source goes in and 1200×600 comes out, and the page
 * then declares dimensions the file does not have.
 *
 * Throws BlogImageError with a message written for the person at the upload
 * button when the source cannot become 1200×628 without being enlarged, or
 * when cropping it would cut real content and nobody has said that is fine.
 */
export async function uploadBlogEditorialImage(
  file: File,
  options: { allowCrop?: boolean } = {}
): Promise<string> {
  const processed = await resizeBlogEditorialImageFile(file, options)
  return store(processed, 'blog')
}

function store(file: File, folder: 'blog' | 'categories'): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
  return storageService.uploadImage(file, fileName)
}

export {
  BlogImageError,
  resizeBlogEditorialImageFile,
  resizeImageFile,
  resizeProductImageFile,
} from '@/lib/resize-image-file'
