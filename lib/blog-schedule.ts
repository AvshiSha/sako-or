/**
 * Editorial scheduling for blog articles.
 *
 * Two separate concerns live here:
 *
 *   - the status transitions a scheduled article goes through, and
 *   - converting the editor's wall-clock time to the UTC instant we store.
 *
 * Every date on BlogArticle is a UTC ISO string (`publishedAt`, `createdAt`,
 * `updatedAt`), and that does not change: `publishedAt` stays the single source
 * of truth for *when*, and `status` carries *whether*. Nothing stores a
 * timezone, so nothing can disagree about one.
 */

/**
 * The editorial timezone. SAKO-OR is an Israeli store and the SEO calendar is
 * planned in local time, so "publish Sunday at 09:00" has to mean 09:00 in
 * Jerusalem, not 09:00 UTC -- a two- or three-hour error depending on whether
 * IDT is in effect, which is exactly the kind of thing that silently publishes
 * an article the evening before.
 */
export const EDITORIAL_TIMEZONE = 'Asia/Jerusalem'

/** How far ahead an article may be scheduled. A year is already absurd; this catches typos in the year. */
const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000

/** A bare wall-clock string, `YYYY-MM-DDTHH:mm` with optional seconds and no zone. */
const LOCAL_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/

export type ParseScheduleResult =
  | { ok: true; publishAtUtc: string; wasInPast: boolean }
  | { ok: false; error: string }

/**
 * Offset of `timeZone` from UTC, in minutes, at the given instant.
 *
 * Derived by formatting the instant in that zone and reading the result back as
 * if it were UTC: the difference between the two is the offset. This is the
 * standard trick and it avoids hardcoding an IST/IDT table or taking on a
 * timezone library for one call site -- Node's ICU data already knows when
 * Israel switches, and it stays correct when the rules change.
 */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const parts: Record<string, number> = {}
  for (const { type, value } of formatter.formatToParts(instant)) {
    if (type !== 'literal') parts[type] = Number(value)
  }

  // Intl renders midnight as hour 24 in some ICU versions.
  const hour = parts.hour === 24 ? 0 : parts.hour

  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, parts.minute, parts.second)
  // Seconds are whole on both sides, so this division is exact.
  return (asUtc - instant.getTime()) / 60000
}

/**
 * Convert a Jerusalem wall-clock time to the UTC instant it names.
 *
 * Two passes, because the offset depends on the instant we are still solving
 * for: guess with the offset at the naive timestamp, then recompute the offset
 * at that guess and correct. One correction is enough for every real case --
 * the two passes only disagree within an hour of a DST transition, and the
 * second pass lands on the right side of it.
 *
 * Ambiguity at the transitions is resolved rather than rejected: the hour that
 * repeats in autumn resolves to the first occurrence, and the hour that does
 * not exist in spring resolves forward past the gap. Refusing to schedule an
 * article because its hour is ambiguous would be a worse answer than being an
 * hour off once a year on a date nobody picked deliberately.
 */
export function localWallClockToUtc(wallClock: string, timeZone = EDITORIAL_TIMEZONE): Date | null {
  const match = LOCAL_DATETIME_RE.exec(wallClock.trim())
  if (!match) return null

  const [, year, month, day, hour, minute, second] = match
  const naiveUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? '0')
  )

  // Reject a date the calendar does not have (2026-02-31 normalizes silently
  // through Date.UTC, which would schedule for March without complaint).
  const roundTrip = new Date(naiveUtc)
  if (
    roundTrip.getUTCFullYear() !== Number(year) ||
    roundTrip.getUTCMonth() !== Number(month) - 1 ||
    roundTrip.getUTCDate() !== Number(day) ||
    Number(hour) > 23 ||
    Number(minute) > 59
  ) {
    return null
  }

  const firstGuess = naiveUtc - zoneOffsetMinutes(new Date(naiveUtc), timeZone) * 60000
  const corrected = naiveUtc - zoneOffsetMinutes(new Date(firstGuess), timeZone) * 60000
  return new Date(corrected)
}

/** Render a UTC instant as a Jerusalem wall-clock string, for display and logs. */
export function utcToLocalWallClock(iso: string, timeZone = EDITORIAL_TIMEZONE): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const parts: Record<string, string> = {}
  for (const { type, value } of formatter.formatToParts(date)) {
    if (type !== 'literal') parts[type] = value
  }
  const hour = parts.hour === '24' ? '00' : parts.hour
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}`
}

/**
 * Validate a requested publication time and return the UTC instant to store.
 *
 * Accepts either a bare Jerusalem wall-clock string (`2026-11-05T09:00`), which
 * is what an editor means and what the MCP tool documents, or a full ISO
 * timestamp carrying its own offset, which is taken at face value.
 *
 * A time in the past is not an error. The cron publishes anything due, so a
 * past time means "as soon as possible" -- within one cron tick. It is reported
 * back through `wasInPast` so the caller can say so instead of implying the
 * article went live instantly.
 */
export function parseScheduleTime(
  input: string,
  now: Date = new Date(),
  timeZone = EDITORIAL_TIMEZONE
): ParseScheduleResult {
  const trimmed = (input ?? '').trim()
  if (!trimmed) {
    return { ok: false, error: 'publishAt is required.' }
  }

  let instant: Date | null = null

  if (LOCAL_DATETIME_RE.test(trimmed)) {
    instant = localWallClockToUtc(trimmed, timeZone)
    if (!instant) {
      return { ok: false, error: `publishAt is not a real date and time: "${trimmed}".` }
    }
  } else {
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) {
      return {
        ok: false,
        error:
          `publishAt must be a local ${timeZone} time such as "2026-11-05T09:00", ` +
          'or a full ISO timestamp with an offset.',
      }
    }
    instant = parsed
  }

  if (instant.getTime() - now.getTime() > MAX_SCHEDULE_AHEAD_MS) {
    return { ok: false, error: 'publishAt is more than a year away. Check the year.' }
  }

  return {
    ok: true,
    publishAtUtc: instant.toISOString(),
    wasInPast: instant.getTime() <= now.getTime(),
  }
}

/** True when a scheduled article's time has arrived. */
export function isDueForPublication(publishedAt: string, now: Date = new Date()): boolean {
  const due = new Date(publishedAt)
  if (Number.isNaN(due.getTime())) return false
  return due.getTime() <= now.getTime()
}
