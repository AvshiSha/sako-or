import 'server-only'
import { authConfigFromEnv, verifyWebhookAuth } from '../../webhooks/auth'
import type { ShipmentParseResult, ShippingProviderAdapter, WebhookAuthResult } from '../types'
import { normalizeHfdPayload } from './parse'

/**
 * HFD carrier adapter — the only HFD-aware object the ingestion pipeline touches.
 *
 * Auth is read from env on every request rather than captured at module load, so
 * flipping HFD_WEBHOOK_AUTH_MODE takes effect on redeploy without a code change and
 * without a stale cached value in a warm lambda.
 */
export const hfdAdapter: ShippingProviderAdapter = {
  name: 'hfd',

  verifyAuth(headers: Headers, rawBody: string): WebhookAuthResult {
    return verifyWebhookAuth(headers, rawBody, authConfigFromEnv('HFD'))
  },

  parse(json: unknown): ShipmentParseResult {
    return normalizeHfdPayload(json)
  },
}
