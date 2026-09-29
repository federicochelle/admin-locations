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

async function flushMicrotasks(count = 5) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve()
  }
}

function createVisibilityHarness(initialState = 'visible') {
  const listeners = new Set()
  const visibility = {
    visibilityState: initialState,
    addEventListener(type, listener) {
      if (type === 'visibilitychange') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'visibilitychange') listeners.delete(listener)
    },
  }

  return {
    listenerCount: () => listeners.size,
    setVisibility(nextState) {
      visibility.visibilityState = nextState
      Array.from(listeners).forEach((listener) => listener())
    },
    visibility,
  }
}

async function setupUploadRunner(overrides = {}) {
  const h = await harness()
  const progressStates = []
  const formOverrides = {
    pendingImages: overrides.pendingImages ?? [],
    mode: overrides.mode ?? 'create',
    visiblePersistedImages: overrides.visiblePersistedImages ?? [],
    IMAGE_UPLOAD_CONCURRENCY: overrides.imageUploadConcurrency ?? 3,
    IMAGE_UPLOAD_TIMEOUT_MS: overrides.imageUploadTimeoutMs ?? 180_000,
    IMAGE_UPLOAD_TIMEOUT_ERROR_MESSAGE:
      overrides.imageUploadTimeoutErrorMessage ??
      'La subida tardó demasiado y fue cancelada. Intenta nuevamente.',
    uploadLocationImage: overrides.uploadLocationImage ?? (async () => {}),
    document: overrides.visibility ?? { visibilityState: 'visible' },
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
  assert.deepEqual(uploadedIds.sort(), [
    'failed.jpg',
    'failed.jpg',
    'failed.jpg',
    'first.jpg',
    'last.jpg',
  ])
  assert.deepEqual(
    form.state.pending.map((image) => image.status),
    ['done', 'error', 'done'],
  )
  assert.equal(form.state.pending[1].errorMessage, 'No pudimos subir failed.jpg')
  assert.equal(reportedFailures.length, 1)
})

test('runPendingImageUploads sends the pending image id as the client upload id', async () => {
  const pendingImages = [
    pendingImage('11111111-1111-4111-8111-111111111111', { originalIndex: 0 }),
    pendingImage('22222222-2222-4222-8222-222222222222', { originalIndex: 1 }),
  ]
  const uploadedClientIds = []
  const { form } = await setupUploadRunner({
    pendingImages,
    uploadLocationImage: async ({ clientUploadId }) => {
      uploadedClientIds.push(clientUploadId)
    },
  })

  const result = await form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })

  assert.equal(result, null)
  assert.deepEqual(uploadedClientIds.sort(), [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ])
})

test('runPendingImageUploads does not start queued uploads while hidden', async () => {
  const visibility = createVisibilityHarness('hidden')
  const startedUploads = []
  const { form } = await setupUploadRunner({
    imageUploadConcurrency: 1,
    pendingImages: [pendingImage('first'), pendingImage('second')],
    uploadLocationImage: async ({ file }) => {
      startedUploads.push(file.name)
    },
    visibility: visibility.visibility,
  })

  const upload = form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })
  await flushMicrotasks()

  assert.deepEqual(startedUploads, [])
  visibility.setVisibility('visible')

  const result = await upload

  assert.equal(result, null)
  assert.deepEqual(startedUploads, ['first.jpg', 'second.jpg'])
  assert.equal(visibility.listenerCount(), 0)
})

test('runPendingImageUploads does not abort an active upload only because the page becomes hidden', async () => {
  const visibility = createVisibilityHarness('visible')
  const activeUpload = createDeferred()
  let activeSignal
  const { form } = await setupUploadRunner({
    pendingImages: [pendingImage('active')],
    uploadLocationImage: async ({ signal }) => {
      activeSignal = signal
      return activeUpload.promise
    },
    visibility: visibility.visibility,
  })

  const upload = form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })
  await flushMicrotasks()

  visibility.setVisibility('hidden')

  assert.equal(activeSignal.aborted, false)
  activeUpload.resolve()

  const result = await upload

  assert.equal(result, null)
  assert.equal(activeSignal.aborted, false)
})

