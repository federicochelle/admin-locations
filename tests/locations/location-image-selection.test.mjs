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
    pendingImageSnapshots: [],
    preparedFiles: [],
    processedCounts: [],
    removedPendingImageIdsRef: {
      current: new Set(overrides.initialRemovedIds ?? []),
    },
    reportedFailures: [],
    retryingPendingImageIdsRef: {
      current: new Set(),
    },
    revokedPreviewUrls: [],
    totalImagesToProcess: [],
  }
  const idByFileName = overrides.idByFileName ?? {}

  function syncPendingImages(nextImages) {
    state.pendingImages = nextImages
    state.pendingImagesRef.current = nextImages
    state.pendingImageSnapshots.push(
      nextImages.map((image) => ({
        errorMessage: image.errorMessage,
        height: image.height,
        id: image.id,
        isCover: image.isCover,
        originalIndex: image.originalIndex,
        previewUrl: image.previewUrl,
        processingLabel: image.processingLabel,
        retryable: image.retryable,
        selectionTarget: image.selectionTarget,
        status: image.status,
        width: image.width,
      })),
    )
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
      imagePreparationTimeoutMs: overrides.imagePreparationTimeoutMs,
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

function createRetryDeps(deps, state, imageId, overrides = {}) {
  return {
    correlationId: overrides.correlationId ?? 'retry-correlation',
    imageId,
    imagePreparationTimeoutMs: overrides.imagePreparationTimeoutMs,
    isMountedRef: state.isMountedRef,
    pendingImagesRef: state.pendingImagesRef,
    prepareImage: overrides.prepareImage ?? deps.prepareImage,
    removedPendingImageIdsRef: state.removedPendingImageIdsRef,
    reportLocationFailure: deps.reportLocationFailure,
    retryingPendingImageIdsRef: state.retryingPendingImageIdsRef,
    revokePreviewUrl: deps.revokePreviewUrl,
    setPendingImages: deps.setPendingImages,
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
  assert.deepEqual({
    errorMessage: result[1].errorMessage,
    processingLabel: result[1].processingLabel,
    retryable: result[1].retryable,
    status: result[1].status,
  }, {
    errorMessage: 'No pudimos preparar la imagen.',
    processingLabel: null,
    retryable: undefined,
    status: 'error',
  })
})

test('applyImagePreparationErrorToPendingImages stores explicit retryable classification', async () => {
  const { applyImagePreparationErrorToPendingImages } = await loadImageSelection()
  const target = pendingImage('target', {
    errorMessage: null,
    processingLabel: 'Optimizando...',
    status: 'processing',
  })

  const result = applyImagePreparationErrorToPendingImages(
    [target],
    'target',
    'La preparación demoró demasiado.',
    true,
  )

  assert.equal(result[0].retryable, true)
  assert.equal(result[0].status, 'error')
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

test('getImagePreparationRetryable marks structured mandatory timeouts as retryable', async () => {
  const { getImagePreparationRetryable } = await loadImageSelection()
  const timeout = new Error('La preparación demoró demasiado.')
  timeout.name = 'AdminOperationTimeoutError'
  timeout.stage = 'images.prepare'
  timeout.provider = 'browser'
  timeout.timeoutMs = 10

  assert.equal(getImagePreparationRetryable(timeout), true)
})

test('getImagePreparationRetryable marks HEIC conversion timeout causes as retryable', async () => {
  const { getImagePreparationRetryable } = await loadImageSelection()
  const timeout = new Error('La conversión HEIC/HEIF demoró demasiado.')
  timeout.name = 'AdminOperationTimeoutError'
  timeout.stage = 'images.convert'
  timeout.provider = 'browser'
  timeout.timeoutMs = 10
  const error = new Error('foto.heic: no pudimos convertir la imagen HEIC/HEIF automáticamente.', {
    cause: timeout,
  })

  assert.equal(getImagePreparationRetryable(error), true)
})

test('getImagePreparationRetryable marks expected permanent errors as not retryable', async () => {
  const h = await harness()
  const selection = await h.module('src/features/locations/application/location-image-selection')
  const reporting = await h.module('src/lib/admin-error-reporting')
  const error = reporting.markExpectedAdminError(
    new Error('Formato de imagen no permitido.'),
  )

  assert.equal(selection.getImagePreparationRetryable(error), false)
})

test('getImagePreparationRetryable marks confirmed decode failures without timeout as not retryable', async () => {
  const { getImagePreparationRetryable } = await loadImageSelection()
  const bitmapError = new DOMException('Cannot decode', 'InvalidStateError')
  const fallbackError = new Error('HTMLImageElement could not decode the image')
  const error = new Error(
    'No pudimos procesar esta imagen. Probá con otra imagen o guardala nuevamente como JPG.',
    {
      cause: new AggregateError(
        [bitmapError, fallbackError],
        'Image decoding failed',
      ),
    },
  )

  assert.equal(getImagePreparationRetryable(error), false)
})

test('getImagePreparationRetryable keeps ambiguous errors unclassified', async () => {
  const { getImagePreparationRetryable } = await loadImageSelection()

  assert.equal(getImagePreparationRetryable(new Error('Canvas draw failed')), undefined)
  assert.equal(getImagePreparationRetryable('unexpected failure'), undefined)
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

test('handleSelectedLocationImageFiles times out a hung preparation and continues the batch', async () => {
  const { handleSelectedLocationImageFiles } = await loadImageSelection()
  const files = [
    new File(['a'], 'gallery-a.jpg', { type: 'image/jpeg' }),
    new File(['b'], 'gallery-b.jpg', { type: 'image/jpeg' }),
  ]
  const { deps, state } = createSelectionHarness({
    files,
    imagePreparationConcurrency: 1,
    imagePreparationTimeoutMs: 10,
    prepareImage: async (file, options) => {
      state.preparedFiles.push(file.name)

      if (file.name === 'gallery-a.jpg') {
        options.onStatusChange?.('Optimizando imagen...')
        return new Promise(() => {})
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

  assert.deepEqual(state.preparedFiles, ['gallery-a.jpg', 'gallery-b.jpg'])
  assert.deepEqual(state.processedCounts, [0, 1, 2])
  assert.deepEqual(state.isPreparingImages, [true, false])
  assert.deepEqual(plain(state.pendingImages.map((image) => ({
    errorMessage: image.errorMessage,
    processingLabel: image.processingLabel,
    retryable: image.retryable,
    status: image.status,
  }))), [
    {
      errorMessage: 'gallery-a.jpg: la preparación de la imagen demoró demasiado. Probá nuevamente.',
      processingLabel: null,
      retryable: true,
      status: 'error',
    },
    {
      errorMessage: null,
      processingLabel: null,
      status: 'pending',
    },
  ])
  assert.equal(state.reportedFailures.length, 1)
  assert.equal(state.reportedFailures[0].context.stage, 'images.prepare')
  assert.equal(state.reportedFailures[0].context.provider, 'browser')
  assert.equal(state.reportedFailures[0].context.correlationId, 'correlation-1')
  assert.equal(state.reportedFailures[0].context.retryable, true)
  assert.equal(state.reportedFailures[0].context.extraSafeContext.timeout_ms, 10)
  assert.equal(state.reportedFailures[0].context.extraSafeContext.retryable, true)
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

test('handleSelectedLocationImageFiles skips mounted setters after unmount and revokes the prepared preview', async () => {
  const { handleSelectedLocationImageFiles } = await loadImageSelection()
  const continuePreparation = createDeferred()
  const preparationStarted = createDeferred()
  const { deps, state } = createSelectionHarness({
    files: [new File(['a'], 'gallery-a.jpg', { type: 'image/jpeg' })],
    prepareImage: async (file, options) => {
      state.preparedFiles.push(file.name)
      preparationStarted.resolve()
      await continuePreparation.promise

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
  await preparationStarted.promise
  const placeholderSnapshot = plain(state.pendingImageSnapshots.at(-1))
  state.isMountedRef.current = false
  continuePreparation.resolve()
  await selection

  assert.deepEqual(
    plain(
      state.pendingImages.map((image) => ({
        errorMessage: image.errorMessage,
        height: image.height,
        id: image.id,
        isCover: image.isCover,
        originalIndex: image.originalIndex,
        previewUrl: image.previewUrl,
        processingLabel: image.processingLabel,
        selectionTarget: image.selectionTarget,
        status: image.status,
        width: image.width,
      })),
    ),
    placeholderSnapshot,
  )
  assert.deepEqual(plain(state.pendingImageSnapshots), [placeholderSnapshot])
  assert.deepEqual(state.processedCounts, [0])
  assert.deepEqual(state.isPreparingImages, [true])
  assert.deepEqual(state.reportedFailures, [])
  assert.deepEqual(state.revokedPreviewUrls, ['blob:prepared-gallery-a'])
})

test('handleSelectedLocationImageFiles ignores status changes for images removed while preparing', async () => {
  const { handleSelectedLocationImageFiles } = await loadImageSelection()
  const continuePreparation = createDeferred()
  const statusChangeStarted = createDeferred()
  const { deps, state } = createSelectionHarness({
    files: [new File(['a'], 'gallery-a.jpg', { type: 'image/jpeg' })],
    prepareImage: async (file, options) => {
      state.preparedFiles.push(file.name)
      statusChangeStarted.resolve()
      await continuePreparation.promise
      options.onStatusChange?.('Optimizando imagen...')

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
  await statusChangeStarted.promise
  state.removedPendingImageIdsRef.current.add('gallery-a.jpg')
  continuePreparation.resolve()
  await selection

  assert.equal(state.pendingImages[0].processingLabel, undefined)
  assert.equal(state.pendingImages[0].status, 'processing')
  assert.deepEqual(state.revokedPreviewUrls, ['blob:prepared-gallery-a'])
})

test('handleSelectedLocationImageFiles moves a placeholder through status label updates to pending', async () => {
  const { handleSelectedLocationImageFiles } = await loadImageSelection()
  const preparedFile = new File(['prepared'], 'prepared-gallery-a.jpg', { type: 'image/jpeg' })
  const { deps, state } = createSelectionHarness({
    files: [new File(['a'], 'gallery-a.jpg', { type: 'image/jpeg' })],
    prepareImage: async (file, options) => {
      state.preparedFiles.push(file.name)
      options.onStatusChange?.('Optimizando imagen...')

      return pendingImage(options.id, {
        file: preparedFile,
        height: 720,
        isCover: options.isCover,
        originalIndex: options.originalIndex,
        previewUrl: 'blob:prepared-gallery-a',
        selectionTarget: options.target,
        status: 'pending',
        width: 1280,
      })
    },
    target: 'gallery',
  })

  await handleSelectedLocationImageFiles(deps)

  assert.deepEqual(state.processedCounts, [0, 1])
  assert.equal(state.pendingImageSnapshots.length, 3)
  assert.deepEqual(
    plain(
      state.pendingImageSnapshots.map((snapshot) => {
        const image = snapshot[0]

        return {
          errorMessage: image.errorMessage,
          height: image.height,
          id: image.id,
          originalIndex: image.originalIndex,
          previewUrl: image.previewUrl,
          processingLabel: image.processingLabel,
          status: image.status,
          width: image.width,
        }
      }),
    ),
    [
      {
        errorMessage: null,
        height: 0,
        id: 'gallery-a.jpg',
        originalIndex: 0,
        previewUrl: 'placeholder:gallery-a.jpg',
        status: 'processing',
        width: 0,
      },
      {
        errorMessage: null,
        height: 0,
        id: 'gallery-a.jpg',
        originalIndex: 0,
        previewUrl: 'placeholder:gallery-a.jpg',
        processingLabel: 'Optimizando imagen...',
        status: 'processing',
        width: 0,
      },
      {
        errorMessage: null,
        height: 720,
        id: 'gallery-a.jpg',
        originalIndex: 0,
        previewUrl: 'blob:prepared-gallery-a',
        processingLabel: null,
        status: 'pending',
        width: 1280,
      },
    ],
  )
  assert.equal(state.pendingImages[0].file, preparedFile)
  assert.equal(state.pendingImages[0].errorMessage, null)
  assert.equal(state.pendingImages[0].status, 'pending')
  assert.deepEqual(state.isPreparingImages, [true, false])
})

test('handleSelectedLocationImageFiles skips failure reporting when an image was removed before prepareImage fails', async () => {
  const { handleSelectedLocationImageFiles } = await loadImageSelection()
  const continuePreparation = createDeferred()
  const preparationStarted = createDeferred()
  const { deps, state } = createSelectionHarness({
    files: [new File(['a'], 'gallery-a.jpg', { type: 'image/jpeg' })],
    prepareImage: async (file) => {
      state.preparedFiles.push(file.name)
      preparationStarted.resolve()
      await continuePreparation.promise
      throw new Error('No pudimos preparar gallery-a.jpg')
    },
    target: 'gallery',
  })

  const selection = handleSelectedLocationImageFiles(deps)
  await preparationStarted.promise
  state.removedPendingImageIdsRef.current.add('gallery-a.jpg')
  continuePreparation.resolve()
  await selection

  assert.deepEqual(state.reportedFailures, [])
  assert.equal(state.pendingImages[0].errorMessage, null)
  assert.equal(state.pendingImages[0].status, 'processing')
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

test('retryPendingLocationImagePreparation reuses the same id and file when retry succeeds', async () => {
  const { retryPendingLocationImagePreparation } = await loadImageSelection()
  const originalFile = new File(['original'], 'retry.jpg', { type: 'image/jpeg' })
  const preparedFile = new File(['prepared'], 'retry-prepared.jpg', { type: 'image/jpeg' })
  const otherImage = pendingImage('other')
  const retryImage = pendingImage('retry-image', {
    errorMessage: 'Error anterior',
    file: originalFile,
    height: 0,
    isCover: true,
    originalIndex: 7,
    previewUrl: 'blob:retry-error-preview',
    retryable: true,
    selectionTarget: 'cover',
    status: 'error',
    width: 0,
  })
  const prepareCalls = []
  const { deps, state } = createSelectionHarness({
    initialImages: [otherImage, retryImage],
    prepareImage: async (file, options) => {
      prepareCalls.push({ file, options })

      return pendingImage(options.id, {
        file: preparedFile,
        height: 720,
        isCover: options.isCover,
        originalIndex: options.originalIndex,
        previewUrl: 'blob:retry-prepared-preview',
        selectionTarget: options.target,
        status: 'pending',
        width: 1280,
      })
    },
  })

  await retryPendingLocationImagePreparation(
    createRetryDeps(deps, state, 'retry-image'),
  )

  assert.equal(prepareCalls.length, 1)
  assert.equal(prepareCalls[0].file, originalFile)
  assert.deepEqual(
    plain({
      id: prepareCalls[0].options.id,
      isCover: prepareCalls[0].options.isCover,
      originalIndex: prepareCalls[0].options.originalIndex,
      target: prepareCalls[0].options.target,
    }),
    {
      id: 'retry-image',
      isCover: true,
      originalIndex: 7,
      target: 'cover',
    },
  )
  assert.equal(state.pendingImages.length, 2)
  assert.equal(state.pendingImages[0], otherImage)
  assert.deepEqual(
    plain(
      state.pendingImageSnapshots.map((snapshot) => {
        const image = snapshot.find((entry) => entry.id === 'retry-image')

        return {
          errorMessage: image.errorMessage,
          height: image.height,
          previewUrl: image.previewUrl,
          processingLabel: image.processingLabel,
          status: image.status,
          width: image.width,
        }
      }),
    ),
    [
      {
        errorMessage: null,
        height: 0,
        previewUrl: 'blob:retry-error-preview',
        processingLabel: null,
        status: 'processing',
        width: 0,
      },
      {
        errorMessage: null,
        height: 720,
        previewUrl: 'blob:retry-prepared-preview',
        processingLabel: null,
        status: 'pending',
        width: 1280,
      },
    ],
  )
  assert.equal(state.pendingImages[1].file, preparedFile)
  assert.equal(state.pendingImages[1].retryable, undefined)
  assert.deepEqual(state.processedCounts, [])
  assert.deepEqual(state.reportedFailures, [])
  assert.deepEqual(state.revokedPreviewUrls, ['blob:retry-error-preview'])
})

test('retryPendingLocationImagePreparation returns to error with the new message when retry fails', async () => {
  const { retryPendingLocationImagePreparation } = await loadImageSelection()
  const retryImage = pendingImage('retry-image', {
    errorMessage: 'Error anterior',
    height: 0,
    previewUrl: 'blob:retry-error-preview',
    retryable: true,
    status: 'error',
    width: 0,
  })
  const { deps, state } = createSelectionHarness({
    initialImages: [retryImage],
    prepareImage: async () => {
      throw new Error('Nuevo error de preparación')
    },
  })

  await retryPendingLocationImagePreparation(
    createRetryDeps(deps, state, 'retry-image'),
  )

  assert.deepEqual(
    plain(
      state.pendingImageSnapshots.map((snapshot) => ({
        errorMessage: snapshot[0].errorMessage,
        processingLabel: snapshot[0].processingLabel,
        retryable: snapshot[0].retryable,
        status: snapshot[0].status,
      })),
    ),
    [
      {
        errorMessage: null,
        processingLabel: null,
        status: 'processing',
      },
      {
        errorMessage: 'Nuevo error de preparación',
        processingLabel: null,
        status: 'error',
      },
    ],
  )
  assert.equal(state.pendingImages[0].retryable, undefined)
  assert.equal(state.reportedFailures.length, 1)
  assert.equal(state.reportedFailures[0].context.stage, 'images.prepare')
  assert.equal(state.retryingPendingImageIdsRef.current.size, 0)
})

test('retryPendingLocationImagePreparation does not process other images or start duplicate retries', async () => {
  const { retryPendingLocationImagePreparation } = await loadImageSelection()
  const retryImage = pendingImage('retry-image', {
    errorMessage: 'Error anterior',
    status: 'error',
  })
  const otherImage = pendingImage('other-image', {
    errorMessage: 'Otro error',
    status: 'error',
  })
  const continuePreparation = createDeferred()
  let prepareCallCount = 0
  const { deps, state } = createSelectionHarness({
    initialImages: [retryImage, otherImage],
    prepareImage: async (file, options) => {
      prepareCallCount += 1
      await continuePreparation.promise

      return pendingImage(options.id, {
        file,
        height: 480,
        isCover: options.isCover,
        originalIndex: options.originalIndex,
        previewUrl: 'blob:retry-prepared-preview',
        selectionTarget: options.target,
        status: 'pending',
        width: 640,
      })
    },
  })

  const firstRetry = retryPendingLocationImagePreparation(
    createRetryDeps(deps, state, 'retry-image'),
  )
  const secondRetry = retryPendingLocationImagePreparation(
    createRetryDeps(deps, state, 'retry-image'),
  )

  assert.equal(prepareCallCount, 1)
  continuePreparation.resolve()
  await Promise.all([firstRetry, secondRetry])

  assert.equal(prepareCallCount, 1)
  assert.equal(state.pendingImages[0].status, 'pending')
  assert.equal(state.pendingImages[1], otherImage)
  assert.deepEqual(state.processedCounts, [])
  assert.deepEqual(state.reportedFailures, [])
})

test('retryPendingLocationImagePreparation does not restore an image removed during retry and revokes the late preview', async () => {
  const { retryPendingLocationImagePreparation } = await loadImageSelection()
  const retryImage = pendingImage('retry-image', {
    errorMessage: 'Error anterior',
    previewUrl: 'blob:retry-error-preview',
    status: 'error',
  })
  const continuePreparation = createDeferred()
  const { deps, state } = createSelectionHarness({
    initialImages: [retryImage],
    prepareImage: async (file, options) => {
      await continuePreparation.promise

      return pendingImage(options.id, {
        file,
        height: 480,
        isCover: options.isCover,
        originalIndex: options.originalIndex,
        previewUrl: 'blob:late-prepared-preview',
        selectionTarget: options.target,
        status: 'pending',
        width: 640,
      })
    },
  })

  const retry = retryPendingLocationImagePreparation(
    createRetryDeps(deps, state, 'retry-image'),
  )
  assert.equal(state.pendingImages[0].status, 'processing')
  state.removedPendingImageIdsRef.current.add('retry-image')
  state.pendingImages = []
  state.pendingImagesRef.current = []
  continuePreparation.resolve()
  await retry

  assert.deepEqual(state.pendingImages, [])
  assert.deepEqual(state.revokedPreviewUrls, ['blob:late-prepared-preview'])
  assert.deepEqual(state.reportedFailures, [])
})
