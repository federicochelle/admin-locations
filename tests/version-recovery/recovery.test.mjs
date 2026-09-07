import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { harness } from '../observability/harness.mjs'

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: private-url')
async function setup(overrides = {}) {
  const h = await harness()
  const lib = await h.module('src/lib/version-recovery')
  const registryLib = await h.module('src/lib/unsaved-critical-state')
  const registry = registryLib.createUnsavedRegistry()
  const marks = new Map()
  const calls = []
  const deps = {
    currentRelease: 'aaaaaaaa', readVersion: async () => 'bbbbbbbb',
    storage: () => ({ getItem: key => marks.get(key) ?? null, setItem: (key, value) => marks.set(key, value) }),
    dirty: registry.hasUnsavedCriticalState,
    reload: () => calls.push('reload'),
    flush: async () => { assert.equal(marks.get(lib.RELOAD_MARKER), '1'); calls.push('flush') },
    report: (_error, context) => calls.push(context.stage), ...overrides,
  }
  return { ...h, lib, registryLib, registry, marks, calls, deps, recovery: lib.createVersionRecovery(deps) }
}

test('Vercel fallback keeps direct SPA paths and excludes missing assets/version metadata', async () => {
  const config = JSON.parse(await fs.readFile('vercel.json', 'utf8'))
  const rule = config.rewrites[0]
  const matches = new RegExp(`^${rule.source}$`)
  for (const route of ['/locations/new', '/locations/123/edit', '/categories/new', '/users', '/settings']) {
    assert.equal(matches.test(route), true, route)
    assert.equal(rule.destination, '/index.html')
  }
  for (const asset of ['/assets/no-existe.js', '/assets/no-existe.css', '/version.json']) assert.equal(matches.test(asset), false, asset)
  assert.ok(config.headers.find(rule => rule.source === '/version.json').headers.some(header => header.value === 'no-store'))
})

test('same release and ordinary API/Supabase/HEIC errors never reload', async () => {
  const h = await setup({ readVersion: async () => 'aaaaaaaa' })
  await h.recovery.check('chunk', chunkError())
  assert.equal(h.calls.includes('reload'), false)
  for (const error of [new Error('HEIC decode failed'), new Error('Failed to fetch'), { code: '23505', message: 'API error' }]) {
    assert.equal(h.lib.isChunkLoadError(error), false)
    await h.recovery.check('chunk', error)
  }
  assert.equal(h.calls.includes('reload'), false)
})

test('different release reloads once; marker precedes flush; next app instance reports failed_after_reload', async () => {
  const h = await setup()
  await h.recovery.check('chunk', chunkError())
  await h.recovery.check('chunk', chunkError())
  assert.equal(h.calls.filter(call => call === 'reload').length, 1)
  assert.ok(h.calls.indexOf('flush') < h.calls.indexOf('reload'))
  const next = h.lib.createVersionRecovery(h.deps)
  await next.check('chunk', chunkError())
  assert.equal(h.calls.filter(call => call === 'reload').length, 1)
  assert.equal(next.getSnapshot().kind, 'manual')
  assert.ok(h.calls.includes('failed_after_reload'))
})

test('dirty state blocks auto-reload and retains available version', async () => {
  const h = await setup()
  h.registry.set(Symbol(), true)
  await h.recovery.check('chunk', chunkError())
  assert.equal(h.calls.includes('reload'), false)
  assert.equal(h.recovery.getSnapshot().kind, 'available')
  assert.ok(h.calls.includes('blocked_dirty_state'))
})

for (const failAt of ['get', 'set']) test(`storage ${failAt} failure falls back to manual`, async () => {
  const h = await setup({ storage: () => ({ getItem() { if (failAt === 'get') throw new Error('denied'); return null }, setItem() { throw new Error('denied') } }) })
  await h.recovery.check('chunk', chunkError())
  assert.equal(h.calls.includes('reload'), false)
  assert.equal(h.recovery.getSnapshot().kind, 'manual')
})

test('Sentry report and flush failures cannot prevent recovery', async () => {
  const h = await setup({ report() { throw new Error('SDK') }, flush: async () => { throw new Error('SDK') } })
  await h.recovery.check('chunk', chunkError())
  assert.ok(h.calls.includes('reload'))
})

test('dirty state created during flush blocks reload', async () => {
  const h = await setup()
  h.deps.flush = async () => { h.registry.set(Symbol(), true) }
  await h.recovery.check('chunk', chunkError())
  assert.equal(h.calls.includes('reload'), false)
  assert.equal(h.recovery.getSnapshot().kind, 'available')
})

test('focus only announces; unavailable or invalid metadata never reloads', async () => {
  const h = await setup()
  await h.recovery.check('focus')
  assert.equal(h.calls.includes('reload'), false)
  assert.equal(h.recovery.getSnapshot().kind, 'available')
  for (const readVersion of [async () => { throw new Error('offline') }, async () => '<html>']) {
    const scenario = await setup({ readVersion })
    await scenario.recovery.check('chunk', chunkError())
    assert.equal(scenario.calls.includes('reload'), false)
    assert.equal(scenario.recovery.getSnapshot().kind, 'manual')
  }
})

test('registry isolates instances and cleanup; complete save clears while partial remains protected', async () => {
  const h = await setup()
  const a = h.registryLib.createFormProtection(h.registry)
  const b = h.registryLib.createFormProtection(h.registry)
  a.update('initial', false)
  b.update('initial', false)
  assert.equal(h.registry.hasUnsavedCriticalState(), false)
  a.update('edited', false)
  b.update('edited', false)
  a.unregister()
  assert.equal(h.registry.hasUnsavedCriticalState(), true)
  b.markIncomplete()
  b.update('initial', false)
  assert.equal(h.registry.hasUnsavedCriticalState(), true)
  b.markSaved()
  assert.equal(h.registry.hasUnsavedCriticalState(), false)
  b.update('new edit', false)
  assert.equal(h.registry.hasUnsavedCriticalState(), true)
  b.unregister()
  assert.equal(h.registry.hasUnsavedCriticalState(), false)
})

test('pending uploads protect unchanged values; saved baseline permits subsequent edits and uploads', async () => {
  const h = await setup()
  const form = h.registryLib.createFormProtection(h.registry)
  form.update('initial', false)
  form.update('initial', true)
  assert.equal(h.registry.hasUnsavedCriticalState(), true)
  form.markSaved()
  form.update('initial', false)
  assert.equal(h.registry.hasUnsavedCriticalState(), false)
  form.update('initial', true)
  assert.equal(h.registry.hasUnsavedCriticalState(), true)
})

test('real LocationForm full-save clears protection; partial image save does not', async () => {
  for (const fails of [false, true]) {
    const h = await setup()
    const protection = h.registryLib.createFormProtection(h.registry)
    protection.update('initial', false)
    const form = await h.formHandlers({ mode: 'edit', locationId: 'location', protection,
      pendingImages: [{ id: '1', originalIndex: 0, status: 'pending', file: new File(['img'], 'private.jpg', { type: 'image/jpeg' }) }],
      uploadLocationImage: async () => { if (fails) throw new Error('upload failed') },
    })
    await form.handleSubmit({ preventDefault() {} })
    assert.equal(h.registry.hasUnsavedCriticalState(), fails)
  }
})

test('recovery telemetry survives existing sanitizer without private details', async () => {
  const h = await setup()
  h.deps.report = h.reporting.reportAdminError
  await h.recovery.check('chunk', chunkError())
  assert.equal(h.events.length, 1)
  const clean = h.reporting.sanitizeAdminSentryEvent({ ...h.events[0].scope, message: h.events[0].message })
  assert.equal(clean.tags.module, 'app')
  assert.equal(clean.tags.operation, 'app.version_recovery')
  assert.equal(clean.contexts.admin_operation.current_release, 'aaaaaaaa')
  assert.equal(JSON.stringify(clean).includes('private-url'), false)
})
