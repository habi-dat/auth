import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ORDINARY_ABSOLUTE_MS,
  ORDINARY_IDLE_MS,
  PERSISTENT_LIFETIME_MS,
  requestHeader,
  STAY_LOGGED_IN_HEADER,
  sessionCookieMaxAgeSeconds,
  sessionExpiresAt,
  shouldRefreshSessionExpiry,
  stayLoggedInFromHeader,
} from './session-lifetime'

const login = new Date('2026-10-02T09:00:00.000Z')

describe('sessionExpiresAt', () => {
  it('starts an ordinary session 12 hours after login', () => {
    const expires = sessionExpiresAt({ createdAt: login, now: login, stayLoggedIn: false })
    assert.equal(expires.getTime() - login.getTime(), ORDINARY_IDLE_MS)
  })

  it('extends an ordinary session by 12 hours of use, but not past 24 hours from login', () => {
    const sixHoursLater = new Date(login.getTime() + 6 * 60 * 60 * 1000)
    const extended = sessionExpiresAt({
      createdAt: login,
      now: sixHoursLater,
      stayLoggedIn: false,
    })
    assert.equal(extended.getTime(), sixHoursLater.getTime() + ORDINARY_IDLE_MS)

    const stillUsingNextMorning = new Date(login.getTime() + 23 * 60 * 60 * 1000)
    const capped = sessionExpiresAt({
      createdAt: login,
      now: stillUsingNextMorning,
      stayLoggedIn: false,
    })
    assert.equal(capped.getTime(), login.getTime() + ORDINARY_ABSOLUTE_MS)
  })

  it('keeps a persistent session fixed at 30 days from login', () => {
    const atLogin = sessionExpiresAt({ createdAt: login, now: login, stayLoggedIn: true })
    assert.equal(atLogin.getTime() - login.getTime(), PERSISTENT_LIFETIME_MS)

    const tenDaysLater = new Date(login.getTime() + 10 * 24 * 60 * 60 * 1000)
    const stillFixed = sessionExpiresAt({
      createdAt: login,
      now: tenDaysLater,
      stayLoggedIn: true,
    })
    assert.equal(stillFixed.getTime(), atLogin.getTime())
  })
})

describe('shouldRefreshSessionExpiry', () => {
  it('writes only when the new end is more than an hour later', () => {
    const current = new Date(login.getTime() + ORDINARY_IDLE_MS)
    const oneHourLater = new Date(current.getTime() + 60 * 60 * 1000)
    const justOverAnHour = new Date(oneHourLater.getTime() + 1)
    assert.equal(shouldRefreshSessionExpiry(current, oneHourLater), false)
    assert.equal(shouldRefreshSessionExpiry(current, justOverAnHour), true)
    assert.equal(shouldRefreshSessionExpiry(current, current), false)
  })
})

describe('stayLoggedInFromHeader', () => {
  it('is persistent only when the login header is exactly 1', () => {
    assert.equal(stayLoggedInFromHeader('1'), true)
    assert.equal(stayLoggedInFromHeader(null), false)
    assert.equal(stayLoggedInFromHeader('true'), false)
    assert.equal(stayLoggedInFromHeader('0'), false)
    const headers = new Headers({ [STAY_LOGGED_IN_HEADER]: '1' })
    assert.equal(stayLoggedInFromHeader(requestHeader(headers, STAY_LOGGED_IN_HEADER)), true)
    assert.equal(stayLoggedInFromHeader(requestHeader(undefined, STAY_LOGGED_IN_HEADER)), false)
  })
})

describe('sessionCookieMaxAgeSeconds', () => {
  it('is the remaining lifetime in whole seconds and never negative', () => {
    const expiresAt = new Date(login.getTime() + 90_500)
    assert.equal(sessionCookieMaxAgeSeconds(expiresAt, login), 90)
    assert.equal(sessionCookieMaxAgeSeconds(login, expiresAt), 0)
  })
})
