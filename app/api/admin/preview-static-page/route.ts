import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { sanitizeCmsHtml, stripInlineBlockWrapper } from '@/lib/sanitize-html'
import { requireAdmin } from '@/lib/server/auth'

// Sanitizes unsaved admin-form HTML server-side so the preview modal can
// safely render it without pulling the Node-only `sanitize-html` package
// into the client admin bundle.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title : ''
    const content = typeof body.content === 'string' ? body.content : ''

    return NextResponse.json({
      title: stripInlineBlockWrapper(title),
      content: sanitizeCmsHtml(content),
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error('Static page preview error:', error)
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 })
  }
}
