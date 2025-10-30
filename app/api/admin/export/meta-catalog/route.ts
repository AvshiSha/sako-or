import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const apiKey = process.env.ADMIN_API_KEY
  if (!apiKey) {
    return new NextResponse('Server not configured', { status: 500 })
  }

  const upstream = await fetch(`${origin}/api/export/meta-catalog`, {
    headers: {
      'x-api-key': apiKey
    },
    cache: 'no-store'
  })

  // If upstream failed, pass through status and body as-is
  if (!upstream.ok) {
    const errorText = await upstream.text()
    return new NextResponse(errorText, { status: upstream.status })
  }

  // Stream bytes to preserve BOM and exact encoding
  const arrayBuffer = await upstream.arrayBuffer()
  const contentDisposition = upstream.headers.get('content-disposition') || 'attachment; filename="meta_catalog.csv"'
  const contentType = upstream.headers.get('content-type') || 'text/csv; charset=utf-8'

  return new NextResponse(new Uint8Array(arrayBuffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': contentDisposition
    }
  })
}


