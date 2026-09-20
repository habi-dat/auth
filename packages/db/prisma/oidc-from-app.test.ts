import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  oidcFieldsFromApp,
  oidcHasClient,
  oidcIsUnconfigured,
} from './oidc-from-app'

describe('oidcFieldsFromApp', () => {
  it('returns empty fields when oidc is missing', () => {
    assert.deepEqual(oidcFieldsFromApp({}), {
      oidcEnabled: false,
      oidcClientId: null,
      oidcRedirectUris: null,
      oidcClientSecret: null,
    })
  })

  it('maps the appStore oidc block used by habidat-setup', () => {
    const fields = oidcFieldsFromApp({
      oidc: {
        enabled: true,
        clientId: 'haus1.lists',
        clientSecret: 's3cret',
        redirectUris: ['https://haus1.lists.example.org/auth/oidc'],
      },
    })
    assert.equal(fields.oidcEnabled, true)
    assert.equal(fields.oidcClientId, 'haus1.lists')
    assert.equal(fields.oidcClientSecret, 's3cret')
    assert.equal(
      fields.oidcRedirectUris,
      JSON.stringify(['https://haus1.lists.example.org/auth/oidc'])
    )
    assert.equal(oidcHasClient(fields), true)
  })

  it('accepts Prisma-shaped aliases', () => {
    const fields = oidcFieldsFromApp({
      oidc: {
        oidcEnabled: true,
        oidcClientId: 'wiki',
        oidcRedirectUris: '["https://wiki.example/callback"]',
        oidcClientSecret: 'x',
      },
    })
    assert.equal(fields.oidcEnabled, true)
    assert.equal(fields.oidcClientId, 'wiki')
    assert.equal(fields.oidcRedirectUris, JSON.stringify(['https://wiki.example/callback']))
  })
})

describe('oidcIsUnconfigured', () => {
  it('is true when OIDC was never filled', () => {
    assert.equal(oidcIsUnconfigured({ oidcEnabled: false, oidcClientId: null }), true)
    assert.equal(oidcIsUnconfigured({ oidcEnabled: false, oidcClientId: '' }), true)
  })

  it('is false when a client is already stored', () => {
    assert.equal(oidcIsUnconfigured({ oidcEnabled: true, oidcClientId: 'x' }), false)
    assert.equal(oidcIsUnconfigured({ oidcEnabled: false, oidcClientId: 'x' }), false)
  })
})
