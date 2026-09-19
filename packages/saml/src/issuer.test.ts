import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deflateRawSync } from 'node:zlib'
import { decodeSamlMessage, extractSamlIssuer, extractSamlIssuerFromXml } from './issuer'

const AUTH_XML = `<?xml version="1.0"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="a1" Version="2.0">
  <saml:Issuer>https://cloud.example.org/apps/user_saml/saml/metadata</saml:Issuer>
</samlp:AuthnRequest>`

describe('extractSamlIssuerFromXml', () => {
  it('reads a prefixed Issuer element', () => {
    assert.equal(
      extractSamlIssuerFromXml(AUTH_XML),
      'https://cloud.example.org/apps/user_saml/saml/metadata'
    )
  })

  it('reads an unprefixed Issuer', () => {
    const xml =
      '<LogoutRequest><Issuer Format="urn:oasis:names:tc:SAML:2.0:nameid-format:entity">https://wiki.example</Issuer></LogoutRequest>'
    assert.equal(extractSamlIssuerFromXml(xml), 'https://wiki.example')
  })
})

describe('extractSamlIssuer', () => {
  it('inflates an HTTP-Redirect SAMLRequest', () => {
    const encoded = deflateRawSync(Buffer.from(AUTH_XML, 'utf8')).toString('base64')
    assert.equal(
      extractSamlIssuer(encoded, 'redirect'),
      'https://cloud.example.org/apps/user_saml/saml/metadata'
    )
  })

  it('decodes an HTTP-POST SAMLRequest', () => {
    const encoded = Buffer.from(AUTH_XML, 'utf8').toString('base64')
    assert.equal(
      extractSamlIssuer(encoded, 'post'),
      'https://cloud.example.org/apps/user_saml/saml/metadata'
    )
  })

  it('returns null for garbage', () => {
    assert.equal(extractSamlIssuer('not-xml', 'post'), null)
  })
})

describe('decodeSamlMessage', () => {
  it('round-trips raw deflate', () => {
    const encoded = deflateRawSync(Buffer.from(AUTH_XML, 'utf8')).toString('base64')
    assert.match(decodeSamlMessage(encoded, 'redirect'), /AuthnRequest/)
  })
})
