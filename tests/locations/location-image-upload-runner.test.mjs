import assert from 'node:assert/strict'
import test from 'node:test'
import { harness } from '../observability/harness.mjs'

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
    errorMessage: null,
    ...overrides,
  }
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

async function setupUploadRunner(overrides = {}) {
  const h = await harness()
  const progressStates = []
  const formOverrides = {
    pendingImages: overrides.pendingImages ?? [],
    mode: overrides.mode ?? 'create',
    visiblePersistedImages: overrides.visiblePersistedImages ?? [],
    IMAGE_UPLOAD_CONCURRENCY: overrides.imageUploadConcurrency ?? 3,
    IMAGE_UPLOAD_TIMEOUT_MS: overrides.imageUploadTimeoutMs ?? 90_000,
    IMAGE_UPLOAD_TIMEOUT_ERROR_MESSAGE:
      overrides.imageUploadTimeoutErrorMessage ??
      'La subida tardó demasiado y fue cancelada. Intenta nuevamente.',
    uploadLocationImage: overrides.uploadLocationImage ?? (async () => {}),
    window: overrides.window ?? { setTimeout, clearTimeout },
    updateSaveProgress: (updater) => {
      h.context.saveProgress = updater(h.context.saveProgress)
      progressStates.push(structuredClone(h.context.saveProgress))
    },
    setSaveProgressError: (stage, message) => {
      h.context.saveProgress = {
        ...h.context.saveProgress,
        errorMessage: message,
        errorStage: stage,
      }
    },
    updateStageStatus: (stage, status) => {
      h.context.stageStatuses.push({ stage, status })
    },
  }

  if (overrides.reportLocationFailure) {
    formOverrides.reportLocationFailure = overrides.reportLocationFailure
  }

  const form = await h.formHandlers(formOverrides)

  h.context.saveProgress = {
    errorMessage: null,
    stages: [],
    uploadingDone: 0,
    uploadingTotal: overrides.uploadingTotal ?? form.state.pending.length,
    uploadingCurrentIndex: null,
    uploadingCurrentName: null,
    uploadingCurrentStep: null,
  }
  h.context.stageStatuses = []

  return { form, h, progressStates }
}

test('runPendingImageUploads respects the configured concurrency limit exactly', async () => {
  const pendingImages = Array.from({ length: 5 }, (_, index) =>
    pendingImage(`image-${index}`, { originalIndex: index }),
  )
  let activeUploads = 0
  let maxActiveUploads = 0
  const startedUploads = []
  const { form } = await setupUploadRunner({
    imageUploadConcurrency: 2,
    pendingImages,
    uploadLocationImage: async ({ file }) => {
      startedUploads.push(file.name)
      activeUploads += 1
      maxActiveUploads = Math.max(maxActiveUploads, activeUploads)
      await new Promise((resolve) => setTimeout(resolve, 0))
      activeUploads -= 1
    },
  })

  const result = await form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })

  assert.equal(result, null)
  assert.equal(maxActiveUploads, 2)
  assert.deepEqual(startedUploads.sort(), [
    'image-0.jpg',
    'image-1.jpg',
    'image-2.jpg',
    'image-3.jpg',
    'image-4.jpg',
  ])
  assert.equal(form.state.pending.every((image) => image.status === 'done'), true)
})

test('runPendingImageUploads keeps uploading after one image fails', async () => {
  const pendingImages = [
    pendingImage('first', { originalIndex: 0 }),
    pendingImage('failed', { originalIndex: 1 }),
    pendingImage('last', { originalIndex: 2 }),
  ]
  const uploadedIds = []
  const reportedFailures = []
  const { form } = await setupUploadRunner({
    imageUploadConcurrency: 2,
    pendingImages,
    reportLocationFailure: (error, context) => {
      reportedFailures.push({ context, error })
    },
    uploadLocationImage: async ({ file }) => {
      uploadedIds.push(file.name)

      if (file.name === 'failed.jpg') {
        throw new Error('No pudimos subir failed.jpg')
      }
    },
  })

  const result = await form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })

  assert.equal(
    result,
    'La locacion fue creada, pero algunas imagenes no se pudieron subir. Revisalas y volve a intentar.',
  )
  assert.deepEqual(uploadedIds.sort(), ['failed.jpg', 'first.jpg', 'last.jpg'])
  assert.deepEqual(
    form.state.pending.map((image) => image.status),
    ['done', 'error', 'done'],
  )
  assert.equal(form.state.pending[1].errorMessage, 'No pudimos subir failed.jpg')
  assert.equal(reportedFailures.length, 1)
})

