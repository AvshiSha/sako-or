import 'server-only'

import { prisma } from '@/lib/prisma'
import { ADMIN_ROLE, isAdminEmail, normalizeEmail } from '@/lib/admin'

export async function resolveIsAdmin(
  email: string | null | undefined,
  firebaseUid?: string | null
): Promise<boolean> {
  if (isAdminEmail(email)) return true

  if (firebaseUid) {
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      select: { role: true },
    })
    if (user?.role === ADMIN_ROLE) return true
  }

  const normalized = normalizeEmail(email)
  if (normalized) {
    const user = await prisma.user.findUnique({
      where: { email: normalized },
      select: { role: true },
    })
    if (user?.role === ADMIN_ROLE) return true
  }

  return false
}
