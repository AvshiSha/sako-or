import { handlers } from './handlers'

// Lazily require msw/node so tests don't crash if msw isn't installed
// or not available in the current environment. The test helper checks
// for server being defined before using it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let server: any

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { setupServer } = require('msw/node')
  server = setupServer(...handlers)
} catch {
  server = undefined
}

export { server }
