export type OtpTurnstileSessionResponse = {
  serverNow?: number
  turnstileVerifiedAt?: number
  turnstileExpiresAt?: number
  resendToken?: string
}

/** Offset (ms) to add to client Date.now() to estimate server time. */
export function computeServerClockOffsetMs(
  serverNow: number,
  clientNowMs: number = Date.now()
): number {
  return serverNow - clientNowMs
}

export function getEstimatedServerTimeMs(clockOffsetMs: number): number {
  return Date.now() + clockOffsetMs
}

/** True when the server-side Turnstile resend window has ended. */
export function isTurnstileSessionExpired(
  turnstileExpiresAt: number | null,
  clockOffsetMs: number
): boolean {
  // Missing expiry from the server — assume the window is still valid (do not force re-verification).
  if (turnstileExpiresAt == null) return false
  return getEstimatedServerTimeMs(clockOffsetMs) >= turnstileExpiresAt
}

export function parseTurnstileSessionResponse(
  data: OtpTurnstileSessionResponse | null | undefined,
  clientNowMs: number = Date.now()
): {
  clockOffsetMs: number
  turnstileExpiresAt: number | null
  resendToken: string | null
} | null {
  if (!data || typeof data.serverNow !== 'number') return null

  return {
    clockOffsetMs: computeServerClockOffsetMs(data.serverNow, clientNowMs),
    turnstileExpiresAt:
      typeof data.turnstileExpiresAt === 'number' ? data.turnstileExpiresAt : null,
    resendToken: typeof data.resendToken === 'string' ? data.resendToken : null,
  }
}
