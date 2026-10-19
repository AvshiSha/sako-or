import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  EDIT_GRANT_TTL_MS,
  checkEditGrant,
  editGrantExpiry,
  shouldPromptForPinAgain,
  type EditGrantRecord,
} from '../staff/edit-grant'

const NOW = new Date('2026-10-19T12:00:00.000Z')

const TARGET = {
  firebaseUid: 'uid-warehouse',
  modelCode: '4925-0301',
  colorCode: '01',
}

function grant(overrides: Partial<EditGrantRecord> = {}): EditGrantRecord {
  return {
    id: 'grant-1',
    firebaseUid: TARGET.firebaseUid,
    modelCode: TARGET.modelCode,
    colorCode: TARGET.colorCode,
    expiresAt: new Date(NOW.getTime() + 60_000),
    consumedAt: null,
    revokedAt: null,
    ...overrides,
  }
}

describe('checkEditGrant', () => {
  it('accepts a fresh grant for the right session and the right edit', () => {
    assert.deepEqual(checkEditGrant(grant(), TARGET, NOW), { ok: true })
  })

  it('rejects a missing grant', () => {
    assert.deepEqual(checkEditGrant(null, TARGET, NOW), { ok: false, reason: 'NOT_FOUND' })
    assert.deepEqual(checkEditGrant(undefined, TARGET, NOW), {
      ok: false,
      reason: 'NOT_FOUND',
    })
  })

  it('rejects a grant minted for another session', () => {
    assert.deepEqual(
      checkEditGrant(grant({ firebaseUid: 'uid-someone-else' }), TARGET, NOW),
      { ok: false, reason: 'WRONG_SESSION' }
    )
  })

  it('reports the wrong session even when the grant has also expired', () => {
    // Reporting "expired" would imply it had once been valid for this caller.
    const stolen = grant({
      firebaseUid: 'uid-someone-else',
      expiresAt: new Date(NOW.getTime() - 1),
    })
    assert.deepEqual(checkEditGrant(stolen, TARGET, NOW), {
      ok: false,
      reason: 'WRONG_SESSION',
    })
  })

  describe('scope is one model and one colour', () => {
    it('rejects a grant for a different model', () => {
      assert.deepEqual(checkEditGrant(grant({ modelCode: '1111-2222' }), TARGET, NOW), {
        ok: false,
        reason: 'WRONG_TARGET',
      })
    })

    it('rejects a grant for a different colour of the same model', () => {
      // A manager who unlocked black has not authorized an edit to dark-blue.
      assert.deepEqual(checkEditGrant(grant({ colorCode: '10' }), TARGET, NOW), {
        ok: false,
        reason: 'WRONG_TARGET',
      })
    })
  })

  it('rejects an expired grant, and treats the expiry instant as expired', () => {
    assert.deepEqual(
      checkEditGrant(grant({ expiresAt: new Date(NOW.getTime() - 1) }), TARGET, NOW),
      { ok: false, reason: 'EXPIRED' }
    )
    assert.deepEqual(checkEditGrant(grant({ expiresAt: NOW }), TARGET, NOW), {
      ok: false,
      reason: 'EXPIRED',
    })
  })

  it('rejects a grant that has already been spent on a save', () => {
    assert.deepEqual(checkEditGrant(grant({ consumedAt: NOW }), TARGET, NOW), {
      ok: false,
      reason: 'CONSUMED',
    })
  })

  it('rejects a grant revoked by cancel or sign-out', () => {
    assert.deepEqual(checkEditGrant(grant({ revokedAt: NOW }), TARGET, NOW), {
      ok: false,
      reason: 'REVOKED',
    })
  })

  it('reports revocation ahead of consumption when both are set', () => {
    const both = grant({ revokedAt: NOW, consumedAt: NOW })
    assert.deepEqual(checkEditGrant(both, TARGET, NOW), { ok: false, reason: 'REVOKED' })
  })
})

describe('editGrantExpiry', () => {
  it('is three minutes out', () => {
    assert.equal(EDIT_GRANT_TTL_MS, 3 * 60 * 1000)
    assert.equal(editGrantExpiry(NOW).getTime(), NOW.getTime() + EDIT_GRANT_TTL_MS)
  })
})

describe('shouldPromptForPinAgain', () => {
  it('re-prompts for the ordinary states on a shared device', () => {
    assert.equal(shouldPromptForPinAgain('EXPIRED'), true)
    assert.equal(shouldPromptForPinAgain('CONSUMED'), true)
    assert.equal(shouldPromptForPinAgain('NOT_FOUND'), true)
  })

  it('does not re-prompt when something is actually wrong', () => {
    assert.equal(shouldPromptForPinAgain('WRONG_SESSION'), false)
    assert.equal(shouldPromptForPinAgain('WRONG_TARGET'), false)
    assert.equal(shouldPromptForPinAgain('REVOKED'), false)
  })
})