test('runPendingImageUploads aborts the matching upload on timeout', async () => {
  const timeoutCallbacks = []
  const clearedTimeouts = []
  const abortedSignals = []
  const { form } = await setupUploadRunner({
    imageUploadTimeoutMs: 10,
    pendingImages: [pendingImage('slow')],
    uploadLocationImage: ({ signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          abortedSignals.push(signal)
          reject(signal.reason)
        })
      }),
    window: {
      setTimeout(callback, timeoutMs) {
        timeoutCallbacks.push({ callback, timeoutMs })
        return timeoutCallbacks.length
      },
      clearTimeout(timeoutId) {
        clearedTimeouts.push(timeoutId)
      },
    },
  })

  const upload = form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })
  await Promise.resolve()

  assert.equal(timeoutCallbacks.length, 1)
  assert.equal(timeoutCallbacks[0].timeoutMs, 10)
  timeoutCallbacks[0].callback()

  const result = await upload

  assert.equal(
    result,
    'La locacion fue creada, pero algunas imagenes no se pudieron subir. Revisalas y volve a intentar.',
  )
  assert.equal(abortedSignals.length, 1)
  assert.equal(form.state.pending[0].status, 'error')
  assert.equal(
    form.state.pending[0].errorMessage,
    'La subida tardó demasiado y fue cancelada. Intenta nuevamente.',
  )
  assert.deepEqual(clearedTimeouts, [1])
})

test('runPendingImageUploads status changes update only the target image', async () => {
  let firstStatusChange
  const { form } = await setupUploadRunner({
    imageUploadConcurrency: 1,
    pendingImages: [
      pendingImage('first', { originalIndex: 0 }),
      pendingImage('second', { originalIndex: 1 }),
    ],
    uploadLocationImage: async ({ file, onStatusChange }) => {
      if (file.name === 'first.jpg') {
        firstStatusChange = onStatusChange
        onStatusChange('finalizing')
        assert.deepEqual(
          form.state.pending.map((image) => image.status),
          ['finalizing', 'pending'],
        )
      }
    },
  })

  await form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })

  assert.equal(typeof firstStatusChange, 'function')
  assert.deepEqual(
    form.state.pending.map((image) => image.status),
    ['done', 'done'],
  )
})

test('runPendingImageUploads reports current upload step as uploading and finalizing', async () => {
  const { form, progressStates } = await setupUploadRunner({
    pendingImages: [pendingImage('first')],
    uploadLocationImage: async ({ onStatusChange }) => {
      onStatusChange('finalizing')
    },
  })

  await form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })

  assert.deepEqual(
    progressStates.map((state) => state.uploadingCurrentStep),
    [null, 'uploading', 'finalizing', null],
  )
  assert.deepEqual(
    progressStates.map((state) => state.uploadingDone),
    [0, 0, 0, 1],
  )
})

test('runPendingImageUploads returns partial upload messages by mode', async () => {
  for (const [mode, expectedMessage] of [
    [
      'create',
      'La locacion fue creada, pero algunas imagenes no se pudieron subir. Revisalas y volve a intentar.',
    ],
    [
      'edit',
      'Los cambios de la locacion fueron guardados, pero algunas imagenes no se pudieron subir. Revisalas y volve a intentar.',
    ],
  ]) {
    const { form } = await setupUploadRunner({
      mode,
      pendingImages: [pendingImage(`failed-${mode}`)],
      uploadLocationImage: async () => {
        throw new Error('Upload failed')
      },
    })

    const result = await form.runPendingImageUploads('location-1', {
      correlationId: 'correlation-1',
    })

    assert.equal(result, expectedMessage)
  }
})
