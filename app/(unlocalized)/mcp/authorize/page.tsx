import { Suspense } from 'react'
import type { Metadata } from 'next'

import ConsentForm from './ConsentForm'

/**
 * The OAuth consent screen for the MCP SEO content integration.
 *
 * Reached by a redirect from /api/mcp/oauth/authorize, which has already
 * validated the client and parked the request. The only thing this page
 * carries is the opaque request id -- client_id, redirect_uri and scope stay
 * server-side so nothing the browser sends back can change what is being
 * approved.
 *
 * Lives in the (unlocalized) group, which is noindex by default and renders
 * left-to-right. The page is English because it is an operator surface, not
 * storefront content.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Authorize ChatGPT · SAKO-OR',
  robots: { index: false, follow: false },
}

export default function McpAuthorizePage() {
  return (
    <main className="flex min-h-screen flex-col justify-center bg-[#E1DBD7] py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-widest text-black">SAKO OR</h1>
          <h2 className="mt-6 text-2xl font-bold text-black">Authorize ChatGPT</h2>
          <p className="mt-2 text-sm text-[#856D55]">
            Connect ChatGPT to the SEO content tools
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-lg bg-white px-4 py-8 shadow-sm ring-1 ring-[#B2A28E]/30 sm:px-10">
          <Suspense
            fallback={
              <p className="text-center text-sm text-[#856D55]">Loading the request…</p>
            }
          >
            <ConsentForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
