/**
 * Guest state reset utilities
 * 
 * Clears all localStorage keys that hold guest/user session data,
 * ensuring a clean "continue as guest" experience after logout.
 */

/**
 * Removes remaining guest/user state from localStorage.
 * Call this after clearing cart and favorites via their respective contexts.
 * 
 * Note: Cart and favorites should be cleared using their context methods
 * (clearCart and clearAllLocal) which handle both React state and localStorage.
 */
export function clearGuestStateStorage(): void {
  if (typeof window === 'undefined') return

  try {
    // Cart page coupons (cart and favorites are handled by their contexts)
    localStorage.removeItem('cart_coupons')
    
    // Optional: Clear any other guest-specific keys here
    // localStorage.removeItem('bf_popup_seen') // Uncomment if you want to reset popup state
  } catch (error) {
    console.error('Error clearing guest state storage:', error)
  }
}