test('runPendingImageUploads pauses the queue while hidden and continues when visible again', async () => {
  const visibility = createVisibilityHarness('visible')
  const firstUpload = createDeferred()
  const startedUploads = []
  const { form } = await setupUploadRunner({
    imageUploadConcurrency: 1,
    pendingImages: [pendingImage('first'), pendingImage('second')],
    uploadLocationImage: async ({ file }) => {
      startedUploads.push(file.name)
      if (file.name === 'first.jpg') {
        return firstUpload.promise
      }
    },
    visibility: visibility.visibility,
  })

  const upload = form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })
  await flushMicrotasks()

  assert.deepEqual(startedUploads, ['first.jpg'])
  visibility.setVisibility('hidden')
  firstUpload.resolve()
  await flushMicrotasks()

  assert.deepEqual(startedUploads, ['first.jpg'])
  visibility.setVisibility('visible')

  const result = await upload

  assert.equal(result, null)
  assert.deepEqual(startedUploads, ['first.jpg', 'second.jpg'])
})

test('runPendingImageUploads retries a backgrounded active attempt when returning visible', async () => {
  const visibility = createVisibilityHarness('visible')
  const secondUpload = createDeferred()
  const signals = []
  const { form } = await setupUploadRunner({
    pendingImages: [pendingImage('stalled')],
    uploadLocationImage: ({ signal }) => {
      signals.push(signal)
      if (signals.length === 2) {
        return secondUpload.promise
      }

      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason))
      })
    },
    visibility: visibility.visibility,
  })

  const upload = form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })
  await flushMicrotasks()

  visibility.setVisibility('hidden')
  assert.equal(signals[0].aborted, false)
  visibility.setVisibility('visible')
  await flushMicrotasks()

  assert.equal(signals.length, 2)
  assert.equal(signals[0].aborted, true)
  assert.equal(signals[1].aborted, false)

  secondUpload.resolve()
  const result = await upload

  assert.equal(result, null)
  assert.equal(form.state.pending[0].status, 'done')
})

test('runPendingImageUploads does not count a background recycle as a network attempt', async () => {
  const visibility = createVisibilityHarness('visible')
  const signals = []
  let uploadCalls = 0
  const { form } = await setupUploadRunner({
    pendingImages: [pendingImage('background-budget')],
    uploadLocationImage: ({ signal }) => {
      uploadCalls += 1
      signals.push(signal)

      if (uploadCalls === 1) {
        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason))
        })
      }

      if (uploadCalls < 4) {
        throw new Error(`Network failed ${uploadCalls}`)
      }
    },
    visibility: visibility.visibility,
  })

  const upload = form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })
  await flushMicrotasks()

  visibility.setVisibility('hidden')
  visibility.setVisibility('visible')
  await flushMicrotasks()

  const result = await upload

  assert.equal(result, null)
  assert.equal(uploadCalls, 4)
  assert.equal(new Set(signals).size, 4)
  assert.equal(form.state.pending[0].status, 'done')
})

test('runPendingImageUploads preserves all three network attempts after two background recycles', async () => {
  const visibility = createVisibilityHarness('visible')
  const signals = []
  let uploadCalls = 0
  const { form } = await setupUploadRunner({
    pendingImages: [pendingImage('two-backgrounds')],
    uploadLocationImage: ({ signal }) => {
      uploadCalls += 1
      signals.push(signal)

      if (uploadCalls <= 2) {
        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason))
        })
      }

      if (uploadCalls < 5) {
        throw new Error(`Network failed ${uploadCalls}`)
      }
    },
    visibility: visibility.visibility,
  })

  const upload = form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })
  await flushMicrotasks()

  for (let index = 0; index < 2; index += 1) {
    visibility.setVisibility('hidden')
    visibility.setVisibility('visible')
    await flushMicrotasks()
  }

  const result = await upload

  assert.equal(result, null)
  assert.equal(uploadCalls, 5)
  assert.equal(new Set(signals).size, 5)
  assert.equal(form.state.pending[0].status, 'done')
})

