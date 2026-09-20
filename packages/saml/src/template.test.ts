import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SamlLib } from 'samlify'
import type { SamlUser } from './config'
import {
  buildLoginResponseTemplate,
  createTemplateCallback,
  GROUPS_XML_PLACEHOLDER,
} from './template'

function fakeIdpSp() {
  let n = 0
  const idp = {
    entitySetting: {
      generateID: () => `id-${++n}`,
    },
    entityMeta: {
      getEntityID: () => 'https://idp.example/sso/metadata',
    },
  }
  const sp = {
    entityMeta: {
      getEntityID: () => 'https://cloud.example/apps/user_saml/saml/metadata',
      getAssertionConsumerService: () => 'https://cloud.example/apps/user_saml/saml/acs',
    },
  }
  return { idp, sp }
}

const user: SamlUser = {
  id: 'u1',
  email: 'a&b@example.com',
  username: 'alice<admin>',
  uid: 'alice',
  location: null,
  title: 'Member "core"',
  groups: ['staff', 'ops<script>'],
}

describe('SAML login response template', () => {
  it('keeps a sentinel for groups so samlify cannot escape AttributeValue markup', () => {
    assert.match(buildLoginResponseTemplate(), new RegExp(GROUPS_XML_PLACEHOLDER))
  })

  it('escapes user-controlled text once and keeps group values as XML elements', () => {
    const { idp, sp } = fakeIdpSp()
    const { context } = createTemplateCallback(
      idp as never,
      sp as never,
      user,
      'req-1'
    )(buildLoginResponseTemplate())

    assert.equal(context.includes(GROUPS_XML_PLACEHOLDER), false)
    assert.match(context, /<saml:AttributeValue xsi:type="xs:string">staff<\/saml:AttributeValue>/)
    assert.match(
      context,
      /<saml:AttributeValue xsi:type="xs:string">ops&lt;script&gt;<\/saml:AttributeValue>/
    )
    assert.match(context, />a&amp;b@example.com</)
    assert.match(context, />alice&lt;admin&gt;</)
    assert.match(context, /Name="displayName"/)
    assert.match(context, />Member &quot;core&quot;</)
    assert.equal(context.includes('&amp;amp;'), false)
    assert.equal(context.includes('&lt;script&gt;'), true)
    assert.equal(context.includes('<script>'), false)
  })

  it('sets AuthnInstant to the issue time, not the assertion expiry', () => {
    const { idp, sp } = fakeIdpSp()
    const { context } = createTemplateCallback(
      idp as never,
      sp as never,
      user,
      'req-1'
    )(buildLoginResponseTemplate())

    const issueInstant = context.match(/IssueInstant="([^"]+)"/)?.[1]
    const authnInstant = context.match(/AuthnInstant="([^"]+)"/)?.[1]
    assert.ok(issueInstant)
    assert.equal(authnInstant, issueInstant)
  })

  it('does not double-escape values that samlify already escapes', () => {
    const escaped = SamlLib.replaceTagsByValue('<x>{v}</x>', { v: 'a&b' })
    assert.equal(escaped, '<x>a&amp;b</x>')
  })
})
