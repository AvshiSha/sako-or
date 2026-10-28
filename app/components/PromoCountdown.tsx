'use client'

import { useEffect, useMemo, useState } from 'react'

/**
 * The Election Sale countdown, rendered as the second row of the announcement
 * band - directly under PromoSection, sharing its ground, its type and its
 * gutter so the two read as one element rather than two stacked bars.
 *
 * It is ordinary page content, exactly like the ribbon above it: in flow, a
 * sibling of the sticky <header> rather than a child of it. That is what keeps
 * the header's behaviour untouched - the band (both rows) scrolls away, the nav
 * lands on top: 0 as the band's last pixel leaves, and nothing is pinned or
 * measured in JS. See HeaderWrapper for why the two must stay siblings.
 */

/**
 * End of the campaign: 07:00 on Wednesday 28 October 2026, Israel time
 * (extended from the original midnight close).
 *
 * The offset is written out rather than left to the visitor's clock, so the
 * deadline is the same instant for a shopper in Tel Aviv and one in New York.
 * +02:00 is correct *for this date*: Israel leaves IDT on the last Sunday in
 * October (25 Oct 2026), so the campaign closes on IST. A different campaign
 * date needs this checked again - between late March and late October the
 * right literal is +03:00. Resolved against the IANA database, not assumed.
 *
 * This is also the coupon's expiry. ELEC10's `endDate` in the database is set
 * from this exact constant by scripts/election-coupon-deadline.ts, which
 * imports it rather than restating it - so the clock on screen and the code at
 * the till cannot drift apart by one of them being edited alone. Changing the
 * literal below means re-running that script with `--apply`; running it without
 * the flag reports whether the two currently agree.
 */
export const ELECTION_SALE_END = '2026-10-28T07:00:00+02:00'

/** Parsed once per module, not per render: the string is a constant, and
 * Date.parse of an ISO string with an explicit offset gives the same instant on
 * the server and in the browser - so nothing here depends on either clock's
 * timezone, only on the current time. */
const ELECTION_SALE_END_MS = new Date(ELECTION_SALE_END).getTime()

interface Remaining {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
}

