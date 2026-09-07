import test from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './harness.mjs'

test('sanitizer preserves only a valid Replay ID for handled and global errors', async () => {
  const h = await harness()
  for (const operation of [undefined, 'location.create']) {
    for (const replayId of ['a'.repeat(32), 'private-token', null]) {
      const clean = h.reporting.sanitizeAdminSentryEvent({ tags: { operation, replayId, email: 'private@example.com' } })
      assert.equal(clean.tags?.replayId, replayId === 'a'.repeat(32) ? replayId : undefined)
      assert.equal(JSON.stringify(clean).includes('private'), false)
    }
  }
})

test('replay privacy fails closed for malformed or compressed recordings; errors pass through', async () => {
  const h = await harness()
  const { sanitizeAdminReplayEnvelope, createAdminReplayTransport } = await h.module('src/lib/admin-session-replay')
  for (const payload of ['invalid', '{"segment_id":0}\n{}', new Uint8Array([1, 2, 3])]) {
    assert.equal(sanitizeAdminReplayEnvelope([{}, [[{ type: 'replay_recording' }, payload]]]), null)
  }
  const envelope = [{}, [[{ type: 'event' }, { event_id: 'a'.repeat(32) }]]]
  assert.equal(sanitizeAdminReplayEnvelope(envelope), envelope)
  const sent = []
  const transport = createAdminReplayTransport({ send: async event => { sent.push(event) }, flush: async () => true })
  await transport.send([{}, [[{ type: 'replay_recording' }, 'invalid']]])
  assert.equal(sent.length, 0)
  await transport.send(envelope)
  assert.equal(sent.length, 1)
  assert.equal(await transport.flush(100), true)
})

test('recording filter removes URL tokens, CSS, arbitrary attributes and mutation text', async () => {
  const h = await harness()
  const { sanitizeAdminReplayEnvelope } = await h.module('src/lib/admin-session-replay')
  const frames = [
    { type: 1, name: 'html', publicId: 'secret', systemId: 'secret' },
    { type: 4, data: { href: 'https://private.test/?token=secret#password', width: 800, height: 600 } },
    { type: 2, data: { node: { type: 2, tagName: 'div', attributes: { 'data-email': 'secret', _cssText: 'url(secret)', class: 'secret' }, childNodes: [{ textContent: 'secret' }] } } },
    { type: 3, data: { source: 0, attributes: [{ id: 3, attributes: { 'data-token': 'secret' } }], texts: [{ id: 4, value: 'secret' }] } },
  ]
  const clean = sanitizeAdminReplayEnvelope([{ trace: { transaction: 'secret' } }, [
    [{ type: 'replay_event' }, { replay_id: 'a'.repeat(32), segment_id: 0, replay_type: 'buffer', user: { email: 'secret' }, urls: ['secret'] }],
    [{ type: 'replay_recording' }, '{"segment_id":0}\n' + JSON.stringify(frames)],
  ]])
  assert.ok(clean)
  assert.equal(JSON.stringify(clean).includes('secret'), false)
  const recording = JSON.parse(clean[1][1][1].split('\n')[1])
  assert.equal(recording[0].name, 'html', 'doctype must remain valid for playback')
  assert.ok(Array.isArray(recording[3].data.attributes), 'mutation arrays keep their rrweb shape')
  assert.equal(recording[2].data.node.tagName, 'div')
})
