import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  demandsFreshPassword,
  OIDC_GRANT_TYPES,
  oidcSessionIsStale,
  promptValues,
  sessionIsFresh,
} from './policy'

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

  it('reuses the OIDC session only while it matches the SSO session', async () => {
    const allowed = async () => true
    const stale = (input: Partial<Parameters<typeof oidcSessionIsStale>[0]>) =>
      oidcSessionIsStale({
        oidcAccountId: 'alice',
        resumedFromInteraction: false,
        ssoUserId: 'alice',
        canUseApp: allowed,
        ...input,
      })

    assert.equal(await stale({}), false)
    // Logged out of habidat: the remembered OIDC session must not log alice in.
    assert.equal(await stale({ ssoUserId: null }), true)
    // Someone else is logged in to habidat now.
    assert.equal(await stale({ ssoUserId: 'bob' }), true)
    // alice lost access to the app since the OIDC session was created.
    assert.equal(await stale({ canUseApp: async () => false }), true)
  })

  it('leaves requests without an OIDC session and resumed interactions alone', async () => {
    let asked = false
    const canUseApp = async () => {
      asked = true
      return false
    }
    assert.equal(
      await oidcSessionIsStale({
        oidcAccountId: undefined,
        resumedFromInteraction: false,
        ssoUserId: null,
        canUseApp,
      }),
      false
    )
    assert.equal(
      await oidcSessionIsStale({
        oidcAccountId: 'alice',
        resumedFromInteraction: true,
        ssoUserId: null,
        canUseApp,
      }),
      false
    )
    assert.equal(asked, false)
  })

  it('does not advertise refresh tokens', () => {
    assert.deepEqual(OIDC_GRANT_TYPES, ['authorization_code'])
    for (const file of ['clients.ts', 'config.ts']) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
      assert.equal(source.includes('refresh_token'), false, file)
    }
  })
})
