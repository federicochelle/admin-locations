import assert from 'node:assert/strict'
import test from 'node:test'
import { harness } from '../observability/harness.mjs'

async function loadSelectors() {
  const h = await harness()
  return h.module('src/features/locations/application/location-image-selectors')
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

function derive(deriveLocationImageState, overrides = {}) {
  return deriveLocationImageState({
    mode: 'edit',
    pendingDeletedPersistedImageIds: [],
    pendingImages: [],
    persistedImages: [],
    ...overrides,
  })
}

function imageIds(images) {
  return Array.from(images, (image) => image.id)
}

function combinedIds(items) {
  return Array.from(items, (item) =>
    item.kind === 'persisted'
      ? `persisted:${item.image.id}:${item.index}`
      : `pending:${item.image.id}`,
  )
}

test('deriveLocationImageState handles empty create and edit state', async () => {
  const { deriveLocationImageState } = await loadSelectors()

  const createState = derive(deriveLocationImageState, { mode: 'create' })
  assert.equal(createState.hasPersistedImagesMode, false)
  assert.equal(createState.visiblePersistedImages.length, 0)
  assert.equal(createState.persistedCoverImage, null)
  assert.equal(createState.persistedGalleryImages.length, 0)
  assert.equal(createState.pendingCoverImage, null)
  assert.equal(createState.pendingGalleryImages.length, 0)
  assert.equal(createState.combinedEditGalleryImages.length, 0)
  assert.equal(createState.hasAnalyzablePersistedImages, false)
  assert.equal(createState.hasAnalyzablePendingImages, false)
  assert.equal(createState.hasProcessingPendingImages, false)

  const editState = derive(deriveLocationImageState)
  assert.equal(editState.hasPersistedImagesMode, true)
  assert.equal(editState.visiblePersistedImages.length, 0)
})

test('deriveLocationImageState exposes a persisted cover without gallery items', async () => {
  const { deriveLocationImageState } = await loadSelectors()
  const cover = persistedImage('cover', { is_cover: true })

  const state = derive(deriveLocationImageState, {
    persistedImages: [cover],
  })

  assert.deepEqual(imageIds(state.visiblePersistedImages), ['cover'])
  assert.equal(state.persistedCoverImage, cover)
  assert.equal(state.persistedGalleryImages.length, 0)
  assert.equal(state.hasAnalyzablePersistedImages, true)
})

test('deriveLocationImageState separates persisted cover and gallery preserving input order', async () => {
  const { deriveLocationImageState } = await loadSelectors()
  const cover = persistedImage('cover', { is_cover: true, sort_order: 2 })
  const galleryA = persistedImage('gallery-a', { sort_order: 10 })
  const galleryB = persistedImage('gallery-b', { sort_order: 1 })

  const state = derive(deriveLocationImageState, {
    persistedImages: [galleryA, cover, galleryB],
  })

  assert.equal(state.persistedCoverImage, cover)
  assert.deepEqual(imageIds(state.persistedGalleryImages), ['gallery-a', 'gallery-b'])
  assert.deepEqual(combinedIds(state.combinedEditGalleryImages), [
    'persisted:gallery-a:0',
    'persisted:gallery-b:1',
  ])
})

test('deriveLocationImageState filters persisted images marked for deletion before cover and gallery derivation', async () => {
  const { deriveLocationImageState } = await loadSelectors()
  const cover = persistedImage('cover', { is_cover: true })
  const galleryA = persistedImage('gallery-a')
  const galleryB = persistedImage('gallery-b')

  const state = derive(deriveLocationImageState, {
    pendingDeletedPersistedImageIds: ['cover', 'gallery-b'],
    persistedImages: [cover, galleryA, galleryB],
  })

  assert.deepEqual(imageIds(state.visiblePersistedImages), ['gallery-a'])
  assert.equal(state.persistedCoverImage, null)
  assert.deepEqual(imageIds(state.persistedGalleryImages), ['gallery-a'])
  assert.deepEqual(combinedIds(state.combinedEditGalleryImages), [
    'persisted:gallery-a:0',
  ])
})

test('deriveLocationImageState separates pending cover and pending gallery preserving input order', async () => {
  const { deriveLocationImageState } = await loadSelectors()
  const galleryA = pendingImage('pending-gallery-a')
  const cover = pendingImage('pending-cover', { isCover: true })
  const galleryB = pendingImage('pending-gallery-b')

  const state = derive(deriveLocationImageState, {
    pendingImages: [galleryA, cover, galleryB],
  })

  assert.equal(state.pendingCoverImage, cover)
  assert.deepEqual(imageIds(state.pendingGalleryImages), [
    'pending-gallery-a',
    'pending-gallery-b',
  ])
  assert.deepEqual(combinedIds(state.combinedEditGalleryImages), [
    'pending:pending-gallery-a',
    'pending:pending-gallery-b',
  ])
})

test('deriveLocationImageState combines persisted gallery before pending gallery in edit state', async () => {
  const { deriveLocationImageState } = await loadSelectors()
  const cover = persistedImage('cover', { is_cover: true })
  const persistedGallery = persistedImage('persisted-gallery')
  const pendingCover = pendingImage('pending-cover', { isCover: true })
  const pendingGallery = pendingImage('pending-gallery')

  const state = derive(deriveLocationImageState, {
    pendingImages: [pendingCover, pendingGallery],
    persistedImages: [cover, persistedGallery],
  })

  assert.deepEqual(combinedIds(state.combinedEditGalleryImages), [
    'persisted:persisted-gallery:0',
    'pending:pending-gallery',
  ])
})

test('deriveLocationImageState detects analyzable persisted images only in edit mode and after deletion filtering', async () => {
  const { deriveLocationImageState } = await loadSelectors()
  const blankUrl = persistedImage('blank-url', { url: '   ' })
  const analyzable = persistedImage('analyzable')

  const editState = derive(deriveLocationImageState, {
    persistedImages: [blankUrl, analyzable],
  })
  assert.equal(editState.hasAnalyzablePersistedImages, true)

  const deletedState = derive(deriveLocationImageState, {
    pendingDeletedPersistedImageIds: ['analyzable'],
    persistedImages: [blankUrl, analyzable],
  })
  assert.equal(deletedState.hasAnalyzablePersistedImages, false)

  const viewState = derive(deriveLocationImageState, {
    mode: 'view',
    persistedImages: [analyzable],
  })
  assert.equal(viewState.hasAnalyzablePersistedImages, false)
})

test('deriveLocationImageState detects analyzable and processing pending images from status and dimensions', async () => {
  const { deriveLocationImageState } = await loadSelectors()

  const emptyDimensions = derive(deriveLocationImageState, {
    pendingImages: [pendingImage('no-size', { width: 0, height: 80 })],
  })
  assert.equal(emptyDimensions.hasAnalyzablePendingImages, false)

  const processingState = derive(deriveLocationImageState, {
    pendingImages: [
      pendingImage('processing', { status: 'processing' }),
      pendingImage('pending', { width: 120, height: 80 }),
    ],
  })

  assert.equal(processingState.hasAnalyzablePendingImages, true)
  assert.equal(processingState.hasProcessingPendingImages, true)
})
