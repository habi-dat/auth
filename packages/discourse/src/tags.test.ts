import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mergeWatchedTags } from './types'

describe('mergeWatchedTags', () => {
  it('adds a tag without duplicating it', () => {
    assert.deepEqual(mergeWatchedTags(['alpha', 'beta'], 'gamma', true), ['alpha', 'beta', 'gamma'])
    assert.deepEqual(mergeWatchedTags(['alpha', 'beta'], 'beta', true), ['alpha', 'beta'])
  })

  it('removes a tag and leaves the rest', () => {
    assert.deepEqual(mergeWatchedTags(['alpha', 'beta', 'gamma'], 'beta', false), [
      'alpha',
      'gamma',
    ])
    assert.deepEqual(mergeWatchedTags(['alpha'], 'missing', false), ['alpha'])
  })
})
