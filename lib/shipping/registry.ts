import 'server-only'
import { hfdAdapter } from './hfd/adapter'
import type { ShippingProviderAdapter } from './types'

/**
 * Carrier registry — the extension point for future shipping providers.
 *
 * Adding a courier is: one folder under `lib/shipping/<carrier>/` implementing
 * `ShippingProviderAdapter`, one line here, and a thin route that calls the shared
 * `ingestShipmentWebhook`. No change to the pipeline, the services or the schema.
 *
 * Kept as explicit routes rather than a dynamic `[provider]` segment so each
 * carrier keeps its own `vercel.json` function config and CORS headers, and so an
 * unknown provider is a 404 at the routing layer rather than a runtime lookup miss.
 */
const adapters: Record<string, ShippingProviderAdapter> = {
  [hfdAdapter.name]: hfdAdapter,
}

export function getShippingAdapter(provider: string): ShippingProviderAdapter | null {
  return adapters[provider] ?? null
}
