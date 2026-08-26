import 'server-only';

import { adminDb } from '@/lib/firebase-admin';
import {
  FAQ_COLLECTION,
  FAQ_SETTINGS_COLLECTION,
  FAQ_SETTINGS_DOC_ID,
  type FaqItem,
  type FaqPageSettings,
} from '@/lib/faq-types';
import { sanitizeFaqAnswerHtml } from '@/lib/sanitize-html';
import { cmsHtmlToPlainText } from '@/lib/cms-html-cleanup';

/**
 * Server-side FAQ writes, using the Admin SDK (which bypasses firestore.rules —
 * authorization is enforced by requireAdmin in the route handlers above these).
 *
 * Firestore batches cap at 500 operations. A reorder touches at most one
 * audience group, so this is far from binding in practice, but the chunking
 * keeps it honest — same approach as writeSortOrders in lib/category-mutations.
 */
const BATCH_LIMIT = 450;

/** Every FAQ document, unsorted. Callers sort with lib/faq-order helpers. */
export async function getAllFaqsAdmin(): Promise<FaqItem[]> {
  const snapshot = await adminDb.collection(FAQ_COLLECTION).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as FaqItem[];
}

export async function getFaqAdmin(id: string): Promise<FaqItem | null> {
  const snap = await adminDb.collection(FAQ_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as FaqItem;
}


export async function writeFaqOrders(
  updates: Array<{ id: string; order: number }>
): Promise<number> {
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
    const chunk = updates.slice(i, i + BATCH_LIMIT);
    const batch = adminDb.batch();
    for (const { id, order } of chunk) {
      batch.update(adminDb.collection(FAQ_COLLECTION).doc(id), { order });
    }
    await batch.commit();
    written += chunk.length;
  }
  return written;
}

/**
 * Both halves of the input contract for an answer, in one pass.
 *
 * Sanitizing here — on input, in a server route — is the reason FAQ writes do
 * not use the client SDK like blogService does: sanitize-html is Node-only, so
 * a browser write could only sanitize on output, leaving raw admin HTML in the
 * database for anything else that reads it.
 */
export interface SanitizedAnswer {
  he: string;
  en: string;
  /** Non-blocking notes to show the admin, e.g. a demoted heading. */
  warnings: string[];
}

export function sanitizeAnswerField(
  answer: { he?: string; en?: string },
  headingWasDemoted: (html: string) => boolean
): SanitizedAnswer {
  const warnings: string[] = [];
  const he = sanitizeFaqAnswerHtml(answer.he ?? '');
  const en = sanitizeFaqAnswerHtml(answer.en ?? '');

  if (headingWasDemoted(answer.he ?? '') || headingWasDemoted(answer.en ?? '')) {
    warnings.push(
      'A heading in the answer was converted to H3. The page already provides the H1, and each question is an H2.'
    );
  }

  return { he, en, warnings };
}

/** Strip any markup an admin pasted into the question field. */
export function plainTextQuestion(question: { he?: string; en?: string }): {
  he: string;
  en: string;
} {
  return {
    he: cmsHtmlToPlainText(question.he ?? '').slice(0, 300),
    en: cmsHtmlToPlainText(question.en ?? '').slice(0, 300),
  };
}

export async function createFaqDoc(data: Record<string, unknown>): Promise<string> {
  const ref = await adminDb.collection(FAQ_COLLECTION).add(data);
  return ref.id;
}

export async function updateFaqDoc(id: string, data: Record<string, unknown>): Promise<void> {
  await adminDb.collection(FAQ_COLLECTION).doc(id).update(data);
}

export async function deleteFaqDoc(id: string): Promise<void> {
  await adminDb.collection(FAQ_COLLECTION).doc(id).delete();
}

export async function getFaqSettingsAdmin(): Promise<FaqPageSettings | null> {
  const snap = await adminDb
    .collection(FAQ_SETTINGS_COLLECTION)
    .doc(FAQ_SETTINGS_DOC_ID)
    .get();
  if (!snap.exists) return null;
  return { key: FAQ_SETTINGS_DOC_ID, ...snap.data() } as FaqPageSettings;
}

export async function upsertFaqSettings(data: Record<string, unknown>): Promise<void> {
  await adminDb
    .collection(FAQ_SETTINGS_COLLECTION)
    .doc(FAQ_SETTINGS_DOC_ID)
    .set(data, { merge: true });
}
