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

function pendingImage() {
  return {
    id: 'pending-image',
    originalIndex: 0,
    status: 'pending',
    width: 640,
    height: 480,
    file: new File(['img'], 'pending.jpg', { type: 'image/jpeg' }),
    isCover: true,
    previewUrl: 'blob:pending-image',
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, reject, resolve }
}

const partialCreatePayload = {
  title: 'Locación parcial',
  slug: 'locacion-parcial',
  owner_id: 'existing-owner',
  selectedFeatureIds: ['feature-1'],
  selectedTagIds: ['tag-1'],
}

function partialCreationDatabase({ failTable = null } = {}) {
  const state = {
    featureRows: [],
    locationInserts: 0,
    locations: [],
    relationFailurePending: Boolean(failTable),
    tagRows: [],
  }

  return {
    state,
    query(call) {
      if (call.table === 'locations' && call.method === 'select') {
        return { data: [], error: null }
      }

      if (call.table === 'locations' && call.method === 'insert') {
        state.locationInserts += 1
        state.locations.push({ id: locationId, ...call.payload })
        return { data: { id: locationId, location_code: 'CODE-001' }, error: null }
      }

      if (call.method === 'delete') {
        return { data: null, error: null }
      }

      if (call.method === 'insert' && call.table === failTable && state.relationFailurePending) {
        state.relationFailurePending = false
        return { data: null, error: { code: '23503', message: `${failTable} failed` } }
      }

      if (call.method === 'insert' && call.table === 'location_features') {
        state.featureRows.push(...call.payload)
        return { data: null, error: null }
      }

      if (call.method === 'insert' && call.table === 'location_tags') {
        state.tagRows.push(...call.payload)
        return { data: null, error: null }
      }

      throw new Error(`Unexpected query: ${call.table}.${call.method}`)
    },
  }
}

async function setupPartialCreateRetry({ failTable, selectedFeatureIds = ['feature-1'], withImage = false } = {}) {
  const database = partialCreationDatabase({ failTable })
  const h = await harness({ query: database.query })
  const service = await h.module('src/features/locations/locations.service')
  let createCalls = 0
  const updateIds = []
  let uploads = 0
  const payload = { ...partialCreatePayload, selectedFeatureIds }
  const form = await h.formHandlers({
    buildPayload: () => payload,
    createLocation: (nextPayload, options) => {
      createCalls += 1
      return service.createLocation(nextPayload, options)
    },
    pendingImages: withImage ? [pendingImage()] : [],
    updateLocation: async id => {
      updateIds.push(id)
      return id
    },
    uploadLocationImage: async () => {
      uploads += 1
    },
  })

  return { createCalls: () => createCalls, database, form, h, updateIds, uploads: () => uploads }
}

for (const testCase of [
  { label: 'features falla', failTable: 'location_features', withImage: true },
  { label: 'tags falla después de features', failTable: 'location_tags' },
  { label: 'tags falla sin features', failTable: 'location_tags', selectedFeatureIds: [] },
]) {
  test(`creación parcial: ${testCase.label} conserva el ID y el retry actualiza la misma locación`, async () => {
    const scenario = await setupPartialCreateRetry(testCase)

    await scenario.form.handleSubmit({ preventDefault() {} })

    assert.equal(scenario.database.state.locationInserts, 1)
    assert.equal(scenario.createCalls(), 1)
    assert.equal(scenario.h.context.createdLocationIdRef.current, locationId)
    assert.equal(scenario.updateIds.length, 0)
    assert.equal(scenario.uploads(), 0)
    assert.ok(scenario.form.state.submitError)

    await scenario.form.handleSubmit({ preventDefault() {} })

    assert.equal(scenario.database.state.locationInserts, 1)
    assert.equal(scenario.database.state.locations.length, 1)
    assert.equal(scenario.createCalls(), 1)
    assert.deepEqual(scenario.updateIds, [locationId])
    assert.equal(scenario.h.context.createdLocationIdRef.current, locationId)
    assert.equal(scenario.uploads(), testCase.withImage ? 1 : 0)
    assert.equal(scenario.form.state.submitError, null)
  })
}

test('createLocation comunica el ID confirmado aunque una relación posterior falle', async () => {
  const database = partialCreationDatabase({ failTable: 'location_features' })
  const h = await harness({ query: database.query })
  const service = await h.module('src/features/locations/locations.service')
  let confirmedLocationId = null

  await assert.rejects(
    service.createLocation(partialCreatePayload, {
      onLocationCreated: id => {
        confirmedLocationId = id
      },
    }),
  )

  assert.equal(confirmedLocationId, locationId)
  assert.equal(database.state.locationInserts, 1)
})

test('creación parcial con owner inline no vuelve a crear el owner durante el retry', async () => {
  const database = partialCreationDatabase({ failTable: 'location_features' })
  const h = await harness({ query: database.query })
  const service = await h.module('src/features/locations/locations.service')
  const ownerId = '33333333-3333-4333-8333-333333333333'
  let ownerCreates = 0
  const updateIds = []
  const form = await h.formHandlers({
    values: { owner_id: '' },
    ownerInputValue: 'Dueño nuevo',
    ownerPhoneValue: '099123456',
    normalizeInlineOwnerValue: value => value.trim(),
    buildPayload: values => ({ ...partialCreatePayload, owner_id: values.owner_id }),
    createOwner: async () => {
      ownerCreates += 1
      return ownerId
    },
    buildInlineOwnerCreatePayload: values => values,
    createLocation: service.createLocation,
    setValues: updater => {
      h.context.values = updater(h.context.values)
    },
    setOwnerSearchTerm() {},
    setOwnerPhoneInput() {},
    updateLocation: async id => {
      updateIds.push(id)
      return id
    },
  })

  await form.handleSubmit({ preventDefault() {} })
  await form.handleSubmit({ preventDefault() {} })

  assert.equal(ownerCreates, 1)
  assert.equal(database.state.locationInserts, 1)
  assert.deepEqual(updateIds, [locationId])
  assert.equal(h.context.values.owner_id, ownerId)
})

