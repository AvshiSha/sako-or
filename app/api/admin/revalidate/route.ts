import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const paths: string[] = Array.isArray(body.paths) ? body.paths : []

    for (const path of paths) {
      if (typeof path === 'string' && path.startsWith('/')) {
        revalidatePath(path)
      }
    }

    return NextResponse.json({ revalidated: true, paths })
  } catch (error) {
    Sentry.captureException(error);
    console.error('Revalidation error:', error)
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 })
  }
}
