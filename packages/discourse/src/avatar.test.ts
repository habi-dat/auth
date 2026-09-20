import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  absoluteAppAssetUrl,
  applySsoAvatarFields,
  avatarUrlForDiscourse,
  isCustomDiscourseAvatar,
  resolveDiscourseAvatarDownloadUrl,
} from './avatar'

describe('isCustomDiscourseAvatar', () => {
  it('accepts a Discourse user_avatar upload', () => {
    assert.equal(
      isCustomDiscourseAvatar({
        uploadedAvatarId: 210,
        avatarTemplate: '/user_avatar/forum.example.org/sam/{size}/210_2.png',
      }),
      true
    )
  })

  it('rejects letter avatars even if an id is present', () => {
    assert.equal(
      isCustomDiscourseAvatar({
        uploadedAvatarId: 1,
        avatarTemplate: '/letter_avatar_proxy/v4/letter/s/e9b14f/{size}.png',
      }),
      false
    )
  })

  it('rejects Gravatar hosts', () => {
    assert.equal(
      isCustomDiscourseAvatar({
        uploadedAvatarId: 99,
        avatarTemplate: 'https://secure.gravatar.com/avatar/abc?s={size}',
      }),
      false
    )
  })

  it('rejects missing uploaded_avatar_id', () => {
    assert.equal(
      isCustomDiscourseAvatar({
        uploadedAvatarId: null,
        avatarTemplate: '/user_avatar/forum.example.org/sam/{size}/210_2.png',
      }),
      false
    )
  })
})

describe('resolveDiscourseAvatarDownloadUrl', () => {
  it('fills {size} and prefixes the Discourse origin', () => {
    assert.equal(
      resolveDiscourseAvatarDownloadUrl(
        'https://forum.example.org',
        '/user_avatar/forum.example.org/sam/{size}/210_2.png'
      ),
      'https://forum.example.org/user_avatar/forum.example.org/sam/512/210_2.png'
    )
  })

  it('keeps an already-absolute template', () => {
    assert.equal(
      resolveDiscourseAvatarDownloadUrl(
        'https://forum.example.org',
        'https://cdn.example.org/user_avatar/x/{size}/1.png'
      ),
      'https://cdn.example.org/user_avatar/x/512/1.png'
    )
  })
})

describe('SSO avatar fields', () => {
  it('adds avatar_url and force update when a picture exists', () => {
    const params = new URLSearchParams()
    applySsoAvatarFields(params, {
      avatarUrl: 'https://user.example.org/uploads/avatars/abc.jpg',
      avatarForceUpdate: true,
    })
    assert.equal(params.get('avatar_url'), 'https://user.example.org/uploads/avatars/abc.jpg')
    assert.equal(params.get('avatar_force_update'), 'true')
  })

  it('sends force update without avatar_url on remove', () => {
    const params = new URLSearchParams()
    applySsoAvatarFields(params, { avatarForceUpdate: true })
    assert.equal(params.get('avatar_url'), null)
    assert.equal(params.get('avatar_force_update'), 'true')
  })

  it('builds an absolute app asset URL', () => {
    assert.equal(
      absoluteAppAssetUrl('https://user.example.org/', '/uploads/avatars/abc.jpg'),
      'https://user.example.org/uploads/avatars/abc.jpg'
    )
  })

  it('prefers the Discourse fetch base over APP_URL', () => {
    assert.equal(
      avatarUrlForDiscourse('/uploads/avatars/abc.jpg', {
        appUrl: 'https://user.example.org',
        fetchBaseUrl: 'http://habidat-user-avatars',
      }),
      'http://habidat-user-avatars/uploads/avatars/abc.jpg'
    )
  })
})
