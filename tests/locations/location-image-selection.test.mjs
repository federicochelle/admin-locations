import assert from 'node:assert/strict'
import test from 'node:test'
import { harness } from '../observability/harness.mjs'

async function loadImageSelection() {
  const h = await harness()
  return h.module('src/features/locations/application/location-image-selection')
}

function plain(value) {
  return JSON.parse(JSON.stringify(value))
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
    selectionTarget: 'gallery',
    status: 'pending',
    errorMessage: null,
    ...overrides,
  }
}

function imageSummary(images) {
  return images.map((image) => ({
    id: image.id,
    isCover: image.isCover,
    selectionTarget: image.selectionTarget,
  }))
}

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

function createSelectionHarness(overrides = {}) {
  const state = {
    correlationIds: [],
    editDeleteErrorMessages: [],
    imageSelectionTargets: [],
    imageValidationErrors: [],
    isMountedRef: { current: true },
    isPreparingImages: [],
    pendingImages: overrides.initialImages ?? [],
    pendingImagesRef: { current: overrides.initialImages ?? [] },
    preparedFiles: [],
    processedCounts: [],
    removedPendingImageIdsRef: {
      current: new Set(overrides.initialRemovedIds ?? []),
    },
    reportedFailures: [],
    revokedPreviewUrls: [],
    totalImagesToProcess: [],
  }
  const idByFileName = overrides.idByFileName ?? {}

  function syncPendingImages(nextImages) {
    state.pendingImages = nextImages
    state.pendingImagesRef.current = nextImages
  }

  return {
    deps: {
      createCorrelationId: () => {
        const correlationId = `correlation-${state.correlationIds.length + 1}`
        state.correlationIds.push(correlationId)
        return correlationId
      },
      createPlaceholder: (file, options) =>
        pendingImage(idByFileName[file.name] ?? file.name, {
          file,
          height: 0,
          isCover: options.isCover,
          originalIndex: options.originalIndex,
          previewUrl: `placeholder:${file.name}`,
          selectionTarget: options.target,
          status: 'processing',
          width: 0,
        }),
      files: overrides.files ?? [],
      getNextOriginalIndex:
        overrides.getNextOriginalIndex ??
        ((currentImages) =>
          currentImages.reduce(
            (maxIndex, image) => Math.max(maxIndex, image.originalIndex),
            -1,
          ) + 1),
      imagePreparationConcurrency: overrides.imagePreparationConcurrency ?? 3,
      isMountedRef: state.isMountedRef,
      isReadOnly: false,
      pendingImagesRef: state.pendingImagesRef,
      prepareImage:
        overrides.prepareImage ??
        (async (file, options) => {
          state.preparedFiles.push(file.name)
          return pendingImage(options.id, {
            file,
            height: 480,
            isCover: options.isCover,
            originalIndex: options.originalIndex,
            previewUrl: `prepared:${file.name}`,
            selectionTarget: options.target,
            status: 'pending',
            width: 640,
          })
        }),
      removedPendingImageIdsRef: state.removedPendingImageIdsRef,
      reportLocationFailure: (error, context) => {
        state.reportedFailures.push({ context, error })
      },
      revokePreviewUrl: (previewUrl) => {
        state.revokedPreviewUrls.push(previewUrl)
      },
      setEditDeleteErrorMessage: (message) => {
        state.editDeleteErrorMessages.push(message)
      },
      setImageSelectionTarget: (target) => {
        state.imageSelectionTargets.push(target)
      },
      setImageValidationErrors: (errors) => {
        state.imageValidationErrors.push(errors)
      },
      setIsPreparingImages: (isPreparing) => {
        state.isPreparingImages.push(isPreparing)
      },
      setPendingImages: (updater) => {
        syncPendingImages(updater(state.pendingImages))
      },
      setProcessedImagesCount: (count) => {
        state.processedCounts.push(count)
      },
      setTotalImagesToProcess: (count) => {
        state.totalImagesToProcess.push(count)
      },
      target: overrides.target ?? 'gallery',
    },
    state,
  }
}

