import assert from 'node:assert/strict'
import test from 'node:test'
import { harness } from '../observability/harness.mjs'

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

test('createPendingLocationImagePlaceholder creates a valid id without randomUUID', async () => {
  const h = await harness()
  h.context.crypto = {
    getRandomValues(bytes) {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = index + 1
      }

      return bytes
    },
  }
  const selection = await h.module('src/features/locations/location-image-selection')
  const file = new File(['image'], 'cover.jpg', { type: 'image/jpeg' })
  const placeholder = selection.createPendingLocationImagePlaceholder(file, {
    isCover: true,
    originalIndex: 0,
    target: 'cover',
  })

  assert.match(placeholder.id, UUID_V4_PATTERN)
  assert.equal(placeholder.file, file)
  assert.equal(placeholder.isCover, true)
  assert.equal(placeholder.selectionTarget, 'cover')
  assert.equal(placeholder.status, 'processing')
})

test('handleSelectedLocationImageFiles reaches cover and gallery placeholders without randomUUID', async () => {
  const h = await harness()
  h.context.crypto = {
    getRandomValues(bytes) {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = index + 20
      }

      return bytes
    },
  }
  const appSelection = await h.module(
    'src/features/locations/application/location-image-selection',
  )
  const imageSelection = await h.module('src/features/locations/location-image-selection')

  async function runSelection(target) {
    const state = {
      pending: [],
      pendingRef: { current: [] },
    }
    const file = new File(['image'], `${target}.jpg`, { type: 'image/jpeg' })

    await appSelection.handleSelectedLocationImageFiles({
      createCorrelationId: () => 'correlation',
      createPlaceholder: imageSelection.createPendingLocationImagePlaceholder,
      files: [file],
      getNextOriginalIndex: () => 0,
      imagePreparationConcurrency: 1,
      isMountedRef: { current: true },
      isReadOnly: false,
      pendingImagesRef: state.pendingRef,
      prepareImage: async (selectedFile, options) => ({
        id: options.id,
        file: selectedFile,
        height: 20,
        previewUrl: `blob:${target}`,
        originalIndex: options.originalIndex,
        isCover: options.isCover,
        selectionTarget: options.target,
        status: 'pending',
        width: 10,
        errorMessage: null,
      }),
      removedPendingImageIdsRef: { current: new Set() },
      reportLocationFailure: () => {},
      revokePreviewUrl: () => {},
      setEditDeleteErrorMessage: () => {},
      setImageSelectionTarget: () => {},
      setImageValidationErrors: () => {},
      setIsPreparingImages: () => {},
      setPendingImages(updater) {
        state.pending = updater(state.pending)
        state.pendingRef.current = state.pending
      },
      setProcessedImagesCount: () => {},
      setTotalImagesToProcess: () => {},
      target,
    })

    return state.pending[0]
  }

  const cover = await runSelection('cover')
  const gallery = await runSelection('gallery')

  assert.match(cover.id, UUID_V4_PATTERN)
  assert.equal(cover.isCover, true)
  assert.equal(cover.selectionTarget, 'cover')
  assert.match(gallery.id, UUID_V4_PATTERN)
  assert.equal(gallery.isCover, false)
  assert.equal(gallery.selectionTarget, 'gallery')
})
