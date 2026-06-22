import { storageService } from '@/lib/firebase'
import { resizeImageFile } from '@/lib/resize-image-file'

const CMS_MAX_WIDTH = 1200
const CMS_MAX_HEIGHT = 628

export async function uploadCmsImage(
  file: File,
  folder: 'blog' | 'categories',
  resize = false
): Promise<string> {
  const processed = resize
    ? await resizeImageFile(file, CMS_MAX_WIDTH, CMS_MAX_HEIGHT)
    : file
  const ext = processed.name.split('.').pop() || 'jpg'
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
  return storageService.uploadImage(processed, fileName)
}

export { resizeImageFile, resizeProductImageFile } from '@/lib/resize-image-file'
