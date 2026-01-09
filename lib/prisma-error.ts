export function isPrismaDbUnavailableError(error: unknown): boolean {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) return false

  const anyErr = error as any
  const name = typeof anyErr?.name === 'string' ? anyErr.name : ''
  const message = typeof anyErr?.message === 'string' ? anyErr.message : ''

  // Initialization errors frequently wrap connection failures (e.g. on Neon/PG).
  if (name === 'PrismaClientInitializationError') return true

  // Prisma sometimes uses known request errors with code P1001 for unreachable DB.
  if (name === 'PrismaClientKnownRequestError' && anyErr?.code === 'P1001') return true

  // Fallback for bundled / edge-shaped errors where only the message survives.
  return (
    message.includes("Can't reach database server") ||
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND') ||
    message.includes('ETIMEDOUT')
  )
}



