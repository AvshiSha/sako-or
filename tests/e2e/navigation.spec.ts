import { test, expect } from '@playwright/test'
import { HomePage } from './helpers/page-objects'

test.describe('Navigation and Homepage', () => {
  test('homepage loads correctly', async ({ page }) => {
    const homePage = new HomePage(page)
    await homePage.goto('en')

    await expect(page).toHaveURL(/\/en$/)
    await expect(homePage.productCards.first()).toBeVisible({ timeout: 10000 })
  })

  test('language switcher changes language', async ({ page }) => {
    const homePage = new HomePage(page)
    await homePage.goto('en')

    // Check initial language
    await expect(page).toHaveURL(/\/en$/)

    // Switch to Hebrew
    await homePage.switchLanguage('he')
    await expect(page).toHaveURL(/\/he$/, { timeout: 5000 })

    // Switch back to English
    await homePage.switchLanguage('en')
    await expect(page).toHaveURL(/\/en$/, { timeout: 5000 })
  })

  test('navigates to category page', async ({ page }) => {
    await page.goto('/en')
    
    // Find and click a category link (adjust selector based on actual implementation)
    const categoryLink = page.locator('a[href*="/collection/"]').first()
    if (await categoryLink.count() > 0) {
      await categoryLink.click()
      await expect(page).toHaveURL(/\/en\/collection\//, { timeout: 5000 })
    }
  })

  test('RTL layout for Hebrew', async ({ page }) => {
    await page.goto('/he')
    
    // Check that page has RTL direction
    const html = page.locator('html')
    const dir = await html.getAttribute('dir')
    expect(dir).toBe('rtl')
  })

  test('LTR layout for English', async ({ page }) => {
    await page.goto('/en')
    
    // Check that page has LTR direction
    const html = page.locator('html')
    const dir = await html.getAttribute('dir')
    expect(dir).toBe('ltr')
  })
})
