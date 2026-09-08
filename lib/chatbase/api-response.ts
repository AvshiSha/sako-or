import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { verifyChatbaseRequest } from '@/lib/chatbase/auth'
import { consumeRateLimit } from '@/lib/chatbase/rate-limit'

export type ApiSuccess<T> = {
  success: true
  requestId: string
  data: T
}

export type ApiError = {
  success: false
  requestId: string
  error: {
    code: ApiErrorCode
    message: string
    /** Field-path -> human message, for validation failures only. */
    fields?: Record<string, string>
  }
}

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'ENDPOINT_NOT_CONFIGURED'
  | 'INVALID_REQUEST'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

const ERROR_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  ENDPOINT_NOT_CONFIGURED: 500,
  INVALID_REQUEST: 400,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
}

/**
 * Messages returned to Chatbase. Deliberately generic: they describe what the
 * caller should do, never what went wrong inside the server. Stack traces, SQL,
 * connection details and secrets never reach a response body.
 */
const ERROR_MESSAGE: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: 'Authentication failed.',
  ENDPOINT_NOT_CONFIGURED: 'This endpoint is not available.',
  INVALID_REQUEST: 'One or more request parameters are invalid.',
  RATE_LIMITED: 'Too many requests. Try again shortly.',
  INTERNAL_ERROR: 'The request could not be completed.',
}

export function successResponse<T>(requestId: string, data: T): NextResponse {
  const body: ApiSuccess<T> = { success: true, requestId, data }
  return NextResponse.json(body, {
    // Availability changes under us; a cached answer would outlive its truth.
    headers: { 'Cache-Control': 'no-store' },
  })
}

export function errorResponse(
  requestId: string,
  code: ApiErrorCode,
  fields?: Record<string, string>
): NextResponse {
  const body: ApiError = {
    success: false,
    requestId,
    error: { code, message: ERROR_MESSAGE[code], ...(fields ? { fields } : {}) },
  }
  return NextResponse.json(body, {
    status: ERROR_STATUS[code],
    headers: { 'Cache-Control': 'no-store' },
  })
}

/** Thrown by a handler to return a validation failure without unwinding through a catch-all. */
export class ChatbaseRequestError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly fields?: Record<string, string>
  ) {
    super(code)
    this.name = 'ChatbaseRequestError'
  }
}

type RouteContext = {
  requestId: string
  /** Set by the handler so the completion log can record how much was returned. */
  setResultCount: (count: number) => void
}

/**
 * Auth -> rate limit -> parse -> handler, with one structured log line per
 * request. Every Chatbase route goes through this so the envelope, the status
 * codes and the log shape cannot drift apart between routes.
 */
export function withChatbaseRoute<T>(
  routeName: string,
  handler: (body: Record<string, unknown>, context: RouteContext) => Promise<T>
): (request: Request) => Promise<NextResponse> {
  return async function chatbaseRoute(request: Request): Promise<NextResponse> {
    const requestId = randomUUID()
    const startedAt = Date.now()
    let resultCount: number | undefined

    const log = (outcome: string, extra?: Record<string, unknown>) => {
      // No request body, no customer text, and never the credential - only what
      // is needed to diagnose a failing action.
      console.log(
        `[CHATBASE_${routeName.toUpperCase()}]`,
        JSON.stringify({
          requestId,
          outcome,
          durationMs: Date.now() - startedAt,
          ...(resultCount === undefined ? {} : { resultCount }),
          ...extra,
        })
      )
    }

    const auth = verifyChatbaseRequest(request)
    if (!auth.ok) {
      if (auth.reason === 'not_configured') {
        log('endpoint_not_configured')
        return errorResponse(requestId, 'ENDPOINT_NOT_CONFIGURED')
      }
      // Logged without the supplied credential, deliberately.
      log('unauthorized')
      return errorResponse(requestId, 'UNAUTHORIZED')
    }

    if (!consumeRateLimit(routeName)) {
      log('rate_limited')
      return errorResponse(requestId, 'RATE_LIMITED')
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      log('invalid_json')
      return errorResponse(requestId, 'INVALID_REQUEST', { body: 'Expected a JSON object.' })
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      log('invalid_body')
      return errorResponse(requestId, 'INVALID_REQUEST', { body: 'Expected a JSON object.' })
    }

    try {
      const data = await handler(body as Record<string, unknown>, {
        requestId,
        setResultCount: (count) => {
          resultCount = count
        },
      })
      log('ok')
      return successResponse(requestId, data)
    } catch (error) {
      if (error instanceof ChatbaseRequestError) {
        log('validation_failed', { code: error.code, fields: Object.keys(error.fields ?? {}) })
        return errorResponse(requestId, error.code, error.fields)
      }
      Sentry.captureException(error, { tags: { route: routeName }, extra: { requestId } })
      log('internal_error')
      console.error(`[CHATBASE_${routeName.toUpperCase()}] Unhandled error:`, error)
      return errorResponse(requestId, 'INTERNAL_ERROR')
    }
  }
}
