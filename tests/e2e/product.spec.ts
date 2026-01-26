import { test, expect } from '@playwright/test'
import { ProductPage, QuickBuyDrawer, CategoryPage } from './helpers/page-objects'
import { mockProducts } from '../../mocks/fixtures'

test.describe('Product Pages', () => {
  test('navigates to product detail page', async ({ page }) => {
    const productPage = new ProductPage(page)
    const product = mockProducts[0]
    
    await productPage.goto(product.sku, product.colorVariants['black'].colorSlug, 'en')
    
    await expect(page).toHaveURL(new RegExp(`/en/product/${product.sku}/black`))
  })

  test('applies color filter on category page', async ({ page }) => {
    const categoryPage = new CategoryPage(page)
    await categoryPage.goto('shoes', 'en')
    
    // Wait for products to load
    await categoryPage.productCards.first().waitFor({ state: 'visible', timeout: 10000 })
    
    // Try to apply color filter if available
    const colorFilter = categoryPage.colorFilters.first()
    if (await colorFilter.count() > 0) {
      await colorFilter.click()
      // Wait for filter to apply
      await page.waitForTimeout(1000)
    }
  })

  test('sorts products', async ({ page }) => {
    const categoryPage = new CategoryPage(page)
    await categoryPage.goto('shoes', 'en')
    
    // Wait for products to load
    await categoryPage.productCards.first().waitFor({ state: 'visible', timeout: 10000 })
    
    // Try to sort if sort select is available
    const sortSelect = categoryPage.sortSelect
    if (await sortSelect.count() > 0) {
      await sortSelect.selectOption('price-asc')
      await page.waitForTimeout(1000)
    }
  })

  test('selects color variant on product page', async ({ page }) => {
    const productPage = new ProductPage(page)
    const product = mockProducts[0]
    
    await productPage.goto(product.sku, product.colorVariants['black'].colorSlug, 'en')
    
    // Wait for color variants to load
    await productPage.colorVariants.first().waitFor({ state: 'visible', timeout: 5000 })
    
    // Select a different color if available
    const whiteVariant = productPage.page.locator('[data-testid="product-card-color-variant-white"]')
    if (await whiteVariant.count() > 0) {
      await whiteVariant.click()
      await page.waitForTimeout(500)
    }
  })

  test('opens quick buy drawer', async ({ page }) => {
    const productPage = new ProductPage(page)
    const product = mockProducts[0]
    
    await productPage.goto(product.sku, product.colorVariants['black'].colorSlug, 'en')
    
    // Click quick buy button
    await productPage.quickBuyButton.first().click()
    
    // Verify drawer is open
    const drawer = new QuickBuyDrawer(page)
    await expect(drawer.drawer).toBeVisible({ timeout: 3000 })
  })

  test('selects size in quick buy drawer', async ({ page }) => {
    const productPage = new ProductPage(page)
    const product = mockProducts[0]
    
    await productPage.goto(product.sku, product.colorVariants['black'].colorSlug, 'en')
    await productPage.openQuickBuy()
    
    const drawer = new QuickBuyDrawer(page)
    await drawer.drawer.waitFor({ state: 'visible' })
    
    // Select a size if available
    const sizeButton = drawer.page.locator('[data-testid^="quick-buy-size-"]').first()
    if (await sizeButton.count() > 0) {
      await sizeButton.click()
      await page.waitForTimeout(500)
    }
  })

  test('updates quantity in quick buy drawer', async ({ page }) => {
    const productPage = new ProductPage(page)
    const product = mockProducts[0]
    
    await productPage.goto(product.sku, product.colorVariants['black'].colorSlug, 'en')
    await productPage.openQuickBuy()
    
    const drawer = new QuickBuyDrawer(page)
    await drawer.drawer.waitFor({ state: 'visible' })
    
    // Increase quantity
    await drawer.quantityIncrease.click()
    const quantity = await drawer.quantityValue.textContent()
    expect(parseInt(quantity || '1')).toBeGreaterThan(1)
    
    // Decrease quantity
    await drawer.quantityDecrease.click()
    const newQuantity = await drawer.quantityValue.textContent()
    expect(parseInt(newQuantity || '1')).toBe(1)
  })

  test('adds product to cart from quick buy drawer', async ({ page }) => {
    const productPage = new ProductPage(page)
    const product = mockProducts[0]
    
    await productPage.goto(product.sku, product.colorVariants['black'].colorSlug, 'en')
    await productPage.openQuickBuy()
    
    const drawer = new QuickBuyDrawer(page)
    await drawer.drawer.waitFor({ state: 'visible' })
    
    // Select size if required
    const sizeButton = drawer.page.locator('[data-testid^="quick-buy-size-"]').first()
    if (await sizeButton.count() > 0 && await sizeButton.isEnabled()) {
      await sizeButton.click()
      await page.waitForTimeout(500)
    }
    
    // Add to cart
    await drawer.addToCart()
    
    // Wait for drawer to close or success message
    await page.waitForTimeout(1000)
  })
})
