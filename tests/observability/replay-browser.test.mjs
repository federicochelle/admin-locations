import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'

test('real SDK links handled/global errors to private Replay envelopes without tracing', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
  let browser
  try {
    await server.listen()
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined })
    for (const mode of ['handled', 'global']) {
      const page = await browser.newPage()
      // Nothing leaves this browser test; the real SDK uses an in-memory transport.
      await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
      await page.goto(`${server.resolvedUrls.local[0]}tests/observability/replay-fixture.html?token=private-url-token#private-hash`)
      await page.waitForFunction(() => window.fixtureReady === true)
      await page.waitForTimeout(1200)
      assert.equal(await page.evaluate(() => window.envelopes.some(([, items]) => items.some(([h]) => h.type === 'replay_event'))), false)
      await page.evaluate(() => {
        const node = document.getElementById('mutations')
        node.setAttribute('data-token', 'private-mutation-token')
        node.textContent = 'private-mutated-person'
        console.error('private-console-token')
      })
      if (mode === 'handled') await page.evaluate(() => window.triggerHandledError())
      else await page.evaluate(() => { setTimeout(() => { throw new Error('private-global-token') }, 0) })
      await page.waitForFunction(() => window.envelopes.some(([, items]) => items.some(([h]) => h.type === 'event')))
      await page.evaluate(() => window.flushReplay())
      await page.waitForFunction(() => window.envelopes.some(([, items]) => items.some(([h]) => h.type === 'replay_recording')))
      const envelopes = await page.evaluate(() => window.envelopes)
      const items = envelopes.flatMap(([, items]) => items)
      const error = items.find(([h]) => h.type === 'event')[1]
      const replay = items.find(([h]) => h.type === 'replay_event')[1]
      assert.match(error.tags.replayId, /^[a-f0-9]{32}$/)
      assert.equal(error.tags.replayId, replay.replay_id)
      assert.ok(replay.error_ids.includes(error.event_id))
      assert.equal(error.tags.operation, mode === 'handled' ? 'location.options' : undefined)
      assert.equal(items.some(([h]) => ['transaction', 'span'].includes(h.type)), false)
      const serialized = JSON.stringify(envelopes)
      for (const secret of ['private-', 'Private Person', 'Private Address', '59899123456', 'private@example.com']) assert.equal(serialized.includes(secret), false, `${mode}: ${secret}`)
      const recording = items.find(([h]) => h.type === 'replay_recording')
      assert.equal(recording[0].length, Buffer.byteLength(recording[1]))
      const frames = JSON.parse(recording[1].slice(recording[1].indexOf('\n') + 1))
      assert.ok(frames.some(frame => frame.type === 2), 'full DOM snapshot retained')
      assert.ok(frames.some(frame => frame.type === 3), 'incremental DOM snapshot retained')
      await page.close()
    }
  } finally {
    await browser?.close()
    await server.close()
  }
})
