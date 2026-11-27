'use client'

import { useEffect, useMemo, useState } from 'react'

/**
 * The campaign countdown, rendered as the second row of the announcement
 * band - directly under PromoSection, sharing its ground, its type and its
 * gutter so the two read as one element rather than two stacked bars.
 *
 * It currently counts down to the close of Black Week; it carried the Election
 * Sale before that. One campaign at a time: the live deadline is the constant
 * below, and retiring a campaign means pointing that constant at the next one,
 * not stacking a second clock beside this one.
 *
 * It is ordinary page content, exactly like the ribbon above it: in flow, a
 * sibling of the sticky <header> rather than a child of it. That is what keeps
 * the header's behaviour untouched - the band (both rows) scrolls away, the nav
 * lands on top: 0 as the band's last pixel leaves, and nothing is pinned or
 * measured in JS. See HeaderWrapper for why the two must stay siblings.
 */

/**
 * End of the live campaign - Black Week: the end of Saturday 28 November 2026,
 * Israel time, i.e. midnight as the 28th closes and the 29th begins. The sale
 * was extended by one day from its original close (end of the 27th).
 *
 * The offset is written out rather than left to the visitor's clock, so the
 * deadline is the same instant for a shopper in Tel Aviv and one in New York.
 * +02:00 is correct *for this date*: Israel leaves IDT on the last Sunday in
 * October (25 Oct 2026), so late November is on IST. A different campaign date
 * needs this checked again - between late March and late October the right
 * literal is +03:00. Resolved against the IANA database, not assumed.
 *
 * Written as 00:00 on the 29th rather than 23:59:59 on the 28th on purpose: the
 * 28th is then included in full, and the clock runs to a round zero instead of
 * stopping a second short of it.
 */
export const CAMPAIGN_END = '2026-11-29T00:00:00+02:00'

/**
 * The Election Sale's close, kept only because scripts/election-coupon-deadline.ts
 * imports it to reconcile ELEC10's `endDate` in the database with the clock that
 * campaign ran. That campaign is over and this is now history - do NOT repoint it
 * at a new campaign, or that script will move a dead coupon's expiry. The live
 * deadline is CAMPAIGN_END above.
 */
export const ELECTION_SALE_END = '2026-10-28T07:00:00+02:00'

/** Parsed once per module, not per render: the string is a constant, and
 * Date.parse of an ISO string with an explicit offset gives the same instant on
 * the server and in the browser - so nothing here depends on either clock's
 * timezone, only on the current time. */
const CAMPAIGN_END_MS = new Date(CAMPAIGN_END).getTime()

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
    if (endsAt === undefined) return CAMPAIGN_END_MS
    const parsed = endsAt instanceof Date ? endsAt.getTime() : new Date(endsAt).getTime()
    return Number.isFinite(parsed) ? parsed : CAMPAIGN_END_MS
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
    // component whose only output is null. Harmless on 28 Nov 2026, pure waste
    // on 30 Nov.
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
          // pb is the band's bottom margin, and it is set to the gap the ribbon
          // above leaves over the headline: 7px of the link's own padding plus
          // the (24-18)/2 of slack around its 18px line = 10px on a phone, and
          // (26-18)/2 = 4px from sm up. The band is then evenly inset top and
          // bottom instead of sitting 3px lower in its own ground.
          className={`mx-auto flex w-full max-w-3xl flex-col items-center justify-center pb-[10px] text-center font-ploni transition-opacity duration-300 sm:pb-1 ${
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
              centre of the two-line group - and the colons carry the digits'
              line-height, so top-aligning the two boxes lands them on the same
              baseline instead of 1.5px under it.

              The top margin is the same 10px / 4px as the gap above the label
              and the padding below the clock, so the three lines of the band -
              headline, message, clock - are evenly spaced rather than the
              message being pressed against the digits. The 3px inside Segment
              is deliberately NOT part of that rhythm: a number and its unit are
              one object, and they have to read as closer to each other than to
              anything else on the band. */}
          <div dir="ltr" className="mt-[10px] flex items-start justify-center sm:mt-1">
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
 * its own column on a phone and closed the gap to "MINUTES" - so these numbers
 * are a measured floor, and the way to tighten the row is the Colon column
 * below, not these. Four equal columns and three equal gutters also make the
 * row symmetrical about its own centre, which is how it lands on the same
 * centre line as the two lines of type above it. */
function Segment({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="flex w-[50px] flex-col items-center sm:w-[58px]">
      {/* tabular-nums, or the digits change width as they count and the whole
          row twitches sideways every second - the same reason prices use it. */}
      <span className="text-[15px] font-bold leading-none tabular-nums text-text-inverse sm:text-[17px]">
        {pad2(value)}
      </span>
      {/* -mr trims the tracking's overhang so the WORD, not its box, sits on the
          number's axis: tracking adds its 0.06em after every character, the last
          one included, so the span is a sliver wider than its glyphs and
          items-center centres that sliver - leaving the word half a letter-space
          off true.

          Physical right, in both languages, which is not what the logical
          property would do. Blink puts that surplus on the right of the last
          glyph even when the run is RTL, so the Hebrew labels drift the same way
          the English ones do; -me-[0.06em] under dir="auto" resolves to the left
          for them and doubles the error instead of cancelling it. Measured in
          Chromium with the tracking temporarily dialled up to 3px to make a
          quarter-pixel visible - an engine that does the opposite for RTL is
          wrong here by 0.27px, which is under one device pixel. */}
      <span className="-mr-[0.06em] mt-[3px] text-[8px] font-medium uppercase leading-none tracking-[0.06em] text-white/55 sm:text-[9px]">
        {unit}
      </span>
    </span>
  )
}

/** Separator. Dimmed and a size down from the digits so it reads as punctuation.
 *
 * It is a fixed-width column of its own rather than an intrinsically sized
 * glyph, for the same reason Segment is: the gutter between two groups then has
 * a declared width instead of inheriting whatever advance the ':' happens to
 * have in Ploni, in its fallback, and at each of the two sizes - four different
 * gutters for one design. Centred in that column, the three separators sit at
 * exactly even x positions between four equal columns, which is the whole point
 * of fixing the Segment width in the first place.
 *
 * leading matches the digits' box (15/17px, their size at leading-none) rather
 * than this glyph's own, so the row's items-start puts the colon on the digits'
 * baseline. At leading-none its smaller box top-aligned ~1.5px high, which is
 * visible when the ':' is read against two digits either side of it. */
function Colon() {
  return (
    <span
      aria-hidden="true"
      className="w-2 shrink-0 text-center text-[13px] font-bold leading-[15px] text-white/35 sm:w-[10px] sm:text-[15px] sm:leading-[17px]"
    >
      :
    </span>
  )
}
