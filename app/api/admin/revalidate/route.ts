import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { revalidateNavigationCategories } from '@/lib/navigation-revalidate'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const paths: string[] = Array.isArray(body.paths) ? body.paths : []

    for (const path of paths) {
      if (typeof path === 'string' && path.startsWith('/')) {
        revalidatePath(path)
      }
    }

    // Category writes still go through the client SDK form, so the admin page
    // asks for the navigation flush over this route rather than doing it in a
    // route handler of its own.
    const navigation = body.navigation === true
    if (navigation) {
      revalidateNavigationCategories()
    }

    return NextResponse.json({ revalidated: true, paths, navigation })
  } catch (error) {
    Sentry.captureException(error);
    console.error('Revalidation error:', error)
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 })
  }
}
