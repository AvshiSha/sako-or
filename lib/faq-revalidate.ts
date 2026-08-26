import 'server-only';

import { revalidatePath } from 'next/cache';
import { languages } from '@/i18n/settings';

/**
 * Flush every public surface that reflects FAQ content.
 *
 * Called at the end of every mutating FAQ route, so publishing, editing,
 * hiding, reordering and deleting all become visible without a deployment.
 *
 * Deliberately calls revalidatePath directly rather than going through
 * revalidateCmsPaths() (lib/cms-utils.ts). That helper exists because the blog
 * and static-page forms write from the browser via the client SDK and have no
 * server context to revalidate from, so they POST to /api/admin/revalidate. FAQ
 * writes already happen inside a route handler — the extra HTTP hop would buy
 * nothing, and it would inherit that helper's missing Authorization header.
 * Please do not "unify" these back together.
 */
export function revalidateFaqSurfaces(): void {
  for (const lng of languages) {
    revalidatePath(`/${lng}/faq`);
  }
  // The sitemap's FAQ lastmod and llms.txt's question list are both derived
  // from the same records, so they go stale on the same events.
  revalidatePath('/sitemap.xml');
  revalidatePath('/llms.txt');
}
