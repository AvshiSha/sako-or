import { Page, Locator } from '@playwright/test'

export class HomePage {
  constructor(private page: Page) {}

  async goto(language: 'en' | 'he' = 'en') {
    await this.page.goto(`/${language}`)
  }

  get languageSwitcher(): Locator {
    return this.page.locator('[data-testid="language-switcher"]').or(this.page.locator('select').filter({ hasText: /Language|שפה/ }))
  }

  async switchLanguage(language: 'en' | 'he') {
    const switcher = this.languageSwitcher
    if (await switcher.count() > 0) {
      await switcher.selectOption(language)
    }
  }

  get productCards(): Locator {
    return this.page.locator('[data-testid="product-card"]')
  }

  async clickProduct(index: number = 0) {
    await this.productCards.nth(index).click()
  }
}

export class ProductPage {
  constructor(private page: Page) {}

  async goto(sku: string, colorSlug: string, language: 'en' | 'he' = 'en') {
    await this.page.goto(`/${language}/product/${sku}/${colorSlug}`)
  }

  get colorVariants(): Locator {
    return this.page.locator('[data-testid^="product-card-color-variant-"]')
  }

  async selectColor(colorSlug: string) {
    await this.page.locator(`[data-testid="product-card-color-variant-${colorSlug}"]`).click()
  }

  get quickBuyButton(): Locator {
    return this.page.locator('[data-testid="product-card-quick-buy-button"]')
  }

  async openQuickBuy() {
    await this.quickBuyButton.first().click()
  }

  get addToCartButton(): Locator {
    return this.page.locator('[data-testid="quick-buy-add-to-cart"]')
  }
}

export class QuickBuyDrawer {
  constructor(private page: Page) {}

  get drawer(): Locator {
    return this.page.locator('[data-testid="quick-buy-drawer"]')
  }

  async selectSize(size: string) {
    await this.page.locator(`[data-testid="quick-buy-size-${size}"]`).click()
  }

  async selectColor(colorSlug: string) {
    await this.page.locator(`[data-testid="quick-buy-color-${colorSlug}"]`).click()
  }

  get quantityDecrease(): Locator {
    return this.page.locator('[data-testid="quick-buy-quantity-decrease"]')
  }

  get quantityIncrease(): Locator {
    return this.page.locator('[data-testid="quick-buy-quantity-increase"]')
  }

  get quantityValue(): Locator {
    return this.page.locator('[data-testid="quick-buy-quantity-value"]')
  }

  async setQuantity(quantity: number) {
    const current = parseInt(await this.quantityValue.textContent() || '1')
    const diff = quantity - current
    
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        await this.quantityIncrease.click()
      }
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) {
        await this.quantityDecrease.click()
      }
    }
  }

  get addToCartButton(): Locator {
    return this.page.locator('[data-testid="quick-buy-add-to-cart"]')
  }

  async addToCart() {
    await this.addToCartButton.click()
  }
}

export class CartPage {
  constructor(private page: Page) {}

  async goto(language: 'en' | 'he' = 'en') {
    await this.page.goto(`/${language}/cart`)
  }

  get cartItems(): Locator {
    return this.page.locator('[data-testid^="cart-item-"]')
  }

  getCartItem(sku: string, size?: string, color?: string): Locator {
    const testId = `cart-item-${sku}-${size || ''}-${color || ''}`
    return this.page.locator(`[data-testid="${testId}"]`)
  }

  getQuantityControls(item: Locator): { decrease: Locator; increase: Locator; value: Locator } {
    return {
      decrease: item.locator('[data-testid="cart-item-quantity-decrease"]'),
      increase: item.locator('[data-testid="cart-item-quantity-increase"]'),
      value: item.locator('[data-testid="cart-item-quantity-value"]'),
    }
  }

  async updateQuantity(sku: string, quantity: number, size?: string, color?: string) {
    const item = this.getCartItem(sku, size, color)
    const controls = this.getQuantityControls(item)
    const current = parseInt(await controls.value.textContent() || '1')
    const diff = quantity - current

    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        await controls.increase.click()
      }
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) {
        await controls.decrease.click()
      }
    }
  }

  async removeItem(sku: string, size?: string, color?: string) {
    const item = this.getCartItem(sku, size, color)
    await item.locator('[data-testid="cart-item-remove"]').click()
  }

  get couponInput(): Locator {
    return this.page.locator('[data-testid="cart-coupon-input"]')
  }

  get couponApplyButton(): Locator {
    return this.page.locator('[data-testid="cart-coupon-apply-button"]')
  }

  async applyCoupon(code: string) {
    await this.couponInput.fill(code)
    await this.couponApplyButton.click()
  }

  async removeCoupon(code: string) {
    await this.page.locator(`[data-testid="cart-coupon-remove-${code}"]`).click()
  }

  get checkoutButton(): Locator {
    return this.page.locator('[data-testid="cart-checkout-button"]')
  }

  async proceedToCheckout() {
    await this.checkoutButton.click()
  }

  get totalAmount(): Locator {
    return this.page.locator('[data-testid="cart-total-amount"]')
  }

  async getTotal(): Promise<number> {
    const text = await this.totalAmount.textContent()
    return parseFloat(text?.replace('₪', '').trim() || '0')
  }
}

export class CheckoutPage {
  constructor(private page: Page) {}

  get modal(): Locator {
    return this.page.locator('[data-testid="checkout-modal"]')
  }

  get continueButton(): Locator {
    return this.page.locator('[data-testid="checkout-continue-button"]')
  }

  async continueToPayment() {
    await this.continueButton.click()
  }

  async fillForm(data: {
    firstName?: string
    lastName?: string
    email?: string
    mobile?: string
    city?: string
    streetName?: string
    streetNumber?: string
  }) {
    // Form fields would be filled here
    // Note: Actual field selectors depend on PayerDetailsForm implementation
    if (data.firstName) {
      await this.page.locator('input[name="firstName"], input[placeholder*="First"], input[placeholder*="שם פרטי"]').fill(data.firstName)
    }
    if (data.lastName) {
      await this.page.locator('input[name="lastName"], input[placeholder*="Last"], input[placeholder*="שם משפחה"]').fill(data.lastName)
    }
    if (data.email) {
      await this.page.locator('input[type="email"]').fill(data.email)
    }
    if (data.mobile) {
      await this.page.locator('input[type="tel"], input[name="mobile"]').fill(data.mobile)
    }
    if (data.city) {
      await this.page.locator('input[name="city"], input[placeholder*="City"], input[placeholder*="עיר"]').fill(data.city)
    }
    if (data.streetName) {
      await this.page.locator('input[name="streetName"], input[placeholder*="Street"]').fill(data.streetName)
    }
    if (data.streetNumber) {
      await this.page.locator('input[name="streetNumber"]').fill(data.streetNumber)
    }
  }
}

export class CategoryPage {
  constructor(private page: Page) {}

  async goto(categoryPath: string, language: 'en' | 'he' = 'en') {
    await this.page.goto(`/${language}/collection/${categoryPath}`)
  }

  get productCards(): Locator {
    return this.page.locator('[data-testid="product-card"]')
  }

  get colorFilters(): Locator {
    return this.page.locator('[data-testid^="color-filter-"]')
  }

  async selectColorFilter(color: string) {
    await this.page.locator(`[data-testid="color-filter-${color}"]`).click()
  }

  get sortSelect(): Locator {
    return this.page.locator('select[name="sort"], [data-testid="sort-select"]')
  }

  async sortBy(option: string) {
    await this.sortSelect.selectOption(option)
  }
}
