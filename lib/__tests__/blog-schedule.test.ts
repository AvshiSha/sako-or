import test from 'node:test'
import assert from 'node:assert/strict'

import {
  EDITORIAL_TIMEZONE,
  isDueForPublication,
  localWallClockToUtc,
  parseScheduleTime,
  utcToLocalWallClock,
} from '@/lib/blog-schedule'

test('EDITORIAL_TIMEZONE is Asia/Jerusalem', () => {
  assert.equal(EDITORIAL_TIMEZONE, 'Asia/Jerusalem')
})

test('winter wall clock converts at UTC+2 (IST)', () => {
  // 2026-01-15 09:00 Jerusalem = 07:00Z
  const utc = localWallClockToUtc('2026-01-15T09:00')
  assert.ok(utc)
  assert.equal(utc.toISOString(), '2026-01-15T07:00:00.000Z')
})

test('summer wall clock converts at UTC+3 (IDT)', () => {
  // 2026-07-15 09:00 Jerusalem = 06:00Z
  const utc = localWallClockToUtc('2026-07-15T09:00')
  assert.ok(utc)
  assert.equal(utc.toISOString(), '2026-07-15T06:00:00.000Z')
})

test('a space separator and explicit seconds are both accepted', () => {
  assert.equal(
    localWallClockToUtc('2026-01-15 09:30:45')?.toISOString(),
    '2026-01-15T07:30:45.000Z'
  )
})

test('round trip through the local renderer is stable in both DST halves', () => {
  for (const wall of ['2026-01-15T09:00', '2026-07-15T09:00', '2026-12-31T23:59']) {
    const utc = localWallClockToUtc(wall)
    assert.ok(utc, `${wall} should parse`)
    assert.equal(utcToLocalWallClock(utc.toISOString()), wall.replace('T', ' '))
  }
})

test('a date the calendar does not have is rejected, not normalized', () => {
  // Date.UTC would silently roll this into March.
  assert.equal(localWallClockToUtc('2026-02-31T09:00'), null)
  assert.equal(localWallClockToUtc('2026-13-01T09:00'), null)
  assert.equal(localWallClockToUtc('2026-01-15T25:00'), null)
  assert.equal(localWallClockToUtc('2026-01-15T09:75'), null)
})

test('a malformed string is rejected', () => {
  assert.equal(localWallClockToUtc('next tuesday'), null)
  assert.equal(localWallClockToUtc(''), null)
  assert.equal(localWallClockToUtc('2026-01-15'), null)
})

test('the spring-forward gap resolves forward instead of failing', () => {
  // Israel springs forward at 02:00 local on the Friday before the last Sunday
  // of March; 2026-03-27 02:30 does not exist. It must still produce an
  // instant rather than refusing to schedule.
  const utc = localWallClockToUtc('2026-03-27T02:30')
  assert.ok(utc, 'a nonexistent local hour should still resolve')
  assert.ok(!Number.isNaN(utc.getTime()))
})

test('the autumn repeated hour resolves to a single instant', () => {
  const utc = localWallClockToUtc('2026-10-25T01:30')
  assert.ok(utc)
  assert.ok(!Number.isNaN(utc.getTime()))
})

test('parseScheduleTime stores UTC for a local wall-clock input', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')
  const result = parseScheduleTime('2026-01-15T09:00', now)
  assert.equal(result.ok, true)
  assert.ok(result.ok)
  assert.equal(result.publishAtUtc, '2026-01-15T07:00:00.000Z')
  assert.equal(result.wasInPast, false)
})

test('parseScheduleTime accepts a full ISO timestamp at face value', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')
  const result = parseScheduleTime('2026-01-15T07:00:00.000Z', now)
  assert.ok(result.ok)
  assert.equal(result.publishAtUtc, '2026-01-15T07:00:00.000Z')
})

test('a past time is accepted and flagged, not rejected', () => {
  const now = new Date('2026-06-01T00:00:00.000Z')
  const result = parseScheduleTime('2026-01-15T09:00', now)
  assert.ok(result.ok)
  assert.equal(result.wasInPast, true)
})

test('parseScheduleTime rejects empty, garbage and absurd input', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')
  assert.equal(parseScheduleTime('', now).ok, false)
  assert.equal(parseScheduleTime('whenever', now).ok, false)
  assert.equal(parseScheduleTime('2126-01-15T09:00', now).ok, false)
})

test('isDueForPublication compares instants, and survives a bad stored value', () => {
  const now = new Date('2026-01-15T08:00:00.000Z')
  assert.equal(isDueForPublication('2026-01-15T07:00:00.000Z', now), true)
  assert.equal(isDueForPublication('2026-01-15T09:00:00.000Z', now), false)
  assert.equal(isDueForPublication('2026-01-15T08:00:00.000Z', now), true)
  assert.equal(isDueForPublication('not a date', now), false)
})
