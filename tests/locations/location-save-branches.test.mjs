import assert from 'node:assert/strict'
import test from 'node:test'
import { harness, locationId } from '../observability/harness.mjs'

const existingCreatedLocationId = '33333333-3333-4333-8333-333333333333'

function pendingImage(id, overrides = {}) {
  return {
    id,
    originalIndex: 0,
    status: 'pending',
    width: 640,
    height: 480,
    file: new File(['img'], `${id}.jpg`, { type: 'image/jpeg' }),
    isCover: false,
    previewUrl: `blob:${id}`,
    errorMessage: null,
    ...overrides,
  }
}

function savePayload() {
  return {
    title: 'Locacion',
    slug: 'locacion',
    owner_id: 'owner-1',
    selectedFeatureIds: [],
    selectedTagIds: [],
  }
}

async function setupSaveBranchHarness(overrides = {}) {
  const h = await harness()
  const events = []
  const savedMarks = []
  const revokedPreviewUrls = []
  const form = await h.formHandlers({
    buildPayload: () => savePayload(),
    locationId: overrides.mode === 'edit' ? locationId : undefined,
    mode: overrides.mode ?? 'create',
    pendingDeletedPersistedImageIds: overrides.pendingDeletedPersistedImageIds ?? [],
    pendingImages: overrides.pendingImages ?? [],
    visiblePersistedImages: overrides.visiblePersistedImages ?? [],
    createLocation: async (_payload, options) => {
      events.push('createLocation')
      options?.onLocationCreated?.(locationId)
      return locationId
    },
    deleteLocationImage: async () => {
      events.push('delete')
    },
    locationImages: {
      refresh: async () => {
        events.push('sync')
      },
      hasRefreshError: () => false,
    },
    markSaveProgressSuccess: () => {
      events.push('success')
    },
    navigate: (path) => {
      events.push('navigate')
      form.state.navigation.push(path)
    },
    onCreateSuccess: overrides.onCreateSuccess,
    onEditSuccess: overrides.onEditSuccess,
    protection: {
      markIncomplete() {
        events.push('markIncomplete')
      },
      markSaved() {
        events.push('markSaved')
        savedMarks.push('markSaved')
      },
    },
    revokePreviewUrl: (previewUrl) => {
      events.push(`revoke:${previewUrl}`)
      revokedPreviewUrls.push(previewUrl)
    },
    setPendingDeletedPersistedImageIds: (ids) => {
      events.push('clearDeleted')
      h.context.pendingDeletedPersistedImageIds =
        typeof ids === 'function'
          ? ids(h.context.pendingDeletedPersistedImageIds)
          : ids
    },
    setSaveProgress: (value) => {
      form.state.progress = value
    },
    updateStageStatus: (stage, status) => {
      if (stage === 'syncGallery') {
        events.push(`syncStage:${status}`)
      }
    },
    updateLocation: async (id) => {
      events.push(`updateLocation:${id}`)
      return id
    },
    uploadLocationImage: async (input) => {
      events.push(`upload:${input.locationId}:${input.file.name}`)

      if (overrides.failUpload) {
        throw new Error('Upload failed')
      }
    },
    ...overrides.formOverrides,
  })

  if (overrides.createdLocationIdRefCurrent) {
    h.context.createdLocationIdRef.current = overrides.createdLocationIdRefCurrent
  }

  return {
    events,
    form,
    h,
    revokedPreviewUrls,
    savedMarks,
  }
}

test('edit save runs update, delete, upload, sync, cleanup and success in order', async () => {
  const doneImage = pendingImage('done-image', { status: 'pending', previewUrl: 'blob:done' })
  const { events, form, revokedPreviewUrls, savedMarks } = await setupSaveBranchHarness({
    mode: 'edit',
    pendingDeletedPersistedImageIds: ['persisted-image'],
    pendingImages: [doneImage],
  })

  await form.handleSubmit({ preventDefault() {} })

  assert.deepEqual(events, [
    'markIncomplete',
    `updateLocation:${locationId}`,
    'delete',
    'clearDeleted',
    `upload:${locationId}:done-image.jpg`,
    'syncStage:active',
    'sync',
    'syncStage:done',
    'revoke:blob:done',
    'markSaved',
    'success',
    'navigate',
  ])
  assert.deepEqual(savedMarks, ['markSaved'])
  assert.deepEqual(revokedPreviewUrls, ['blob:done'])
  assert.deepEqual(form.state.pending, [])
  assert.deepEqual(form.state.navigation, ['/locations'])
})

