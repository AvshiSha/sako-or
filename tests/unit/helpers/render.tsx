import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { server } from '@/mocks/server'

// Setup MSW for tests (only if server is available)
if (typeof server !== 'undefined') {
  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
}

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }
