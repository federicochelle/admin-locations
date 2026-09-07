import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryRouter } from 'react-router-dom'
import { harness, locationId } from './harness.mjs'

async function setup(t, overrides = {}, detectionFails = false) {
  const h = await harness({ detect: async () => {
    if (detectionFails) throw new Error('Detection failed')
    return { faces: [], summary: { faces: 0 } }
  } })
  const lib = await h.module('src/lib/unsaved-critical-state')
  const registry = lib.createUnsavedRegistry()
  const protection = lib.createFormProtection(registry)
  protection.update('initial', false)
  protection.update('edited', true)
  const router = createMemoryRouter([{ path: '*', element: null }], { initialEntries: ['/form'] })
  router.getBlocker('unsaved', () => registry.hasUnsavedCriticalState())
  t.after(() => router.dispose())
  const selection = await h.module('src/features/locations/location-image-selection')
  const image = await selection.preparePendingLocationImage(new File(['img'], 'test.jpg', { type: 'image/jpeg' }), {
    id: '1', originalIndex: 0, isCover: true, target: 'cover',
  })
  t.after(() => URL.revokeObjectURL(image.previewUrl))
  const form = await h.formHandlers({
    mode: 'edit', locationId, pendingImages: [image], protection,
    uploadLocationImage: async () => {},
    navigate: path => router.navigate(path),
    // React replaces image objects; the submit closure keeps the original objects.
    updatePendingImage: (id, changes) => {
      form.state.pending = form.state.pending.map(image => image.id === id ? { ...image, ...changes } : image)
    },
    ...overrides,
  })
  return { h, form, registry, protection, router }
}

function assertClosed(form) {
  assert.equal(form.state.submitting, false)
  assert.equal(form.state.progress, null)
}

for (const mode of ['create', 'edit']) {
  for (const fallback of [false, true]) test(`${mode}: ${fallback ? 'detection fallback' : 'normal images'} saves without guard and closes progress`, async t => {
    const { form, registry, router } = await setup(t, { mode }, fallback)
    await form.handleSubmit({ preventDefault() {} })
    assert.equal(form.state.submitError, null)
    assert.equal(registry.hasUnsavedCriticalState(), false)
    assert.equal(router.state.location.pathname, '/locations')
    assert.equal(router.state.blockers.get('unsaved')?.state, undefined)
    assertClosed(form)
  })
}

for (const failure of ['write', 'upload', 'refresh', 'processing']) test(`${failure} error closes progress and preserves manual navigation guard`, async t => {
  const overrides = {
    write: { updateLocation: async () => { throw new Error('Save failed') } },
    upload: { uploadLocationImage: async () => { throw new Error('Upload failed') } },
    refresh: { locationImages: { refresh: async () => {}, hasRefreshError: () => true } },
    processing: { pendingImages: [{ id: 'failed', status: 'error', width: 0, height: 0 }] },
  }[failure]
  const { form, registry, router } = await setup(t, overrides)
  await form.handleSubmit({ preventDefault() {} })
  assert.ok(form.state.submitError)
  assertClosed(form)
  assert.equal(registry.hasUnsavedCriticalState(), true)
  assert.equal(router.state.location.pathname, '/form')
  await router.navigate('/manual')
  assert.equal(router.state.blockers.get('unsaved').state, 'blocked')
  router.state.blockers.get('unsaved').reset() // “Seguir trabajando”
  assert.equal(router.state.location.pathname, '/form')
  assert.equal(router.state.blockers.get('unsaved').state, 'unblocked')
  assertClosed(form)
})

test('manual navigation during submit stays guarded; continue working permits completion', async t => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const { form, router } = await setup(t, { updateLocation: () => pending })
  const save = form.handleSubmit({ preventDefault() {} })
  await router.navigate('/manual')
  assert.equal(router.state.blockers.get('unsaved').state, 'blocked')
  router.state.blockers.get('unsaved').reset()
  release()
  await save
  assert.equal(router.state.location.pathname, '/locations')
  assertClosed(form)
})

for (const fails of [false, true]) test(`success callback ${fails ? 'throws' : 'returns without unmount'}: progress already closed`, async t => {
  const { form } = await setup(t, { onEditSuccess: async () => {
    assert.equal(form.state.progress, null)
    if (fails) throw new Error('Callback failed')
  } })
  await form.handleSubmit({ preventDefault() {} })
  assertClosed(form)
})

test('create upload failure stays usable; retry updates same location without duplicate creation', async t => {
  let creates = 0
  let updates = 0
  let uploads = 0
  const { form, h, router } = await setup(t, {
    mode: 'create',
    createLocation: async () => { creates++; return locationId },
    updateLocation: async () => { updates++ },
    uploadLocationImage: async () => { if (++uploads === 1) throw new Error('Upload failed') },
  })
  await form.handleSubmit({ preventDefault() {} })
  assertClosed(form)
  assert.equal(router.state.location.pathname, '/form')
  h.context.pendingImages = form.state.pending
  await form.handleSubmit({ preventDefault() {} })
  assertClosed(form)
  assert.equal(form.state.submitError, null)
  assert.equal(creates, 1)
  assert.equal(updates, 1)
  assert.equal(router.state.location.pathname, '/locations')
})

test('successfully retried error image clears guard despite stale submit snapshot', async t => {
  const { form, router } = await setup(t, {
    pendingImages: [{ id: 'retry', originalIndex: 0, status: 'error', width: 640, height: 480,
      file: new File(['img'], 'retry.jpg', { type: 'image/jpeg' }) }],
  })
  await form.handleSubmit({ preventDefault() {} })
  assert.equal(form.state.submitError, null)
  assert.equal(router.state.location.pathname, '/locations')
  assertClosed(form)
})
