import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  hmacSha256Hex,
  isAllowedBrowserOrigin,
  parseAllowedDiscourseReturnUrl,
  verifyDiscourseSsoPayload,
} from './sso'

describe('verifyDiscourseSsoPayload', () => {
  it('accepts a matching hex HMAC', () => {
    const payload = Buffer.from('nonce=abc').toString('base64')
    const sig = hmacSha256Hex('secret', payload)
    assert.equal(verifyDiscourseSsoPayload('secret', payload, sig), payload)
  })

  it('restores + that URLSearchParams turned into spaces', () => {
    const payload = 'abc+def/ghi'
    const sig = hmacSha256Hex('secret', payload)
    assert.equal(verifyDiscourseSsoPayload('secret', payload.replaceAll('+', ' '), sig), payload)
  })

  it('rejects a wrong signature of the same length', () => {
    const payload = Buffer.from('nonce=abc').toString('base64')
    const sig = hmacSha256Hex('secret', payload)
    const flipped = `${sig.slice(0, -1)}${sig.endsWith('a') ? 'b' : 'a'}`
    assert.equal(verifyDiscourseSsoPayload('secret', payload, flipped), null)
  })

  it('rejects a truncated signature', () => {
    const payload = Buffer.from('nonce=abc').toString('base64')
    const sig = hmacSha256Hex('secret', payload)
    assert.equal(verifyDiscourseSsoPayload('secret', payload, sig.slice(0, 8)), null)
  })
})

describe('parseAllowedDiscourseReturnUrl', () => {
  const allowlist = {
    discourseUrl: 'http://discourse:80',
    appUrl: 'https://user.example.org',
    trustedOrigins: 'https://*.example.org',
  }

  it('allows DiscourseConnect login on a sibling host', () => {
    const url = parseAllowedDiscourseReturnUrl(
      'https://forum.example.org/session/sso_login',
      allowlist
    )
    assert.ok(url)
    assert.equal(url.hostname, 'forum.example.org')
  })

  it('allows the Docker-internal Discourse host used as DISCOURSE_URL', () => {
    const url = parseAllowedDiscourseReturnUrl('http://discourse/session/sso_login', allowlist)
    assert.ok(url)
    assert.equal(url.hostname, 'discourse')
  })

  it('rejects a host that is not on the allowlist', () => {
    assert.equal(
      parseAllowedDiscourseReturnUrl('https://evil.example.net/session/sso_login', allowlist),
      null
    )
  })

  it('rejects a path other than /session/sso_login', () => {
    assert.equal(
      parseAllowedDiscourseReturnUrl('https://forum.example.org/session/sso', allowlist),
      null
    )
  })

  it('rejects credentials in the URL', () => {
    assert.equal(
      parseAllowedDiscourseReturnUrl(
        'https://user:pass@forum.example.org/session/sso_login',
        allowlist
      ),
      null
    )
  })
})

describe('isAllowedBrowserOrigin', () => {
  const allowlist = {
    discourseUrl: 'http://discourse:80',
    appUrl: 'https://user.example.org',
    trustedOrigins: 'https://*.example.org',
  }

  it('allows the auth app origin and sibling hosts', () => {
    assert.equal(isAllowedBrowserOrigin('https://user.example.org', allowlist), true)
    assert.equal(isAllowedBrowserOrigin('https://cloud.example.org', allowlist), true)
  })

  it('rejects Docker-internal Discourse and unknown hosts', () => {
    assert.equal(isAllowedBrowserOrigin('http://discourse', allowlist), false)
    assert.equal(isAllowedBrowserOrigin('https://evil.example.net', allowlist), false)
  })
})
