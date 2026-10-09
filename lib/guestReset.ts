/**
 * Guest state reset utilities
 * 
 * Clears all localStorage keys that hold guest/user session data,
 * ensuring a clean "continue as guest" experience after logout.
 */
import { resetFacebookPixelAdvancedMatching } from '@/lib/facebookPixel';

/**
 * Promotions attached to the cart rather than to the items: applied coupon codes
 * and the loyalty-points redemption. Both outlive the page they were applied on
 * by design, so both have to be dropped wherever the cart they belong to is.
 * Leaving the points key behind would silently re-spend points on the next cart.
 */
export function clearCartPromotions(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem('cart_coupons')
    localStorage.removeItem('cart_points')
  } catch (error) {
    console.error('Error clearing cart promotions:', error)
  }
}

/**
 * Clears cart state from localStorage and dispatches a cartUpdated event
 * to notify all mounted useCart() instances.
 */
export function clearCartState(): void {
  if (typeof window === 'undefined') return

  try {
    // Remove cart from localStorage
    localStorage.removeItem('cart')
    clearCartPromotions()

    // Dispatch event to update all mounted useCart() hooks
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: [] }))
  } catch (error) {
    console.error('Error clearing cart state:', error)
  }
}

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
    // Cart page coupons and points (cart and favorites are handled by their contexts)
    clearCartPromotions()

    // Optional: Clear any other guest-specific keys here
    // localStorage.removeItem('bf_popup_seen') // Uncomment if you want to reset popup state
  } catch (error) {
    console.error('Error clearing guest state storage:', error)
  }
}

/**
 * Complete logout reset: clears cart, favorites, and all guest keys.
 * This is the main function to call on logout transitions.
 */
export function resetOnLogout(): void {
  if (typeof window === 'undefined') return

  try {
    resetFacebookPixelAdvancedMatching()

    // Clear cart (includes dispatching cartUpdated event)
    clearCartState()
    
    // Clear favorites (FavoritesContext handles this internally on user->null transition)
    localStorage.removeItem('favorites')
    
    // Clear other guest keys
    clearGuestStateStorage()
  } catch (error) {
    console.error('Error resetting on logout:', error)
  }
}