test('new create save runs create, delete, upload, cleanup, sync and success in order', async () => {
  const doneImage = pendingImage('done-image', { status: 'pending', previewUrl: 'blob:done' })
  const { events, form, h, revokedPreviewUrls, savedMarks } = await setupSaveBranchHarness({
    mode: 'create',
    pendingDeletedPersistedImageIds: ['unexpected-persisted-image'],
    pendingImages: [doneImage],
  })

  await form.handleSubmit({ preventDefault() {} })

  assert.deepEqual(events, [
    'markIncomplete',
    'createLocation',
    'delete',
    'clearDeleted',
    `upload:${locationId}:done-image.jpg`,
    'revoke:blob:done',
    'syncStage:skipped',
    'markSaved',
    'success',
    'navigate',
  ])
  assert.equal(h.context.createdLocationIdRef.current, locationId)
  assert.deepEqual(savedMarks, ['markSaved'])
  assert.deepEqual(revokedPreviewUrls, ['blob:done'])
  assert.deepEqual(form.state.pending, [])
  assert.deepEqual(form.state.navigation, ['/locations'])
})

test('create retry reuses the existing partial location id without creating again', async () => {
  const { events, form, h } = await setupSaveBranchHarness({
    createdLocationIdRefCurrent: existingCreatedLocationId,
    mode: 'create',
    pendingImages: [pendingImage('retry-image')],
    formOverrides: {
      createLocation: async () => {
        events.push('unexpectedCreateLocation')
        return locationId
      },
    },
  })

  await form.handleSubmit({ preventDefault() {} })

  assert.equal(events.includes('unexpectedCreateLocation'), false)
  assert.equal(events.includes(`updateLocation:${existingCreatedLocationId}`), true)
  assert.equal(events.includes(`upload:${existingCreatedLocationId}:retry-image.jpg`), true)
  assert.equal(h.context.createdLocationIdRef.current, existingCreatedLocationId)
})

test('partial upload does not mark saved, does not navigate and keeps errored pending image', async () => {
  const { events, form, savedMarks } = await setupSaveBranchHarness({
    failUpload: true,
    mode: 'create',
    pendingImages: [pendingImage('failed-image')],
  })

  await form.handleSubmit({ preventDefault() {} })

  assert.deepEqual(savedMarks, [])
  assert.equal(events.includes('markSaved'), false)
  assert.equal(events.includes('navigate'), false)
  assert.deepEqual(form.state.navigation, [])
  assert.equal(form.state.pending.length, 1)
  assert.equal(form.state.pending[0].status, 'error')
  assert.equal(form.state.pending[0].errorMessage, 'Upload failed')
  assert.equal(
    form.state.submitError,
    'La locacion fue creada, pero algunas imagenes no se pudieron subir. Revisalas y volve a intentar.',
  )
})

test('cleanup revokes and removes only done pending images while preserving errored images', async () => {
  const doneImage = pendingImage('done-image', { status: 'pending', previewUrl: 'blob:done' })
  const erroredImage = pendingImage('errored-image', {
    errorMessage: 'Previous upload failed',
    previewUrl: 'blob:error',
    status: 'error',
  })
  const { form, revokedPreviewUrls } = await setupSaveBranchHarness({
    mode: 'create',
    pendingImages: [doneImage, erroredImage],
    formOverrides: {
      uploadLocationImage: async (input) => {
        if (input.file.name === 'errored-image.jpg') {
          throw new Error('Upload failed')
        }
      },
    },
  })

  await form.handleSubmit({ preventDefault() {} })

  assert.deepEqual(revokedPreviewUrls, ['blob:done'])
  assert.equal(form.state.pending.length, 1)
  assert.equal(form.state.pending[0].id, 'errored-image')
  assert.equal(form.state.pending[0].status, 'error')
})

test('success callbacks prevent navigation for create and edit saves', async () => {
  for (const mode of ['create', 'edit']) {
    const callbackEvents = []
    const { events, form } = await setupSaveBranchHarness({
      mode,
      [mode === 'create' ? 'onCreateSuccess' : 'onEditSuccess']: async () => {
        callbackEvents.push(`${mode}Callback`)
      },
    })

    await form.handleSubmit({ preventDefault() {} })

    assert.deepEqual(callbackEvents, [`${mode}Callback`])
    assert.equal(events.includes('navigate'), false)
    assert.deepEqual(form.state.navigation, [])
  }
})