test('creación exitosa comunica el ID y conserva el flujo normal', async () => {
  const database = partialCreationDatabase()
  const h = await harness({ query: database.query })
  const service = await h.module('src/features/locations/locations.service')
  let updates = 0
  const form = await h.formHandlers({
    buildPayload: () => partialCreatePayload,
    createLocation: service.createLocation,
    updateLocation: async () => {
      updates += 1
      return locationId
    },
  })

  await form.handleSubmit({ preventDefault() {} })

  assert.equal(database.state.locationInserts, 1)
  assert.equal(database.state.featureRows.length, 1)
  assert.equal(database.state.tagRows.length, 1)
  assert.equal(h.context.createdLocationIdRef.current, locationId)
  assert.equal(updates, 0)
  assert.equal(form.state.submitError, null)
  assert.deepEqual(form.state.navigation, ['/locations'])
})

for (const testCase of [
  { label: 'create sin imágenes', mode: 'create', withImages: false },
  { label: 'create con imágenes', mode: 'create', withImages: true },
  { label: 'edit sin imágenes', mode: 'edit', withImages: false },
  { label: 'edit con imágenes', mode: 'edit', withImages: true },
]) {
  test(`double submit: ${testCase.label} ejecuta un solo flujo`, async () => {
    const h = await harness()
    const network = deferred()
    let creates = 0
    let updates = 0
    let uploads = 0
    const form = await h.formHandlers({
      mode: testCase.mode,
      locationId: testCase.mode === 'edit' ? locationId : undefined,
      pendingImages: testCase.withImages ? [pendingImage()] : [],
      createLocation: async () => {
        creates += 1
        await network.promise
        return locationId
      },
      updateLocation: async () => {
        updates += 1
        await network.promise
      },
      uploadLocationImage: async () => {
        uploads += 1
      },
    })

    const firstSubmit = form.handleSubmit({ preventDefault() {} })
    const secondSubmit = form.handleSubmit({ preventDefault() {} })

    assert.equal(creates, testCase.mode === 'create' ? 1 : 0)
    assert.equal(updates, testCase.mode === 'edit' ? 1 : 0)
    assert.equal(uploads, 0)

    network.resolve()
    await Promise.all([firstSubmit, secondSubmit])

    assert.equal(creates, testCase.mode === 'create' ? 1 : 0)
    assert.equal(updates, testCase.mode === 'edit' ? 1 : 0)
    assert.equal(uploads, testCase.withImages ? 1 : 0)
    assertClosed(form)
  })
}

test('double submit: el segundo retorna mientras el primero espera red', async () => {
  const h = await harness()
  const network = deferred()
  let creates = 0
  const form = await h.formHandlers({
    createLocation: async () => {
      creates += 1
      await network.promise
      return locationId
    },
  })

  const firstSubmit = form.handleSubmit({ preventDefault() {} })
  const secondSubmit = form.handleSubmit({ preventDefault() {} })
  const secondResult = await Promise.race([
    secondSubmit.then(() => 'returned'),
    new Promise((resolve) => setTimeout(() => resolve('waiting'), 25)),
  ])

  assert.equal(secondResult, 'returned')
  assert.equal(creates, 1)
  network.resolve()
  await firstSubmit
})

test('submit lock se libera después de un fallo de red', async () => {
  const h = await harness()
  let creates = 0
  const form = await h.formHandlers({
    createLocation: async () => {
      creates += 1
      if (creates === 1) throw new Error('Network failed')
      return locationId
    },
  })

  await form.handleSubmit({ preventDefault() {} })
  await form.handleSubmit({ preventDefault() {} })

  assert.equal(creates, 2)
  assert.equal(form.state.submitError, null)
  assertClosed(form)
})

test('submit lock se libera después de un fallo de upload', async () => {
  const h = await harness()
  let creates = 0
  let updates = 0
  let uploads = 0
  const form = await h.formHandlers({
    mode: 'create',
    pendingImages: [pendingImage()],
    createLocation: async () => {
      creates += 1
      return locationId
    },
    updateLocation: async () => {
      updates += 1
    },
    uploadLocationImage: async () => {
      uploads += 1
      if (uploads === 1) throw new Error('Upload failed')
    },
  })

  await form.handleSubmit({ preventDefault() {} })
  await form.handleSubmit({ preventDefault() {} })

  assert.equal(creates, 1)
  assert.equal(updates, 1)
  assert.equal(uploads, 2)
  assert.equal(form.state.submitError, null)
  assertClosed(form)
})

test('submit lock se libera después de una validación fallida', async () => {
  const h = await harness()
  let validations = 0
  let creates = 0
  const form = await h.formHandlers({
    validateRequiredFields: () => {
      validations += 1
      return validations === 1 ? { title: 'Required' } : {}
    },
    createLocation: async () => {
      creates += 1
      return locationId
    },
  })

  await form.handleSubmit({ preventDefault() {} })
  await form.handleSubmit({ preventDefault() {} })

  assert.equal(validations, 2)
  assert.equal(creates, 1)
  assert.equal(form.state.submitError, null)
  assertClosed(form)
})

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
