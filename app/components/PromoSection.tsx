'use client'

import Link from 'next/link'
import { track } from '@vercel/analytics'
import React, { useEffect, useMemo, useRef, useState } from 'react'

export type PromoItem = {
  text: { he: string; en: string }
  href: string
  icon?: React.ReactNode
  countdownEnd?: Date | string | number
}

const DEFAULT_PROMOS: PromoItem[] = [
  {
    text: {
      he: '10% הנחה על כל הסניקרס | קוד: SNEAK10',
      en: '10% discount on all sneakers | code: SNEAK10',
    },
    href: '/collection/women/shoes/sneakers',
    icon: '👟',
  },
  {
    text: {
      he: 'מחלקת האאוטלט – עד 70% הנחה על פריטים נבחרים',
      en: 'Outlet category – up to 70% discount on selected items',
    },
    href: '/collection/women/outlet',
    icon: '🔥',
  },
]

interface PromoSectionProps {
  lng: 'en' | 'he'
  promos?: PromoItem[]
  rotationMs?: number
  pauseOnHover?: boolean
  expireMode?: 'remove' | 'hideCountdown'
}

const ROTATION_MS_DEFAULT = 4000
const TRANSITION_MS = 400
const RESERVED_COUNTDOWN_HEIGHT_PX = 18

function isInternalPath(href: string): boolean {
  return href.startsWith('/')
}

function buildLocalizedHref(lng: 'en' | 'he', href: string): string {
  if (!isInternalPath(href)) return href
  return `/${lng}${href === '/' ? '' : href}`
}

