import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  echoOwnPostsFromFrequency,
  frequencyForEchoOwnPosts,
  MAILING_LIST_FREQUENCY,
  mergeTagSubscription,
  parseUserMailProfile,
  tagNames,
} from './types'

describe('mailing list frequency', () => {
  it('writes individual / individual_excluding_own, never the daily digest', () => {
    assert.equal(frequencyForEchoOwnPosts(true), MAILING_LIST_FREQUENCY.individual)
    assert.equal(frequencyForEchoOwnPosts(false), MAILING_LIST_FREQUENCY.individualExcludingOwn)
  })

  it('defaults to "own posts included"; only individual_excluding_own turns it off', () => {
    assert.equal(echoOwnPostsFromFrequency(undefined), true)
    assert.equal(echoOwnPostsFromFrequency(MAILING_LIST_FREQUENCY.daily), true)
    assert.equal(echoOwnPostsFromFrequency(MAILING_LIST_FREQUENCY.individual), true)
    assert.equal(echoOwnPostsFromFrequency(MAILING_LIST_FREQUENCY.individualExcludingOwn), false)
  })

  it('round-trips', () => {
    for (const echo of [true, false]) {
      assert.equal(echoOwnPostsFromFrequency(frequencyForEchoOwnPosts(echo)), echo)
    }
  })
})

describe('mergeTagSubscription', () => {
  it('subscribing watches the tag and unmutes it', () => {
    assert.deepEqual(mergeTagSubscription({ watched: ['a'], muted: ['b', 'c'] }, 'b', true), {
      watched: ['a', 'b'],
      muted: ['c'],
    })
  })

  it('unsubscribing mutes the tag and unwatches it', () => {
    assert.deepEqual(mergeTagSubscription({ watched: ['a', 'b'], muted: [] }, 'b', false), {
      watched: ['a'],
      muted: ['b'],
    })
  })

  it('mutes a tag that was in neither list', () => {
    assert.deepEqual(mergeTagSubscription({ watched: [], muted: ['x'] }, 'new', false), {
      watched: [],
      muted: ['x', 'new'],
    })
  })
})

describe('tagNames', () => {
  it('accepts plain names and { name } objects', () => {
    assert.deepEqual(tagNames(['a', { name: 'b' }]), ['a', 'b'])
    assert.deepEqual(tagNames(undefined), [])
  })
})

describe('parseUserMailProfile', () => {
  it('maps mailing list mode, watched/muted tags and non-automatic groups', () => {
    const profile = parseUserMailProfile({
      user_option: { mailing_list_mode: true, mailing_list_mode_frequency: 2 },
      watched_tags: [{ name: 'news' }],
      muted_tags: ['spam'],
      groups: [
        { id: 1, name: 'kassa', display_name: 'Kassa' },
        { id: 2, name: 'trust_level_0', display_name: '', automatic: true },
        { id: 3, name: 'plenum', display_name: 'Plenum' },
      ],
      group_users: [{ group_id: 1, notification_level: 3 }],
    })

    assert.equal(profile.mailingListMode, true)
    assert.equal(profile.echoOwnPosts, false)
    assert.deepEqual(profile.tagNotifications, [
      { tag_name: 'news', notification_level: 3 },
      { tag_name: 'spam', notification_level: 0 },
    ])
    assert.deepEqual(
      profile.groups.map((g) => [g.name, g.notification_level]),
      [
        ['kassa', 3],
        ['plenum', 1],
      ]
    )
  })

  it('uses Discourse defaults for an empty user', () => {
    assert.deepEqual(parseUserMailProfile(undefined), {
      mailingListMode: false,
      echoOwnPosts: true,
      tagNotifications: [],
      groups: [],
    })
  })
})
