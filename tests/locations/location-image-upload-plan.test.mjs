import assert from 'node:assert/strict'
import test from 'node:test'
import { harness } from '../observability/harness.mjs'

async function loadUploadPlan() {
  const h = await harness()
  return h.module('src/features/locations/application/location-image-upload-plan')
}

function persistedImage(id, overrides = {}) {
  return {
    id,
    location_id: 'location-1',
    url: `https://example.com/${id}.jpg`,
    storage_key: `${id}.jpg`,
    alt_text: null,
    caption: null,
    sort_order: 0,
    is_cover: false,
    width: 120,
    height: 80,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function pendingImage(id, overrides = {}) {
  return {
    id,
    file: new File(['image'], `${id}.jpg`, { type: 'image/jpeg' }),
    previewUrl: `blob:${id}`,
    width: 120,
    height: 80,
    originalIndex: 0,
    isCover: false,
    status: 'pending',
    ...overrides,
  }
}

function build(buildLocationImageUploadPlan, overrides = {}) {
  return buildLocationImageUploadPlan({
    mode: 'create',
    pendingImages: [],
    visiblePersistedImages: [],
    ...overrides,
  })
}

function uploadSummary(plan) {
  return Array.from(plan.uploads, (upload) => ({
    id: upload.image.id,
    isCover: upload.isCover,
    sortOrder: upload.sortOrder,
  }))
}

test('buildLocationImageUploadPlan returns an empty create plan without pending images', async () => {
  const { buildLocationImageUploadPlan } = await loadUploadPlan()

  const plan = build(buildLocationImageUploadPlan)

  assert.equal(plan.persistedSortOrderBase, 0)
  assert.equal(plan.uploads.length, 0)
  assert.equal(plan.invalidPendingImages.length, 0)
})

test('buildLocationImageUploadPlan plans a single pending cover upload', async () => {
  const { buildLocationImageUploadPlan } = await loadUploadPlan()

  const plan = build(buildLocationImageUploadPlan, {
    pendingImages: [pendingImage('cover', { isCover: true, originalIndex: 0 })],
  })

  assert.deepEqual(uploadSummary(plan), [
    { id: 'cover', isCover: true, sortOrder: 0 },
  ])
})

test('buildLocationImageUploadPlan plans gallery uploads sorted by original index', async () => {
  const { buildLocationImageUploadPlan } = await loadUploadPlan()

  const plan = build(buildLocationImageUploadPlan, {
    pendingImages: [
      pendingImage('gallery-b', { originalIndex: 2 }),
      pendingImage('gallery-a', { originalIndex: 1 }),
      pendingImage('gallery-c', { originalIndex: 4 }),
    ],
  })

  assert.deepEqual(uploadSummary(plan), [
    { id: 'gallery-a', isCover: false, sortOrder: 1 },
    { id: 'gallery-b', isCover: false, sortOrder: 2 },
    { id: 'gallery-c', isCover: false, sortOrder: 4 },
  ])
})

test('buildLocationImageUploadPlan preserves cover and gallery treatment while sorting together', async () => {
  const { buildLocationImageUploadPlan } = await loadUploadPlan()

  const plan = build(buildLocationImageUploadPlan, {
    pendingImages: [
      pendingImage('gallery', { originalIndex: 3 }),
      pendingImage('cover', { isCover: true, originalIndex: 0 }),
    ],
  })

  assert.deepEqual(uploadSummary(plan), [
    { id: 'cover', isCover: true, sortOrder: 0 },
    { id: 'gallery', isCover: false, sortOrder: 3 },
  ])
})

test('buildLocationImageUploadPlan offsets edit uploads after visible persisted sort order max', async () => {
  const { buildLocationImageUploadPlan } = await loadUploadPlan()

  const plan = build(buildLocationImageUploadPlan, {
    mode: 'edit',
    pendingImages: [
      pendingImage('new-a', { originalIndex: 0 }),
      pendingImage('new-b', { originalIndex: 2 }),
    ],
    visiblePersistedImages: [
      persistedImage('persisted-a', { sort_order: 0 }),
      persistedImage('persisted-b', { sort_order: 3 }),
    ],
  })

  assert.equal(plan.persistedSortOrderBase, 4)
  assert.deepEqual(uploadSummary(plan), [
    { id: 'new-a', isCover: false, sortOrder: 4 },
    { id: 'new-b', isCover: false, sortOrder: 6 },
  ])
})

test('buildLocationImageUploadPlan uses only visible persisted images for edit base', async () => {
  const { buildLocationImageUploadPlan } = await loadUploadPlan()

  const plan = build(buildLocationImageUploadPlan, {
    mode: 'edit',
    pendingImages: [pendingImage('new-image', { originalIndex: 1 })],
    visiblePersistedImages: [persistedImage('visible', { sort_order: 2 })],
  })

  assert.equal(plan.persistedSortOrderBase, 3)
  assert.deepEqual(uploadSummary(plan), [
    { id: 'new-image', isCover: false, sortOrder: 4 },
  ])
})

test('buildLocationImageUploadPlan combines existing cover with new gallery images without special casing the cover', async () => {
  const { buildLocationImageUploadPlan } = await loadUploadPlan()

  const plan = build(buildLocationImageUploadPlan, {
    mode: 'edit',
    pendingImages: [pendingImage('new-gallery', { originalIndex: 0 })],
    visiblePersistedImages: [
      persistedImage('existing-cover', { is_cover: true, sort_order: 0 }),
      persistedImage('existing-gallery', { sort_order: 4 }),
    ],
  })

  assert.equal(plan.persistedSortOrderBase, 5)
  assert.deepEqual(uploadSummary(plan), [
    { id: 'new-gallery', isCover: false, sortOrder: 5 },
  ])
})

test('buildLocationImageUploadPlan retries errored images only when dimensions are available', async () => {
  const { buildLocationImageUploadPlan } = await loadUploadPlan()

  const plan = build(buildLocationImageUploadPlan, {
    pendingImages: [
      pendingImage('retryable', { status: 'error', width: 120, height: 80 }),
      pendingImage('invalid-error', { status: 'error', width: 0, height: 80 }),
      pendingImage('done-image', { status: 'done' }),
    ],
  })

  assert.deepEqual(uploadSummary(plan), [
    { id: 'retryable', isCover: false, sortOrder: 0 },
  ])
  assert.deepEqual(Array.from(plan.invalidPendingImages, (image) => image.id), [
    'invalid-error',
  ])
})

test('buildLocationImageUploadPlan marks non-uploadable unfinished images as invalid', async () => {
  const { buildLocationImageUploadPlan } = await loadUploadPlan()

  const plan = build(buildLocationImageUploadPlan, {
    pendingImages: [
      pendingImage('processing', { status: 'processing' }),
      pendingImage('uploading', { status: 'uploading' }),
      pendingImage('finalizing', { status: 'finalizing' }),
      pendingImage('done', { status: 'done' }),
    ],
  })

  assert.equal(plan.uploads.length, 0)
  assert.deepEqual(Array.from(plan.invalidPendingImages, (image) => image.id), [
    'processing',
    'uploading',
    'finalizing',
  ])
})
