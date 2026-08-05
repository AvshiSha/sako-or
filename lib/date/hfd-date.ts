import 'server-only'

/**
 * HFD reports status timestamps as two separate strings — `status_date` in
 * DD/MM/YYYY and `status_time` in HH:mm:ss — expressed in **Israel local wall-clock
 * time**, with no offset attached.
 *
 * Converting those to a correct UTC instant is not as simple as appending "+02:00":
 * Israel observes DST (IDT, UTC+3) from late March to late October, so a hardcoded
 * offset is wrong for roughly seven months of the year. A delivery stamped
 * "04/08/2026 13:30:00" is 10:30 UTC, not 11:30.
 *
 * `date-fns` v4 core carries no timezone support, and `@date-fns/tz` is present in
 * node_modules only as a transitive dependency of `react-day-picker` — importing it
 * would mean relying on someone else's dependency tree. So this resolves the real
 * offset via `Intl.DateTimeFormat`, which uses the platform's tz database and needs
 * no new dependency.
 */

const ISRAEL_TIME_ZONE = 'Asia/Jerusalem'

/**
 * Returns the UTC offset (in ms) that `timeZone` was observing at `instant`.
 *
 * Works by formatting the instant into the target zone's wall-clock fields, then
 * reinterpreting those fields as if they were UTC. The difference between that and
 * the original instant is the offset.
 */
function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
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

  const fields: Record<string, number> = {}
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') {
      fields[part.type] = Number(part.value)
    }
  }

  const asIfUtc = Date.UTC(
    fields.year,
    fields.month - 1,
    fields.day,
    // Some engines emit hour "24" for midnight under hour12:false.
    fields.hour % 24,
    fields.minute,
    fields.second
  )

  return asIfUtc - instant.getTime()
}

/**
 * Converts wall-clock date/time components in `timeZone` to the corresponding UTC Date.
 *
 * The offset is resolved twice: once against a first guess, then again against the
 * corrected instant. That second pass matters only for timestamps falling within a
 * few hours of a DST transition, where the guess can land on the wrong side of the
 * boundary and pick up the neighbouring offset.
 */
function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second)

  const firstOffset = getTimeZoneOffsetMs(new Date(naiveUtc), timeZone)
  const firstPass = naiveUtc - firstOffset

  const secondOffset = getTimeZoneOffsetMs(new Date(firstPass), timeZone)

  return new Date(secondOffset === firstOffset ? firstPass : naiveUtc - secondOffset)
}

/**
 * Parses HFD's `status_date`. Accepts the documented DD/MM/YYYY as well as
 * ISO-ish YYYY-MM-DD, since the PUSH payload format is not documented and may
 * differ from the PULL response.
 */
function parseDateParts(date: string): { year: number; month: number; day: number } | null {
  const trimmed = date.trim()

  const slashed = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(trimmed)
  if (slashed) {
    return { day: Number(slashed[1]), month: Number(slashed[2]), year: Number(slashed[3]) }
  }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed)
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
  }

  return null
}

/** Parses HFD's `status_time`. Seconds are optional. */
function parseTimeParts(time: string | null | undefined): {
  hour: number
  minute: number
  second: number
} {
  if (!time) return { hour: 0, minute: 0, second: 0 }

  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(time.trim())
  if (!match) return { hour: 0, minute: 0, second: 0 }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: match[3] ? Number(match[3]) : 0,
  }
}

/**
 * Parses HFD's `status_timezone`, which their real PUSH payload sends as "GMT+2".
 *
 * Accepts the variants worth anticipating — "GMT+2", "GMT+02:00", "UTC+3", "+0200",
 * "+02:00", "Z" — and returns the offset in minutes east of UTC.
 */
export function parseGmtOffsetMinutes(timezone: string | null | undefined): number | null {
  if (!timezone) return null

  const trimmed = timezone.trim().toUpperCase()
  if (trimmed === 'Z' || trimmed === 'UTC' || trimmed === 'GMT') return 0

  const match = /^(?:GMT|UTC)?\s*([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(trimmed)
  if (!match) return null

  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = match[3] ? Number(match[3]) : 0

  if (hours > 14 || minutes > 59) return null

  return sign * (hours * 60 + minutes)
}

/**
 * Converts an HFD date/time pair into a UTC Date.
 *
 * When the carrier states an explicit offset (`status_timezone`) that is authoritative
 * and is used directly. Otherwise the offset is inferred from Israel's tz database
 * entry for that date.
 *
 * A caveat worth knowing: HFD's sample sends "GMT+2" for a February timestamp, which
 * is correct for winter, but we have no summer sample confirming they switch to
 * "GMT+3" during IDT. If they hardcode +2 year-round, their stated offset will be an
 * hour off in summer. `explicitDisagreedWithZone` reports that mismatch so it shows up
 * in logs rather than silently skewing delivery timestamps by an hour.
 *
 * Returns `null` rather than throwing when input is missing or unparseable — callers
 * substitute the webhook receipt time, because a status we cannot timestamp is still
 * a status worth recording.
 */
export function parseHfdDateTime(
  date: string | null | undefined,
  time?: string | null,
  timezone?: string | null
): Date | null {
  return parseHfdDateTimeDetailed(date, time, timezone).date
}

export interface HfdDateParseResult {
  date: Date | null
  /** True when the carrier's stated offset differs from Israel's actual offset. */
  explicitDisagreedWithZone: boolean
  /** The offset actually applied, in minutes east of UTC. */
  appliedOffsetMinutes: number | null
}

export function parseHfdDateTimeDetailed(
  date: string | null | undefined,
  time?: string | null,
  timezone?: string | null
): HfdDateParseResult {
  const empty: HfdDateParseResult = {
    date: null,
    explicitDisagreedWithZone: false,
    appliedOffsetMinutes: null,
  }

  if (!date) return empty

  const dateParts = parseDateParts(date)
  if (!dateParts) return empty

  const { year, month, day } = dateParts
  if (month < 1 || month > 12 || day < 1 || day > 31) return empty

  const { hour, minute, second } = parseTimeParts(time)
  if (hour > 23 || minute > 59 || second > 59) return empty

  const explicitOffset = parseGmtOffsetMinutes(timezone)

  if (explicitOffset !== null) {
    // Wall-clock minus the stated offset gives the UTC instant directly.
    const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second)
    const result = new Date(naiveUtc - explicitOffset * 60 * 1000)

    if (Number.isNaN(result.getTime())) return empty

    const inferred = zonedWallClockToUtc(
      year,
      month,
      day,
      hour,
      minute,
      second,
      ISRAEL_TIME_ZONE
    )

    return {
      date: result,
      explicitDisagreedWithZone: inferred.getTime() !== result.getTime(),
      appliedOffsetMinutes: explicitOffset,
    }
  }

  const result = zonedWallClockToUtc(
    year,
    month,
    day,
    hour,
    minute,
    second,
    ISRAEL_TIME_ZONE
  )

  if (Number.isNaN(result.getTime())) return empty

  return {
    date: result,
    explicitDisagreedWithZone: false,
    appliedOffsetMinutes: Math.round(
      (Date.UTC(year, month - 1, day, hour, minute, second) - result.getTime()) / 60000
    ),
  }
}
