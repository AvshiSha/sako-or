import { Page } from '@playwright/test'
import { CartPage } from './page-objects'

export async function addItemToCart(
  page: Page,
  sku: string,
  options: { color?: string; size?: string; quantity?: number } = {}
) {
  const cartPage = new CartPage(page)
  // This would typically go through product page or quick buy
  // For now, this is a placeholder - actual implementation depends on app flow
}

export async function clearCart(page: Page) {
  const cartPage = new CartPage(page)
  await cartPage.goto()
  
  // Remove all items
  const items = cartPage.cartItems
  const count = await items.count()
  
  for (let i = count - 1; i >= 0; i--) {
    const item = items.nth(i)
    const removeButton = item.locator('[data-testid="cart-item-remove"]')
    if (await removeButton.isVisible()) {
      await removeButton.click()
      // Wait for item to be removed
      await page.waitForTimeout(500)
    }
  }
}

export async function verifyCartState(
  page: Page,
  expectedItems: Array<{ sku: string; quantity: number; size?: string; color?: string }>
) {
  const cartPage = new CartPage(page)
  await cartPage.goto()
  
  for (const expectedItem of expectedItems) {
    const item = cartPage.getCartItem(expectedItem.sku, expectedItem.size, expectedItem.color)
    await item.waitFor({ state: 'visible' })
    
    const controls = cartPage.getQuantityControls(item)
    const quantity = await controls.value.textContent()
    expect(parseInt(quantity || '0')).toBe(expectedItem.quantity)
  }
}