function getRemaining(endMs: number): Remaining {
  const totalMs = Math.max(0, endMs - Date.now())
  const totalSeconds = Math.floor(totalMs / 1000)
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

const copy = {
  he: {
    label: 'המבצע מסתיים בעוד',
    days: 'ימים',
    hours: 'שעות',
    minutes: 'דקות',
    seconds: 'שניות',
    aria: 'הזמן שנותר עד סיום המבצע',
  },
  en: {
    label: 'Sale ends in',
    days: 'Days',
    hours: 'Hours',
    minutes: 'Minutes',
    seconds: 'Seconds',
    aria: 'Time remaining until the sale ends',
  },
} as const

interface PromoCountdownProps {
  lng: 'en' | 'he'
  /** Overridable so a test can drive the expiry branch without waiting for 2026. */
  endsAt?: string | number | Date
}

export default function PromoCountdown({ lng, endsAt }: PromoCountdownProps) {
  const endMs = useMemo(() => {
    if (endsAt === undefined) return ELECTION_SALE_END_MS
    const parsed = endsAt instanceof Date ? endsAt.getTime() : new Date(endsAt).getTime()
    return Number.isFinite(parsed) ? parsed : ELECTION_SALE_END_MS
  }, [endsAt])

  // null until the first client tick. The server has no business rendering a
  // number here: this page is cached, so a server-rendered second would be
  // stale on arrival AND would differ from the browser's first render, which is
  // precisely a hydration mismatch. The skeleton below occupies the same box,
  // so filling it in costs no layout shift.
  const [remaining, setRemaining] = useState<Remaining | null>(null)

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null

    // Stop the clock the moment it reaches zero. Returning null below does not
    // unmount this component, so without this the interval kept firing once a
    // second - for every visitor, on every page, forever - re-rendering a
    // component whose only output is null. Harmless on 27 Oct 2026, pure waste
    // on 29 Oct.
    const tick = () => {
      const next = getRemaining(endMs)
      setRemaining(next)
      if (next.totalMs <= 0 && id !== null) {
        clearInterval(id)
        id = null
      }
    }

    tick()
    if (getRemaining(endMs).totalMs > 0) {
      id = setInterval(tick, 1000)
    }
    return () => {
      if (id !== null) clearInterval(id)
    }
  }, [endMs])

  // Only ever decided on the client, for the same staleness reason as above.
  // The one-time collapse of this row when the campaign closes is the intended
  // behaviour, not a shift to design around.
  if (remaining !== null && remaining.totalMs <= 0) return null

  const t = copy[lng]
  const ready = remaining !== null

  return (
    // Same ground and same gutter as the ribbon, with no divider between them:
    // the band is one block of sako-ink-800 that happens to carry two rows.
    <div className="w-full bg-sako-ink-800 text-text-inverse">
      <div className="mx-auto max-w-7xl px-4">
        <div
          className={`mx-auto flex w-full max-w-3xl flex-col items-center justify-center pb-[7px] text-center font-ploni transition-opacity duration-300 sm:pb-1.5 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
          dir={lng === 'he' ? 'rtl' : 'ltr'}
          role="timer"
          // Second-by-second is far too chatty to announce. The label and the
          // values are readable on demand; only the arrival of the row matters.
          aria-live="off"
          aria-label={t.aria}
        >
          {/* Its own centred line rather than inline beside the clock. The four
              groups have to stay on one row down to 320px, and at that width the
              label and the row cannot both fit - measured, not assumed. Set in
              the ribbon's own 10/11px bold so it reads as a continuation of it. */}
          <span className="text-[10px] font-bold leading-none text-text-inverse sm:text-[11px]">
            {t.label}
          </span>
          {/* dir="ltr" regardless of locale. The groups are a clock reading
              days -> seconds, and that order is left-to-right in Hebrew too;
              letting the RTL context mirror it would put seconds first.
              items-start, so the colons align to the digits rather than to the
              centre of the two-line group. */}
          <div dir="ltr" className="mt-[3px] flex items-start justify-center">
            <Segment value={remaining?.days ?? 0} unit={t.days} />
            <Colon />
            <Segment value={remaining?.hours ?? 0} unit={t.hours} />
            <Colon />
            <Segment value={remaining?.minutes ?? 0} unit={t.minutes} />
            <Colon />
            <Segment value={remaining?.seconds ?? 0} unit={t.seconds} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** One fixed-width column: digits over their unit, no box, border or shadow.
 *
 * The width is fixed rather than intrinsic so the four groups are evenly
 * spaced and the colons sit at stable x positions - otherwise "Seconds" would
 * make its own column wider than "Days" and the separators would step across
 * the row. It is sized off the widest label in either language, which is the
 * English "SECONDS" rather than anything in Hebrew: at 46px that one overran
 * its own column on a phone and closed the gap to "MINUTES". */
function Segment({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="flex w-[50px] flex-col items-center sm:w-[58px]">
      {/* tabular-nums, or the digits change width as they count and the whole
          row twitches sideways every second - the same reason prices use it. */}
      <span className="text-[15px] font-bold leading-none tabular-nums text-text-inverse sm:text-[17px]">
        {pad2(value)}
      </span>
      <span className="mt-[3px] text-[8px] font-medium uppercase leading-none tracking-[0.06em] text-white/55 sm:text-[9px]">
        {unit}
      </span>
    </span>
  )
}

/** Separator. Dimmed and a size down from the digits so it reads as punctuation,
 * and line-height-matched to them so it sits on the digit row, not between the
 * two lines of the groups it divides. */
function Colon() {
  return (
    <span
      aria-hidden="true"
      className="text-[13px] font-bold leading-none text-white/35 sm:text-[15px]"
    >
      :
    </span>
  )
}
