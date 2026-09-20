import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cookieParentDomain } from './cookie-domain'

describe('cookieParentDomain', () => {
  it('uses the registrable parent so cloud.example.org can send the user.example.org session', () => {
    assert.equal(cookieParentDomain('https://user.example.org'), 'example.org')
    assert.equal(cookieParentDomain('https://user.habidat.org'), 'habidat.org')
  })

  it('keeps an extra public suffix label (user.example.co.uk → example.co.uk)', () => {
    assert.equal(cookieParentDomain('https://user.example.co.uk'), 'example.co.uk')
  })

  it('covers local mkcert hosts like user.habidat.localhost', () => {
    assert.equal(cookieParentDomain('https://user.habidat.localhost'), 'habidat.localhost')
  })

  it('is omitted for localhost and bare two-label hosts', () => {
    assert.equal(cookieParentDomain('http://localhost:3000'), undefined)
    assert.equal(cookieParentDomain('https://example.org'), undefined)
  })

  it('is omitted for invalid URLs', () => {
    assert.equal(cookieParentDomain('not-a-url'), undefined)
  })
})