test('mergePendingImagePlaceholders appends gallery placeholders without removals', async () => {
  const { mergePendingImagePlaceholders } = await loadImageSelection()
  const currentImages = [
    pendingImage('current-a'),
    pendingImage('current-b', { isCover: true, selectionTarget: 'cover' }),
  ]
  const placeholders = [
    pendingImage('new-a', { originalIndex: 2 }),
    pendingImage('new-b', { originalIndex: 3 }),
  ]

  const result = mergePendingImagePlaceholders({
    currentImages,
    isCoverSelection: false,
    placeholders,
  })

  assert.deepEqual(plain(imageSummary(result.nextImages)), [
    { id: 'current-a', isCover: false, selectionTarget: 'gallery' },
    { id: 'current-b', isCover: true, selectionTarget: 'cover' },
    { id: 'new-a', isCover: false, selectionTarget: 'gallery' },
    { id: 'new-b', isCover: false, selectionTarget: 'gallery' },
  ])
  assert.deepEqual(plain(result.removedImageIds), [])
  assert.deepEqual(plain(result.previewUrlsToRevoke), [])
})

test('getImageSelectionPlan selects only the first cover file and reports total files', async () => {
  const { getImageSelectionPlan } = await loadImageSelection()
  const files = [
    new File(['a'], 'cover-a.jpg', { type: 'image/jpeg' }),
    new File(['b'], 'cover-b.jpg', { type: 'image/jpeg' }),
  ]

  const result = getImageSelectionPlan({
    files,
    target: 'cover',
  })

  assert.equal(result.isCoverSelection, true)
  assert.deepEqual(result.selectedFiles, [files[0]])
  assert.equal(result.totalFiles, 1)
})

test('getImageSelectionPlan keeps every gallery file and reports total files', async () => {
  const { getImageSelectionPlan } = await loadImageSelection()
  const files = [
    new File(['a'], 'gallery-a.jpg', { type: 'image/jpeg' }),
    new File(['b'], 'gallery-b.jpg', { type: 'image/jpeg' }),
    new File(['c'], 'gallery-c.jpg', { type: 'image/jpeg' }),
  ]

  const result = getImageSelectionPlan({
    files,
    target: 'gallery',
  })

  assert.equal(result.isCoverSelection, false)
  assert.deepEqual(result.selectedFiles, files)
  assert.equal(result.totalFiles, 3)
})

test('buildPendingImagePlaceholderInputs increments original indexes and marks the first cover only', async () => {
  const { buildPendingImagePlaceholderInputs } = await loadImageSelection()
  const files = [
    new File(['a'], 'cover-a.jpg', { type: 'image/jpeg' }),
    new File(['b'], 'cover-b.jpg', { type: 'image/jpeg' }),
  ]

  const result = buildPendingImagePlaceholderInputs({
    isCoverSelection: true,
    selectedFiles: files,
    startingOriginalIndex: 7,
    target: 'cover',
  })

  assert.deepEqual(
    plain(
      result.map((input) => ({
        fileName: input.file.name,
        isCover: input.isCover,
        originalIndex: input.originalIndex,
        target: input.target,
      })),
    ),
    [
      {
        fileName: 'cover-a.jpg',
        isCover: true,
        originalIndex: 7,
        target: 'cover',
      },
      {
        fileName: 'cover-b.jpg',
        isCover: false,
        originalIndex: 8,
        target: 'cover',
      },
    ],
  )
})

test('buildPendingImagePlaceholderInputs preserves gallery order and target', async () => {
  const { buildPendingImagePlaceholderInputs } = await loadImageSelection()
  const files = [
    new File(['a'], 'gallery-a.jpg', { type: 'image/jpeg' }),
    new File(['b'], 'gallery-b.jpg', { type: 'image/jpeg' }),
    new File(['c'], 'gallery-c.jpg', { type: 'image/jpeg' }),
  ]

  const result = buildPendingImagePlaceholderInputs({
    isCoverSelection: false,
    selectedFiles: files,
    startingOriginalIndex: 2,
    target: 'gallery',
  })

  assert.deepEqual(
    plain(
      result.map((input) => ({
        fileName: input.file.name,
        isCover: input.isCover,
        originalIndex: input.originalIndex,
        target: input.target,
      })),
    ),
    [
      {
        fileName: 'gallery-a.jpg',
        isCover: false,
        originalIndex: 2,
        target: 'gallery',
      },
      {
        fileName: 'gallery-b.jpg',
        isCover: false,
        originalIndex: 3,
        target: 'gallery',
      },
      {
        fileName: 'gallery-c.jpg',
        isCover: false,
        originalIndex: 4,
        target: 'gallery',
      },
    ],
  )
})

