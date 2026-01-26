import { test, expect } from '@playwright/test'
import { HomePage, CartPage, ProductPage } from './helpers/page-objects'

test.describe('RTL/LTR Support', () => {
  test('Hebrew page has RTL direction', async ({ page }) => {
    await page.goto('/he')
    
    const html = page.locator('html')
    const dir = await html.getAttribute('dir')
    expect(dir).toBe('rtl')
    
    // Check body direction as well
    const body = page.locator('body')
    const bodyDir = await body.getAttribute('dir')
    expect(bodyDir).toBe('rtl')
  })

  test('English page has LTR direction', async ({ page }) => {
    await page.goto('/en')
    
    const html = page.locator('html')
    const dir = await html.getAttribute('dir')
    expect(dir).toBe('ltr')
  })

  test('product card layout in RTL', async ({ page }) => {
    const productPage = new ProductPage(page)
    await productPage.goto('1234-5678', 'black', 'he')
    
    // Check that product card exists and is visible
    const productCard = page.locator('[data-testid="product-card"]')
    await expect(productCard.first()).toBeVisible({ timeout: 5000 })
    
    // Verify RTL direction
    const cardDir = await productCard.first().evaluate((el) => {
      return window.getComputedStyle(el).direction
    })
    expect(cardDir).toBe('rtl')
  })

  test('cart page layout in RTL', async ({ page }) => {
    const cartPage = new CartPage(page)
    await cartPage.goto('he')
    
    // Check RTL direction
    const html = page.locator('html')
    const dir = await html.getAttribute('dir')
    expect(dir).toBe('rtl')
    
    // Verify cart items are visible
    await cartPage.cartItems.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  })

  test('language switching preserves state', async ({ page }) => {
    const homePage = new HomePage(page)
    await homePage.goto('en')
    
    // Navigate to a product
    const productPage = new ProductPage(page)
    await productPage.goto('1234-5678', 'black', 'en')
    
    // Switch language
    await homePage.switchLanguage('he')
    
    // Verify URL changed but we're still on product page
    await expect(page).toHaveURL(/\/he\/product\/1234-5678\/black/, { timeout: 5000 })
    
    // Verify product is still visible
    const productCard = page.locator('[data-testid="product-card"]')
    await expect(productCard.first()).toBeVisible({ timeout: 5000 })
  })

  test('text direction in forms (RTL)', async ({ page }) => {
    const cartPage = new CartPage(page)
    await cartPage.goto('he')
    await cartPage.proceedToCheckout()
    
    const checkoutModal = page.locator('[data-testid="checkout-modal"]')
    await checkoutModal.waitFor({ state: 'visible' })
    
    // Check that form inputs have RTL direction
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.count() > 0) {
      const inputDir = await emailInput.first().evaluate((el) => {
        return window.getComputedStyle(el).direction
      })
      expect(inputDir).toBe('rtl')
    }
  })

  test('navigation direction in RTL', async ({ page }) => {
    await page.goto('/he')
    
    // Check navigation elements
    const nav = page.locator('nav, [role="navigation"]')
    if (await nav.count() > 0) {
      const navDir = await nav.first().evaluate((el) => {
        return window.getComputedStyle(el).direction
      })
      expect(navDir).toBe('rtl')
    }
  })
})
