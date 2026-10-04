'use client'

import { SWRConfig } from 'swr'

/**
 * Global SWR defaults.
 *
 * The one that matters is `errorRetryCount`. SWR ships with it *undefined*,
 * which its retry handler reads as "no limit":
 *
 *   if (!isUndefined(maxRetryCount) && currentRetryCount > maxRetryCount) return
 *   setTimeout(revalidate, timeout, opts)
 *
 * So any hook whose fetcher throws re-requests forever on an exponential
 * backoff (~2.5-7.5s, 5-15s, 10-30s, ... capped around 10-30min). That is how a
 * single 404 from GET /api/me/profile turned into a permanent request loop in
 * Navigation, which lives in the layout and never unmounts. Capping it here
 * means no future hook can inherit an unbounded loop by omitting the option.
 *
 * Nothing else is overridden, so every other SWR default (and every per-hook
 * option already in the codebase) behaves exactly as before.
 *
 * No `provider` is passed on purpose: SWR's default module-level cache stays in
 * place, so the global `mutate` used by lib/user-profile-cache.ts writes to the
 * same cache these hooks read, and seeded data survives the guest -> auth tree
 * swap in ClientAuthProvider.
 */
export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ errorRetryCount: 2 }}>{children}</SWRConfig>
}