function parseCountdownEnd(value: PromoItem['countdownEnd']): number | null {
  if (value === undefined) return null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : null
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatRemaining(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(clamped / 86400)
  const hours = Math.floor((clamped % 86400) / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const seconds = clamped % 60
  if (days > 0) return `${days}:${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

export default function PromoSection({
  lng,
  promos = DEFAULT_PROMOS,
  rotationMs = ROTATION_MS_DEFAULT,
  pauseOnHover = true,
  expireMode = 'remove',
}: PromoSectionProps) {
  const [items, setItems] = useState<PromoItem[]>(() => promos.filter(Boolean))
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  // Animation state: keep a short-lived outgoing item for crossfade.
  const [outgoing, setOutgoing] = useState<{ item: PromoItem; key: string } | null>(null)
  const [incomingKey, setIncomingKey] = useState(() => `promo_${Date.now()}_${Math.random().toString(16).slice(2)}`)
  const [transitionOn, setTransitionOn] = useState(false)
  const prevActiveRef = useRef<PromoItem | null>(null)
  const outgoingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animCycleRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const rafRef2 = useRef<number | null>(null)
  const transitionKickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Countdown state (only for the active promo when it has countdownEnd).
  const [countdownText, setCountdownText] = useState<string>('')
  const [countdownVisible, setCountdownVisible] = useState(false)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep internal list in sync if parent passes a new array.
  useEffect(() => {
    setItems(promos.filter(Boolean))
    setActiveIndex(0)
  }, [promos])

  const activeItem = items.length > 0 ? items[Math.min(activeIndex, items.length - 1)] : null

  // Rotation interval (paused on hover/focus when enabled).
  useEffect(() => {
    if (items.length <= 1) return
    if (pauseOnHover && paused) return
    const id = setInterval(() => {
      setActiveIndex((i) => (items.length === 0 ? 0 : (i + 1) % items.length))
    }, rotationMs)
    return () => clearInterval(id)
  }, [items.length, paused, pauseOnHover, rotationMs])

  // Crossfade on promo change.
  useEffect(() => {
    animCycleRef.current += 1
    const cycle = animCycleRef.current

    if (outgoingTimeoutRef.current) {
      clearTimeout(outgoingTimeoutRef.current)
      outgoingTimeoutRef.current = null
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (rafRef2.current !== null) {
      cancelAnimationFrame(rafRef2.current)
      rafRef2.current = null
    }
    if (transitionKickTimeoutRef.current) {
      clearTimeout(transitionKickTimeoutRef.current)
      transitionKickTimeoutRef.current = null
    }

    const prev = prevActiveRef.current
    if (prev && activeItem && prev !== activeItem) {
      setOutgoing({ item: prev, key: incomingKey })
    } else {
      setOutgoing(null)
    }

    prevActiveRef.current = activeItem
    setIncomingKey(`promo_${Date.now()}_${Math.random().toString(16).slice(2)}`)
    setTransitionOn(false)
    // Double-rAF ensures the initial styles paint before we flip to "transitionOn".
    // This is more reliable than setTimeout under load, especially on mobile.
    rafRef.current = requestAnimationFrame(() => {
      if (animCycleRef.current !== cycle) return
      rafRef2.current = requestAnimationFrame(() => {
        if (animCycleRef.current !== cycle) return
        if (transitionKickTimeoutRef.current) {
          clearTimeout(transitionKickTimeoutRef.current)
          transitionKickTimeoutRef.current = null
        }
        setTransitionOn(true)
      })
    })
    // Guarded fallback in case rAF is delayed unusually (background tabs, heavy load).
    transitionKickTimeoutRef.current = setTimeout(() => {
      if (animCycleRef.current !== cycle) return
      setTransitionOn(true)
      transitionKickTimeoutRef.current = null
    }, TRANSITION_MS)

    outgoingTimeoutRef.current = setTimeout(() => {
      if (animCycleRef.current !== cycle) return
      setOutgoing(null)
      outgoingTimeoutRef.current = null
    }, TRANSITION_MS)

    return () => {
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current)
        outgoingTimeoutRef.current = null
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (rafRef2.current !== null) {
        cancelAnimationFrame(rafRef2.current)
        rafRef2.current = null
      }
      if (transitionKickTimeoutRef.current) {
        clearTimeout(transitionKickTimeoutRef.current)
        transitionKickTimeoutRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem])

  // Countdown ticking for active promo only.
  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    if (!activeItem) {
      setCountdownText('')
      setCountdownVisible(false)
      return
    }
    const endTs = parseCountdownEnd(activeItem.countdownEnd)
    if (!endTs) {
      setCountdownText('')
      setCountdownVisible(false)
      return
    }

    const tick = () => {
      const totalSeconds = Math.floor(Math.max(0, (endTs - Date.now()) / 1000))
      if (totalSeconds <= 0) {
        setCountdownText('')
        setCountdownVisible(false)

        if (expireMode === 'remove') {
          setItems((prev) => {
            const next = prev.filter((_, i) => i !== activeIndex)
            const nextLen = next.length
            setActiveIndex((prevIdx) => (nextLen <= 0 ? 0 : Math.min(prevIdx, nextLen - 1)))
            return next
          })
        }

        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
        return
      }

      setCountdownText(formatRemaining(totalSeconds))
      setCountdownVisible(true)
    }

    tick()
    countdownIntervalRef.current = setInterval(tick, 1000)
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [activeItem, activeIndex, expireMode])

  // If items length shrinks, keep activeIndex in range.
  useEffect(() => {
    if (items.length === 0) {
      setActiveIndex(0)
      return
    }
    setActiveIndex((i) => Math.min(i, items.length - 1))
  }, [items.length])

  const href = useMemo(() => {
    if (!activeItem) return `/${lng}`
    return buildLocalizedHref(lng, activeItem.href)
  }, [activeItem, lng])

  const hasAnyCountdown = useMemo(() => {
    return items.some((p) => parseCountdownEnd(p.countdownEnd) !== null)
  }, [items])

  const onMouseEnter = () => {
    if (!pauseOnHover) return
    setPaused(true)
  }

  const onMouseLeave = () => {
    if (!pauseOnHover) return
    setPaused(false)
  }

  const onFocusCapture = () => {
    if (!pauseOnHover) return
    setPaused(true)
  }

  const onBlurCapture = (e: React.FocusEvent) => {
    if (!pauseOnHover) return
    const nextFocused = e.relatedTarget as HTMLElement | null
    if (nextFocused && e.currentTarget.contains(nextFocused)) return
    setPaused(false)
  }

  return (
    <div className="relative w-full bg-[#B2A28E] text-white">
      <div className="mx-auto max-w-7xl px-4">
        <Link
          href={href}
          className="block w-full py-2.5 text-center"
          suppressHydrationWarning
          onClick={() =>
            track('promo_ribbon_click', {
              href,
              index: activeIndex,
            })
          }
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onFocusCapture={onFocusCapture}
          onBlurCapture={onBlurCapture}
        >
          <div className="mx-auto flex w-full flex-col items-center justify-center">
            <div className="relative w-full max-w-[920px] overflow-hidden">
              <div className="relative flex min-h-[20px] items-center justify-center px-2 text-center">
              {outgoing && (
                <span
                  key={`out_${outgoing.key}`}
                  className={`absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium transition-opacity transition-transform will-change-transform md:text-base ${
                    transitionOn ? 'opacity-0 -translate-y-0.5' : 'opacity-100 translate-y-0'
                  }`}
                  style={{ transitionDuration: `${TRANSITION_MS}ms` }}
                  aria-hidden="true"
                >
                  <span className="opacity-95">{outgoing.item.icon ?? ''}</span>
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{outgoing.item.text[lng]}</span>
                </span>
              )}
              {activeItem && (
                <span
                  key={`in_${incomingKey}`}
                  className={`absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium transition-opacity transition-transform will-change-transform md:text-base ${
                    transitionOn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-0.5'
                  }`}
                  style={{ transitionDuration: `${TRANSITION_MS}ms` }}
                >
                  <span className="opacity-95">{activeItem.icon ?? ''}</span>
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{activeItem.text[lng]}</span>
                </span>
              )}
              </div>
            </div>

            {hasAnyCountdown && (
              <div
                className="mt-0.5 flex items-center justify-center text-[11px] font-medium tabular-nums text-white/90 md:text-xs"
                style={{ height: RESERVED_COUNTDOWN_HEIGHT_PX }}
                aria-live={countdownVisible ? 'polite' : 'off'}
                role={countdownVisible ? 'timer' : undefined}
              >
                <span
                  className={
                    countdownVisible ? 'opacity-100 transition-opacity duration-300' : 'opacity-0 transition-opacity duration-300'
                  }
                >
                  {countdownText}
                </span>
              </div>
            )}
          </div>
        </Link>
      </div>
    </div>
  )
}
