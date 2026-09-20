import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  dnsChanged,
  escapeDnComponent,
  normalizeDn,
  rdnAttributeType,
  rdnAttributeValue,
  remapDns,
  uidUserDn,
} from './dn.js'

describe('rdn helpers', () => {
  it('reads the RDN type and value from a cn-named user', () => {
    const dn = 'cn=Florian Humer,ou=users,dc=example,dc=com'
    assert.equal(rdnAttributeType(dn), 'cn')
    assert.equal(rdnAttributeValue(dn), 'Florian Humer')
  })

  it('builds a uid RDN under the users OU', () => {
    assert.equal(
      uidUserDn('fhumer', 'ou=users,dc=example,dc=com'),
      'uid=fhumer,ou=users,dc=example,dc=com'
    )
  })

  it('escapes special characters in a uid RDN', () => {
    assert.equal(
      uidUserDn('foo+bar', 'ou=users,dc=example,dc=com'),
      'uid=foo\\+bar,ou=users,dc=example,dc=com'
    )
  })

  it('rewrites member DNs from the rename map and leaves unknown DNs', () => {
    const map = new Map([
      [
        normalizeDn('cn=Florian Humer,ou=users,dc=example,dc=com'),
        'uid=fhumer,ou=users,dc=example,dc=com',
      ],
    ])
    const next = remapDns(
      ['cn=Florian Humer,ou=users,dc=example,dc=com', 'cn=admin,ou=groups,dc=example,dc=com'],
      map
    )
    assert.deepEqual(next, [
      'uid=fhumer,ou=users,dc=example,dc=com',
      'cn=admin,ou=groups,dc=example,dc=com',
    ])
    assert.equal(
      dnsChanged(['cn=Florian Humer,ou=users,dc=example,dc=com'], next.slice(0, 1)),
      true
    )
    assert.equal(dnsChanged(next, next), false)
  })
})

describe('escapeDnComponent', () => {
  it('leaves a plain name unchanged', () => {
    assert.equal(escapeDnComponent('fhumer'), 'fhumer')
  })
})