test('runPendingImageUploads does not duplicate retries when visible fires more than once', async () => {
  const visibility = createVisibilityHarness('visible')
  const secondUpload = createDeferred()
  const signals = []
  const { form } = await setupUploadRunner({
    pendingImages: [pendingImage('dedupe')],
    uploadLocationImage: ({ signal }) => {
      signals.push(signal)
      if (signals.length === 2) {
        return secondUpload.promise
      }

      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason))
      })
    },
    visibility: visibility.visibility,
  })

  const upload = form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })
  await flushMicrotasks()

  visibility.setVisibility('hidden')
  visibility.setVisibility('visible')
  visibility.setVisibility('visible')
  await flushMicrotasks()

  assert.equal(signals.length, 2)

  secondUpload.resolve()
  const result = await upload

  assert.equal(result, null)
})

test('runPendingImageUploads stops after five background recycles without dropping the pending image', async () => {
  const visibility = createVisibilityHarness('visible')
  const signals = []
  const { form } = await setupUploadRunner({
    pendingImages: [pendingImage('background-loop')],
    uploadLocationImage: ({ signal }) => {
      signals.push(signal)
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason))
      })
    },
    visibility: visibility.visibility,
  })

  const upload = form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })
  await flushMicrotasks()

  for (let index = 0; index < 6; index += 1) {
    visibility.setVisibility('hidden')
    visibility.setVisibility('visible')
    await flushMicrotasks()
  }

  const result = await upload

  assert.equal(
    result,
    'La locacion fue creada, pero algunas imagenes no se pudieron subir. Revisalas y volve a intentar.',
  )
  assert.equal(signals.length, 6)
  assert.equal(new Set(signals).size, 6)
  assert.equal(form.state.pending.length, 1)
  assert.equal(form.state.pending[0].previewUrl, 'blob:background-loop')
  assert.equal(form.state.pending[0].status, 'error')
  assert.equal(
    form.state.pending[0].errorMessage,
    'No pudimos reanudar la subida al volver a la app. Volve a intentar.',
  )
})

test('runPendingImageUploads aborts each timed-out attempt with a fresh signal', async () => {
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
  await flushMicrotasks()

  assert.equal(timeoutCallbacks.length, 1)
  assert.equal(timeoutCallbacks[0].timeoutMs, 10)
  timeoutCallbacks[0].callback()
  await flushMicrotasks()

  assert.equal(timeoutCallbacks.length, 2)
  assert.equal(timeoutCallbacks[1].timeoutMs, 10)
  timeoutCallbacks[1].callback()
  await flushMicrotasks()

  assert.equal(timeoutCallbacks.length, 3)
  assert.equal(timeoutCallbacks[2].timeoutMs, 10)
  timeoutCallbacks[2].callback()

  const result = await upload

  assert.equal(
    result,
    'La locacion fue creada, pero algunas imagenes no se pudieron subir. Revisalas y volve a intentar.',
  )
  assert.equal(abortedSignals.length, 3)
  assert.equal(new Set(abortedSignals).size, 3)
  assert.equal(form.state.pending[0].status, 'error')
  assert.equal(
    form.state.pending[0].errorMessage,
    'La subida tardó demasiado y fue cancelada. Intenta nuevamente.',
  )
  assert.deepEqual(clearedTimeouts, [1, 2, 3])
})

test('runPendingImageUploads retries a failed image with a new upload operation', async () => {
  const pendingImages = [pendingImage('flaky')]
  const signals = []
  let attempts = 0
  const { form } = await setupUploadRunner({
    pendingImages,
    uploadLocationImage: async ({ signal }) => {
      attempts += 1
      signals.push(signal)

      if (attempts < 3) {
        throw new Error(`Upload failed ${attempts}`)
      }
    },
  })

  const result = await form.runPendingImageUploads('location-1', {
    correlationId: 'correlation-1',
  })

  assert.equal(result, null)
  assert.equal(attempts, 3)
  assert.equal(new Set(signals).size, 3)
  assert.equal(signals.every((signal) => signal.aborted === false), true)
  assert.equal(form.state.pending[0].status, 'done')
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
