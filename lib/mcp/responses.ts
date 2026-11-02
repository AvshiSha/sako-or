import type { CallToolResult } from '@modelcontextprotocol/server'

import { McpValidationError, type McpErrorCode } from '@/lib/mcp/validation'
import { utcToLocalWallClock } from '@/lib/blog-schedule'

/**
 * The single result shape every MCP tool returns.
 *
 * Both halves are filled on every call: `structuredContent` for a client that
 * parses, and a `text` block for the model that reads. ChatGPT consumes the
 * text, so a result that only populated structuredContent would be invisible to
 * the thing actually deciding what to do next.
 *
 * Validation failures come back as results, not protocol errors. An MCP error
 * reaches the model as an opaque failure it cannot act on; a result saying
 * "seoDescription.he is 210 characters, the maximum is 160" gets corrected on
 * the next call without a human in the loop.
 */

export interface McpToolResult {
  ok: boolean
  contentId?: string
  contentType?: string
  /** draft | scheduled | published, for content tools. */
  status?: string
  /** The public URL, once there is one. */
  url?: string
  /** UTC instant the article is scheduled for. */
  publishAt?: string
  /** The same instant as Jerusalem wall-clock, so nobody has to convert it. */
  publishAtLocal?: string
  /** Whether a create actually created, or found an existing article by sourceRef. */
  created?: boolean
  /** Non-blocking notes: stripped markup, over-length SEO fields. */
  warnings?: string[]
  /** Blocking problems. Non-empty implies ok === false. */
  errors?: string[]
  errorCode?: McpErrorCode
  /** Opaque conflict token to pass back as expectedUpdatedAt on the next write. */
  updatedAt?: string
  /** Arbitrary tool-specific payload (search hits, field values, upload details). */
  data?: unknown
}

/**
 * Human-readable summary of a result.
 *
 * Written for a language model deciding its next call, so it leads with the
 * outcome and then says what to do about it. Publication status is stated
 * separately from indexing on purpose -- "published" means the URL is live, and
 * nothing here implies Google has seen it.
 */
function summarize(result: McpToolResult): string {
  const lines: string[] = []

  if (result.ok) {
    const what = [result.contentType, result.contentId].filter(Boolean).join(' ')
    lines.push(`OK${what ? `: ${what}` : ''}`)
    if (result.created === false) {
      lines.push('This source reference already had an article; the existing one was reused.')
    }
    if (result.status) lines.push(`Status: ${result.status}`)
    if (result.publishAt) {
      lines.push(
        `Scheduled for ${result.publishAtLocal ?? result.publishAt} Asia/Jerusalem ` +
          `(${result.publishAt} UTC).`
      )
    }
    if (result.url) lines.push(`URL: ${result.url}`)
    if (result.updatedAt) {
      lines.push(`Pass expectedUpdatedAt="${result.updatedAt}" on the next update of this record.`)
    }
    if (result.status === 'published') {
      lines.push(
        'The page is live. Search-engine indexing is a separate process with its own timing ' +
          'and is not implied by this status.'
      )
    }
  } else {
    lines.push(`FAILED${result.errorCode ? ` (${result.errorCode})` : ''}`)
    for (const error of result.errors ?? []) lines.push(`- ${error}`)
    if (result.updatedAt) {
      lines.push(
        `The record's current updatedAt is "${result.updatedAt}". Re-read it with get_content, ` +
          'merge your changes into the current version, and retry with that value.'
      )
    }
  }

  for (const warning of result.warnings ?? []) lines.push(`Note: ${warning}`)

  return lines.join('\n')
}

export function toolResult(result: McpToolResult): CallToolResult {
  const enriched: McpToolResult = {
    ...result,
    ...(result.publishAt && !result.publishAtLocal
      ? { publishAtLocal: utcToLocalWallClock(result.publishAt) }
      : {}),
  }

  return {
    content: [{ type: 'text', text: summarize(enriched) }],
    structuredContent: enriched as unknown as Record<string, unknown>,
    // The MCP spec's signal that the call failed for a tool-level reason rather
        // than a protocol one, which is what lets ChatGPT retry sensibly.
    isError: !enriched.ok,
  }
}

/**
 * Wrap a tool handler so every failure path produces the same envelope.
 *
 * An McpValidationError carries a code and messages meant for the caller and is
 * passed through. Anything else is a bug or an outage: it is logged and
 * reported as a generic INTERNAL_ERROR, because a stack trace, a Firestore
 * error string or a connection detail reaching an external client would be
 * exactly the leak the integration is supposed to prevent.
 */
export async function runTool(
  toolName: string,
  requestId: string,
  handler: () => Promise<McpToolResult>
): Promise<CallToolResult> {
  const startedAt = Date.now()
  try {
    const result = await handler()
    console.log(
      `[MCP_${toolName.toUpperCase()}]`,
      JSON.stringify({
        requestId,
        outcome: result.ok ? 'ok' : 'rejected',
        errorCode: result.errorCode,
        durationMs: Date.now() - startedAt,
      })
    )
    return toolResult(result)
  } catch (error) {
    if (error instanceof McpValidationError) {
      console.warn(
        `[MCP_${toolName.toUpperCase()}]`,
        JSON.stringify({ requestId, outcome: 'invalid', code: error.code })
      )
      return toolResult({ ok: false, errorCode: error.code, errors: error.errors })
    }

    // Reporting is best-effort and must not escalate a handled error into an
    // unhandled one. Sentry is imported dynamically so this module stays usable
    // outside the Next runtime (the test runner, a script), and the whole call
    // is guarded because in those contexts the import resolves to something
    // without captureException.
    try {
      const sentry = await import('@sentry/nextjs')
      sentry.captureException?.(error, {
        tags: { route: 'mcp', tool: toolName },
        extra: { requestId },
      })
    } catch (reportingError) {
      console.error(`[MCP_${toolName.toUpperCase()}] Could not report to Sentry:`, reportingError)
    }
    console.error(`[MCP_${toolName.toUpperCase()}] Unhandled error:`, error)

    return toolResult({
      ok: false,
      errorCode: 'INTERNAL_ERROR',
      errors: ['The request could not be completed. Try again; if it persists, contact the site team.'],
    })
  }
}
