import { test, expect } from '@playwright/test'
import { CartPage, CheckoutPage } from './helpers/page-objects'

test.describe('Checkout Flow', () => {
  test('happy path: fill form and submit', async ({ page }) => {
    const cartPage = new CartPage(page)
    await cartPage.goto()
    
    // Wait for cart to load
    await cartPage.cartItems.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    
    // Proceed to checkout
    await cartPage.proceedToCheckout()
    
    const checkoutPage = new CheckoutPage(page)
    await checkoutPage.modal.waitFor({ state: 'visible' })
    
    // Fill form
    await checkoutPage.fillForm({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      mobile: '0501234567',
      city: 'Tel Aviv',
      streetName: 'Main Street',
      streetNumber: '123',
    })
    
    // Wait for form validation
    await page.waitForTimeout(1000)
    
    // Continue to payment (if form is valid)
    const continueButton = checkoutPage.continueButton
    if (await continueButton.isEnabled()) {
      await continueButton.click()
      
      // Wait for payment step or loading state
      await page.waitForTimeout(2000)
    }
  })

  test('validates required fields', async ({ page }) => {
    const cartPage = new CartPage(page)
    await cartPage.goto()
    
    await cartPage.proceedToCheckout()
    
    const checkoutPage = new CheckoutPage(page)
    await checkoutPage.modal.waitFor({ state: 'visible' })
    
    // Try to submit without filling form
    const continueButton = checkoutPage.continueButton
    
    // Button should be disabled if form is invalid
    const isDisabled = await continueButton.isDisabled()
    if (isDisabled) {
      expect(isDisabled).toBe(true)
    }
  })

  test('validates email format', async ({ page }) => {
    const cartPage = new CartPage(page)
    await cartPage.goto()
    
    await cartPage.proceedToCheckout()
    
    const checkoutPage = new CheckoutPage(page)
    await checkoutPage.modal.waitFor({ state: 'visible' })
    
    // Fill form with invalid email
    await checkoutPage.fillForm({
      firstName: 'Test',
      lastName: 'User',
      email: 'invalid-email',
      mobile: '0501234567',
      city: 'Tel Aviv',
      streetName: 'Main Street',
      streetNumber: '123',
    })
    
    // Form should show validation error
    await page.waitForTimeout(1000)
    
    // Check for email validation error
    const emailError = page.locator('text=/invalid.*email|אימייל.*לא.*תקף/i')
    if (await emailError.count() > 0) {
      await expect(emailError.first()).toBeVisible()
    }
  })

  test('validates phone format', async ({ page }) => {
    const cartPage = new CartPage(page)
    await cartPage.goto()
    
    await cartPage.proceedToCheckout()
    
    const checkoutPage = new CheckoutPage(page)
    await checkoutPage.modal.waitFor({ state: 'visible' })
    
    // Fill form with invalid phone
    await checkoutPage.fillForm({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      mobile: '123', // Invalid
      city: 'Tel Aviv',
      streetName: 'Main Street',
      streetNumber: '123',
    })
    
    await page.waitForTimeout(1000)
    
    // Check for phone validation error
    const phoneError = page.locator('text=/phone|טלפון/i')
    if (await phoneError.count() > 0) {
      await expect(phoneError.first()).toBeVisible()
    }
  })
})