test('mergePendingImagePlaceholders replaces only the pending cover and reports cleanup data', async () => {
  const { mergePendingImagePlaceholders } = await loadImageSelection()
  const currentImages = [
    pendingImage('gallery-before', { originalIndex: 0 }),
    pendingImage('old-cover', {
      isCover: true,
      originalIndex: 1,
      previewUrl: 'blob:old-cover-preview',
      selectionTarget: 'cover',
    }),
    pendingImage('gallery-after', { originalIndex: 2 }),
  ]
  const placeholders = [
    pendingImage('new-cover', {
      isCover: true,
      originalIndex: 3,
      selectionTarget: 'cover',
    }),
  ]

  const result = mergePendingImagePlaceholders({
    currentImages,
    isCoverSelection: true,
    placeholders,
  })

  assert.deepEqual(plain(imageSummary(result.nextImages)), [
    { id: 'gallery-before', isCover: false, selectionTarget: 'gallery' },
    { id: 'gallery-after', isCover: false, selectionTarget: 'gallery' },
    { id: 'new-cover', isCover: true, selectionTarget: 'cover' },
  ])
  assert.deepEqual(plain(result.removedImageIds), ['old-cover'])
  assert.deepEqual(plain(result.previewUrlsToRevoke), ['blob:old-cover-preview'])
})

test('applyPreparedImageToPendingImages replaces only the target image with the exact success patch', async () => {
  const { applyPreparedImageToPendingImages } = await loadImageSelection()
  const file = new File(['prepared'], 'prepared.jpg', { type: 'image/jpeg' })
  const first = pendingImage('first')
  const target = pendingImage('target', {
    errorMessage: 'previous error',
    height: 0,
    processingLabel: 'Procesando...',
    previewUrl: 'placeholder:target',
    status: 'processing',
    width: 0,
  })
  const last = pendingImage('last')
  const preparedImage = pendingImage('target', {
    file,
    height: 480,
    previewUrl: 'blob:prepared-target',
    status: 'pending',
    width: 640,
  })

  const result = applyPreparedImageToPendingImages(
    [first, target, last],
    preparedImage,
  )

  assert.equal(result[0], first)
  assert.equal(result[2], last)
  assert.deepEqual(plain(result.map((image) => image.id)), [
    'first',
    'target',
    'last',
  ])
  assert.equal(result[1].file, file)
  assert.deepEqual(plain({
    errorMessage: result[1].errorMessage,
    height: result[1].height,
    processingLabel: result[1].processingLabel,
    previewUrl: result[1].previewUrl,
    status: result[1].status,
    width: result[1].width,
  }), {
    errorMessage: null,
    height: 480,
    processingLabel: null,
    previewUrl: 'blob:prepared-target',
    status: 'pending',
    width: 640,
  })
})

test('applyPreparedImageToPendingImages keeps equivalent content when the id is missing', async () => {
  const { applyPreparedImageToPendingImages } = await loadImageSelection()
  const first = pendingImage('first')
  const last = pendingImage('last')

  const result = applyPreparedImageToPendingImages(
    [first, last],
    pendingImage('missing', {
      previewUrl: 'blob:missing',
    }),
  )

  assert.equal(result[0], first)
  assert.equal(result[1], last)
  assert.deepEqual(plain(imageSummary(result)), plain(imageSummary([first, last])))
})

test('applyImagePreparationErrorToPendingImages replaces only the target image with the exact error patch', async () => {
  const { applyImagePreparationErrorToPendingImages } = await loadImageSelection()
  const first = pendingImage('first')
  const target = pendingImage('target', {
    errorMessage: null,
    processingLabel: 'Optimizando...',
    status: 'processing',
  })
  const last = pendingImage('last')

  const result = applyImagePreparationErrorToPendingImages(
    [first, target, last],
    'target',
    'No pudimos preparar la imagen.',
  )

  assert.equal(result[0], first)
  assert.equal(result[2], last)
  assert.deepEqual(plain(result.map((image) => image.id)), [
    'first',
    'target',
    'last',
  ])
  assert.deepEqual(plain({
    errorMessage: result[1].errorMessage,
    processingLabel: result[1].processingLabel,
    status: result[1].status,
  }), {
    errorMessage: 'No pudimos preparar la imagen.',
    processingLabel: null,
    status: 'error',
  })
})

