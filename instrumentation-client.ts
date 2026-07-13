// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  integrations: [Sentry.replayIntegration()],

  // 100% in dev, 10% in production (sampling 100% in prod is expensive)
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  enableLogs: true,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  sendDefaultPii: true,

  beforeSend(event, hint) {
    const error = hint.originalException
    if (error instanceof Error) {
      if (error.name === 'AbortError') return null
      if ((error as any)?.code === 'auth/popup-closed-by-user') return null
      if (error.message?.includes('ResizeObserver loop')) return null
      // Instagram in-app browser injects its own native-bridge script; on some
      // iOS/IAB versions `window.webkit` isn't set up, and that script throws.
      // Not our code, nothing we can fix — see SAKO-OR-PROJ-5.
      if (error.message?.includes('webkit.messageHandlers')) return null
    }
    // Drop errors injected by browser extensions
    const frames = event.exception?.values?.[0]?.stacktrace?.frames
    if (frames?.some(f =>
      f.filename?.startsWith('chrome-extension://') ||
      f.filename?.startsWith('moz-extension://')
    )) return null
    return event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
