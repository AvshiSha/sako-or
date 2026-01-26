import { Page } from '@playwright/test'

// Mock authentication helpers for E2E tests
export async function mockAuthToken(page: Page, token: string = 'mock-auth-token') {
  await page.addInitScript((token) => {
    // Mock Firebase auth
    (window as any).mockFirebaseAuth = {
      currentUser: {
        getIdToken: async () => token,
        email: 'test@example.com',
        uid: 'test-uid',
      },
    }
  }, token)
}

export async function setAuthCookie(page: Page, token: string = 'mock-auth-token') {
  await page.context().addCookies([
    {
      name: 'auth-token',
      value: token,
      domain: 'localhost',
      path: '/',
    },
  ])
}

export async function clearAuth(page: Page) {
  await page.context().clearCookies()
}
