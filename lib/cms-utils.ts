export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function revalidateCmsPaths(
  paths: string[],
  options?: { navigation?: boolean }
): Promise<void> {
  try {
    await fetch('/api/admin/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths, navigation: options?.navigation === true }),
    })
  } catch (error) {
    console.error('Failed to revalidate paths:', error)
  }
}

/**
 * Flush the storefront navigation after a category create, edit or delete made
 * through the client SDK. Category mutations change the nav even when no
 * collection path is affected - a brand new category has no old path to
 * revalidate, so path-based revalidation alone misses it.
 */
export async function revalidateNavigationCategories(): Promise<void> {
  await revalidateCmsPaths([], { navigation: true })
}