test('applyImagePreparationErrorToPendingImages keeps equivalent content when the id is missing', async () => {
  const { applyImagePreparationErrorToPendingImages } = await loadImageSelection()
  const first = pendingImage('first')
  const last = pendingImage('last')

  const result = applyImagePreparationErrorToPendingImages(
    [first, last],
    'missing',
    'No pudimos preparar la imagen.',
  )

  assert.equal(result[0], first)
  assert.equal(result[1], last)
  assert.deepEqual(plain(imageSummary(result)), plain(imageSummary([first, last])))
})

test('handleSelectedLocationImageFiles processes only the first file for cover selections', async () => {
  const { handleSelectedLocationImageFiles } = await loadImageSelection()
  const files = [
    new File(['a'], 'cover-a.jpg', { type: 'image/jpeg' }),
    new File(['b'], 'cover-b.jpg', { type: 'image/jpeg' }),
  ]
  const { deps, state } = createSelectionHarness({
    files,
    target: 'cover',
  })

  await handleSelectedLocationImageFiles(deps)

  assert.deepEqual(state.preparedFiles, ['cover-a.jpg'])
  assert.deepEqual(plain(imageSummary(state.pendingImages)), [
    { id: 'cover-a.jpg', isCover: true, selectionTarget: 'cover' },
  ])
  assert.deepEqual(state.totalImagesToProcess, [1])
})

test('handleSelectedLocationImageFiles keeps preparing gallery images after one fails', async () => {
  const { handleSelectedLocationImageFiles } = await loadImageSelection()
  const files = [
    new File(['a'], 'gallery-a.jpg', { type: 'image/jpeg' }),
    new File(['b'], 'gallery-b.jpg', { type: 'image/jpeg' }),
    new File(['c'], 'gallery-c.jpg', { type: 'image/jpeg' }),
  ]
  const { deps, state } = createSelectionHarness({
    files,
    prepareImage: async (file, options) => {
      state.preparedFiles.push(file.name)

      if (file.name === 'gallery-b.jpg') {
        throw new Error('No pudimos preparar gallery-b.jpg')
      }

      return pendingImage(options.id, {
        file,
        height: 480,
        isCover: options.isCover,
        originalIndex: options.originalIndex,
        previewUrl: `prepared:${file.name}`,
        selectionTarget: options.target,
        status: 'pending',
        width: 640,
      })
    },
    target: 'gallery',
  })

  await handleSelectedLocationImageFiles(deps)

  assert.deepEqual(state.preparedFiles.sort(), [
    'gallery-a.jpg',
    'gallery-b.jpg',
    'gallery-c.jpg',
  ])
  assert.deepEqual(plain(state.pendingImages.map((image) => image.status)), [
    'pending',
    'error',
    'pending',
  ])
  assert.equal(state.pendingImages[1].errorMessage, 'No pudimos preparar gallery-b.jpg')
  assert.equal(state.reportedFailures.length, 1)
})

test('handleSelectedLocationImageFiles replaces an existing cover and revokes its preview', async () => {
  const { handleSelectedLocationImageFiles } = await loadImageSelection()
  const oldCover = pendingImage('old-cover', {
    isCover: true,
    originalIndex: 0,
    previewUrl: 'blob:old-cover',
    selectionTarget: 'cover',
  })
  const gallery = pendingImage('gallery', {
    isCover: false,
    originalIndex: 1,
    selectionTarget: 'gallery',
  })
  const galleryMarkedCover = pendingImage('gallery-marked-cover', {
    isCover: true,
    originalIndex: 2,
    selectionTarget: 'gallery',
  })
  const { deps, state } = createSelectionHarness({
    files: [new File(['new'], 'new-cover.jpg', { type: 'image/jpeg' })],
    initialImages: [oldCover, gallery, galleryMarkedCover],
    target: 'cover',
  })

  await handleSelectedLocationImageFiles(deps)

  assert.equal(state.removedPendingImageIdsRef.current.has('old-cover'), true)
  assert.deepEqual(state.revokedPreviewUrls, ['blob:old-cover'])
  assert.deepEqual(plain(imageSummary(state.pendingImages)), [
    { id: 'gallery', isCover: false, selectionTarget: 'gallery' },
    { id: 'gallery-marked-cover', isCover: false, selectionTarget: 'gallery' },
    { id: 'new-cover.jpg', isCover: true, selectionTarget: 'cover' },
  ])
})

