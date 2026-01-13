/**
 * Cart clearing utilities for post-purchase cleanup
 * 
 * Handles clearing purchased items from the cart for both:
 * - Guests: Clears localStorage cart
 * - Signed-in users: Forces cart reload from Neon (which excludes PURCHASED items)
 */

import { clearCartState } from './guestReset'

/**
 * Session storage key pattern for tracking cart loads
 */
const SESSION_LOADED_KEY = 'cart_loaded_from_neon'

/**
 * Clears the cart after a successful purchase.
 * 
 * For guests: Clears localStorage cart and dispatches cartUpdated event
 * For signed-in users: Clears sessionStorage flag to force cart reload from Neon
 * 
 * @param userId - Firebase user ID if user is signed in, undefined for guests
 */
export function clearCartAfterPurchase(userId?: string): void {
  if (typeof window === 'undefined') return

  try {
    if (!userId) {
      // Guest checkout: clear localStorage cart
      clearCartState()
      console.log('[clearCartAfterPurchase] Cleared guest cart from localStorage')
    } else {
      // Signed-in user: clear sessionStorage flag to force reload from Neon
      // This will cause useCart to reload, which will exclude PURCHASED items
      const sessionKey = `${SESSION_LOADED_KEY}_${userId}`
      sessionStorage.removeItem(sessionKey)
      
      // Dispatch cartReload event to trigger immediate reload in useCart
      window.dispatchEvent(new CustomEvent('cartReload'))
      console.log('[clearCartAfterPurchase] Cleared sessionStorage flag for signed-in user, dispatched cartReload event')
    }
  } catch (error) {
    console.error('[clearCartAfterPurchase] Error clearing cart:', error)
  }
}
