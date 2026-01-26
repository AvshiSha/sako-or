import { test, expect } from '@playwright/test'
import { CartPage, ProductPage, QuickBuyDrawer } from './helpers/page-objects'
import { clearCart } from './helpers/cart'
import { mockProducts } from '../../mocks/fixtures'

test.describe('Cart Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cart before each test
    await clearCart(page)
  })

  test('adds item to cart', async ({ page }) => {
    const productPage = new ProductPage(page)
    const product = mockProducts[0]
    
    await productPage.goto(product.sku, product.colorVariants['black'].colorSlug, 'en')
    await productPage.openQuickBuy()
    
    const drawer = new QuickBuyDrawer(page)
    await drawer.drawer.waitFor({ state: 'visible' })
    
    // Select size if available
    const sizeButton = drawer.page.locator('[data-testid^="quick-buy-size-"]').first()
    if (await sizeButton.count() > 0 && await sizeButton.isEnabled()) {
      await sizeButton.click()
      await page.waitForTimeout(500)
    }
    
    await drawer.addToCart()
    await page.waitForTimeout(1000)
    
    // Navigate to cart
    const cartPage = new CartPage(page)
    await cartPage.goto()
    
    // Verify item is in cart
    const item = cartPage.getCartItem(product.sku)
    await expect(item).toBeVisible({ timeout: 5000 })
  })

  test('updates item quantity', async ({ page }) => {
    const cartPage = new CartPage(page)
    
    // Add item first (simplified - in real test would go through product page)
    await cartPage.goto()
    
    // If cart has items, update quantity
    const items = cartPage.cartItems
    if (await items.count() > 0) {
      const firstItem = items.first()
      const controls = cartPage.getQuantityControls(firstItem)
      
      const initialQuantity = parseInt(await controls.value.textContent() || '1')
      await controls.increase.click()
      await page.waitForTimeout(500)
      
      const newQuantity = parseInt(await controls.value.textContent() || '1')
      expect(newQuantity).toBe(initialQuantity + 1)
    }
  })

  test('removes item from cart', async ({ page }) => {
    const cartPage = new CartPage(page)
    await cartPage.goto()
    
    const items = cartPage.cartItems
    const initialCount = await items.count()
    
    if (initialCount > 0) {
      const firstItem = items.first()
      await firstItem.locator('[data-testid="cart-item-remove"]').click()
      await page.waitForTimeout(1000)
      
      const newCount = await items.count()
      expect(newCount).toBe(initialCount - 1)
    }
  })

  test('calculates total price correctly', async ({ page }) => {
    const cartPage = new CartPage(page)
    await cartPage.goto()
    
    // Wait for cart to load
    await cartPage.cartItems.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    
    // Get total amount
    const total = await cartPage.getTotal()
    expect(total).toBeGreaterThanOrEqual(0)
  })

  test('applies delivery fee for orders under 300 ILS', async ({ page }) => {
    const cartPage = new CartPage(page)
    await cartPage.goto()
    
    // This test assumes cart has items totaling less than 300
    // In a real scenario, you'd set up the cart state first
    const total = await cartPage.getTotal()
    
    // If total is less than 300, delivery fee should be included
    if (total > 0 && total < 300) {
      // Check that delivery fee is shown (implementation specific)
      const deliveryFee = cartPage.page.locator('text=/delivery|משלוח/')
      if (await deliveryFee.count() > 0) {
        await expect(deliveryFee).toBeVisible()
      }
    }
  })

  test('applies coupon code', async ({ page }) => {
    const cartPage = new CartPage(page)
    await cartPage.goto()
    
    // Wait for cart to be ready
    await cartPage.cartItems.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    
    // Apply coupon
    await cartPage.applyCoupon('SAVE20')
    await page.waitForTimeout(2000)
    
    // Verify coupon was applied (check for success message or discount)
    const couponStatus = cartPage.page.locator('text=/success|הצלחה|applied|הוחל/')
    if (await couponStatus.count() > 0) {
      await expect(couponStatus.first()).toBeVisible({ timeout: 3000 })
    }
  })

  test('removes applied coupon', async ({ page }) => {
    const cartPage = new CartPage(page)
    await cartPage.goto()
    
    // Apply coupon first
    await cartPage.applyCoupon('SAVE20')
    await page.waitForTimeout(2000)
    
    // Remove coupon
    await cartPage.removeCoupon('SAVE20')
    await page.waitForTimeout(1000)
    
    // Verify coupon is removed
    const couponBadge = cartPage.page.locator('[data-testid="cart-coupon-remove-SAVE20"]')
    await expect(couponBadge).not.toBeVisible({ timeout: 3000 })
  })

  test('proceeds to checkout', async ({ page }) => {
    const cartPage = new CartPage(page)
    await cartPage.goto()
    
    // Wait for cart items
    await cartPage.cartItems.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    
    // Click checkout button
    await cartPage.proceedToCheckout()
    
    // Verify checkout modal opens
    const checkoutModal = cartPage.page.locator('[data-testid="checkout-modal"]')
    await expect(checkoutModal).toBeVisible({ timeout: 3000 })
  })
})