test('handleSelectedLocationImageFiles does not update a removed image and revokes the prepared preview', async () => {
  const { handleSelectedLocationImageFiles } = await loadImageSelection()
  const deferred = createDeferred()
  const { deps, state } = createSelectionHarness({
    files: [new File(['a'], 'gallery-a.jpg', { type: 'image/jpeg' })],
    prepareImage: async (file, options) => {
      state.preparedFiles.push(file.name)
      await deferred.promise
      return pendingImage(options.id, {
        file,
        height: 480,
        isCover: options.isCover,
        originalIndex: options.originalIndex,
        previewUrl: 'blob:prepared-gallery-a',
        selectionTarget: options.target,
        status: 'pending',
        width: 640,
      })
    },
    target: 'gallery',
  })

  const selection = handleSelectedLocationImageFiles(deps)
  await Promise.resolve()
  state.removedPendingImageIdsRef.current.add('gallery-a.jpg')
  state.pendingImages = []
  state.pendingImagesRef.current = []
  deferred.resolve()
  await selection

  assert.deepEqual(state.pendingImages, [])
  assert.deepEqual(state.revokedPreviewUrls, ['blob:prepared-gallery-a'])
})

test('handleSelectedLocationImageFiles limits concurrency and counts success and error progress', async () => {
  const { handleSelectedLocationImageFiles } = await loadImageSelection()
  const files = Array.from(
    { length: 6 },
    (_, index) => new File([`${index}`], `gallery-${index}.jpg`, { type: 'image/jpeg' }),
  )
  let activePreparations = 0
  let maxActivePreparations = 0
  const { deps, state } = createSelectionHarness({
    files,
    imagePreparationConcurrency: 3,
    prepareImage: async (file, options) => {
      state.preparedFiles.push(file.name)
      activePreparations += 1
      maxActivePreparations = Math.max(maxActivePreparations, activePreparations)
      await new Promise((resolve) => setTimeout(resolve, 0))
      activePreparations -= 1

      if (file.name === 'gallery-4.jpg') {
        throw new Error('No pudimos preparar gallery-4.jpg')
      }

      return pendingImage(options.id, {
        file,
        height: 480,
        isCover: options.isCover,
        originalIndex: options.originalIndex,
        previewUrl: `prepared:${file.name}`,
        selectionTarget: options.target,
        status: 'pending',
        width: 640,
      })
    },
    target: 'gallery',
  })

  await handleSelectedLocationImageFiles(deps)

  assert.equal(maxActivePreparations <= 3, true)
  assert.deepEqual(state.processedCounts, [0, 1, 2, 3, 4, 5, 6])
  assert.equal(state.pendingImages.filter((image) => image.status === 'pending').length, 5)
  assert.equal(state.pendingImages.filter((image) => image.status === 'error').length, 1)
  assert.deepEqual(state.isPreparingImages, [true, false])
})

test('mergePendingImagePlaceholders preserves order and clears isCover on remaining images', async () => {
  const { mergePendingImagePlaceholders } = await loadImageSelection()
  const currentImages = [
    pendingImage('first-gallery', { isCover: false, selectionTarget: 'gallery' }),
    pendingImage('gallery-marked-cover', {
      isCover: true,
      selectionTarget: 'gallery',
    }),
    pendingImage('old-cover', {
      isCover: true,
      previewUrl: 'blob:old-cover-preview',
      selectionTarget: 'cover',
    }),
    pendingImage('last-gallery', { isCover: false, selectionTarget: 'gallery' }),
  ]
  const placeholders = [
    pendingImage('new-cover', {
      isCover: true,
      selectionTarget: 'cover',
    }),
  ]

  const result = mergePendingImagePlaceholders({
    currentImages,
    isCoverSelection: true,
    placeholders,
  })

  assert.deepEqual(plain(imageSummary(result.nextImages)), [
    { id: 'first-gallery', isCover: false, selectionTarget: 'gallery' },
    { id: 'gallery-marked-cover', isCover: false, selectionTarget: 'gallery' },
    { id: 'last-gallery', isCover: false, selectionTarget: 'gallery' },
    { id: 'new-cover', isCover: true, selectionTarget: 'cover' },
  ])
  assert.deepEqual(plain(result.removedImageIds), ['old-cover'])
  assert.deepEqual(plain(result.previewUrlsToRevoke), ['blob:old-cover-preview'])
})
