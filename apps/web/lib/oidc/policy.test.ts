import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { demandsFreshPassword, OIDC_GRANT_TYPES, promptValues, sessionIsFresh } from './policy'

describe('OIDC interaction policy', () => {
  it('demands a fresh password only for prompt=login and max_age', () => {
    assert.equal(demandsFreshPassword(['no_session']), false)
    assert.equal(demandsFreshPassword(['login_prompt']), true)
    assert.equal(demandsFreshPassword(['max_age']), true)
    assert.equal(demandsFreshPassword(undefined), false)
  })

  it('treats a new session id as the fresh password', () => {
    assert.equal(
      sessionIsFresh({
        sessionId: 'new',
        createdAt: new Date(),
        markedSessionId: 'old',
        markedAt: Date.now(),
      }),
      true
    )
    assert.equal(
      sessionIsFresh({
        sessionId: 'old',
        createdAt: new Date(),
        markedSessionId: 'old',
        markedAt: Date.now(),
      }),
      false
    )
  })

  it('accepts a login that started after a reauth with no prior session', () => {
    const markedAt = Date.now()
    assert.equal(
      sessionIsFresh({
        sessionId: 'new',
        createdAt: new Date(markedAt + 5_000),
        markedSessionId: null,
        markedAt,
      }),
      true
    )
    assert.equal(
      sessionIsFresh({
        sessionId: 'old',
        createdAt: new Date(markedAt - 60_000),
        markedSessionId: null,
        markedAt,
      }),
      false
    )
  })

  it('reads prompt=none as its own value', () => {
    assert.equal(promptValues('none').has('none'), true)
    assert.equal(promptValues('login consent').has('none'), false)
    assert.equal(promptValues(undefined).size, 0)
  })

  it('does not advertise refresh tokens', () => {
    assert.deepEqual(OIDC_GRANT_TYPES, ['authorization_code'])
    for (const file of ['clients.ts', 'config.ts']) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
      assert.equal(source.includes('refresh_token'), false, file)
    }
  })
})
