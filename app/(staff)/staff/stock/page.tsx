import StockLookupClient from './_components/StockLookupClient'

/**
 * The warehouse stock and location screen.
 *
 * A thin server page over one client island. The lookup is interactive by
 * nature -- debounced input, cancellable requests, a PIN dialog -- so there is
 * nothing for the server to render here beyond the shell the layout already
 * provides. Freshness comes from the API call, never from a prerender.
 */
export const dynamic = 'force-dynamic'

export default function StaffStockPage() {
  return <StockLookupClient />
}
