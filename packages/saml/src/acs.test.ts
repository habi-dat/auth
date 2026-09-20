import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { absoluteHttpUrl, resolveAssertionConsumerServiceUrl } from './acs'

describe('absoluteHttpUrl', () => {
  it('accepts http(s) URLs', () => {
    assert.equal(absoluteHttpUrl('https://pariti.example/acs'), 'https://pariti.example/acs')
    assert.equal(absoluteHttpUrl(' http://localhost:3000/x '), 'http://localhost:3000/x')
  })

  it('rejects relative and empty values', () => {
    assert.equal(absoluteHttpUrl('/'), null)
    assert.equal(absoluteHttpUrl('/api/auth/sso/saml2/sp/acs/habidat'), null)
    assert.equal(absoluteHttpUrl(''), null)
    assert.equal(absoluteHttpUrl(undefined), null)
  })
})

describe('resolveAssertionConsumerServiceUrl', () => {
  const pariti = 'https://pariti.habidat.org'
  const storedHome = `${pariti}/`
  const requestAcs = `${pariti}/api/auth/sso/saml2/sp/acs/habidat`

  it('prefers a same-origin AuthnRequest ACS over a stale stored ACS', () => {
    assert.equal(
      resolveAssertionConsumerServiceUrl({
        configuredAcsUrl: storedHome,
        appUrl: pariti,
        requestedAcsUrl: requestAcs,
      }),
      requestAcs
    )
  })

  it('uses the request ACS when none is stored and it matches the app origin', () => {
    assert.equal(
      resolveAssertionConsumerServiceUrl({
        configuredAcsUrl: null,
        appUrl: pariti,
        requestedAcsUrl: requestAcs,
      }),
      requestAcs
    )
  })

  it('keeps the stored ACS when the request ACS is relative', () => {
    assert.equal(
      resolveAssertionConsumerServiceUrl({
        configuredAcsUrl: `${pariti}/api/auth/sso/saml2/callback/habidat`,
        appUrl: pariti,
        requestedAcsUrl: '/',
      }),
      `${pariti}/api/auth/sso/saml2/callback/habidat`
    )
  })

  it('does not follow a request ACS on another origin', () => {
    assert.equal(
      resolveAssertionConsumerServiceUrl({
        configuredAcsUrl: `${pariti}/acs`,
        appUrl: pariti,
        requestedAcsUrl: 'https://evil.example/acs',
      }),
      `${pariti}/acs`
    )
  })
})
