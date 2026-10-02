import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseNodeHttpMessage } from './http'

describe('parseNodeHttpMessage', () => {
  it('decodes a chunked body instead of returning the chunk size', () => {
    const raw = Buffer.from(
      'HTTP/1.1 500 Internal Server Error\r\ntransfer-encoding: chunked\r\n\r\n11\r\nInteraction error\r\n0\r\n\r\n',
      'utf8'
    )
    const parsed = parseNodeHttpMessage(raw)
    assert.equal(parsed.status, 500)
    assert.equal(parsed.body.toString('utf8'), 'Interaction error')
    assert.equal(parsed.headers.has('transfer-encoding'), false)
  })
})
