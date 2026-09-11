import test from 'node:test'
import assert from 'node:assert/strict'
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { harness, locationId } from './harness.mjs'

const faces = [{ confidence: 0.98, boundingBox: { x: 1, y: 2, width: 3, height: 4 } }]
const scenarios = [
  { name: 'successful detection with a face', faces, blurred: true },
  { name: 'successful detection without faces', faces: [] },
  {
    name: 'FunctionsFetchError',
    detectionError: () => new FunctionsFetchError(new TypeError('Failed to fetch')),
    stage: 'images.detect',
  },
  {
    name: 'Google Vision error',
    detectionError: () => new Error('Google Cloud Vision returned an unexpected error.', {
      cause: new FunctionsHttpError(new Response(null, { status: 502 })),
    }),
    stage: 'images.detect',
  },
  { name: 'blur error after successful detection', faces, blurError: true, stage: 'images.blur' },
  { name: 'non-Error detection rejection', detectionError: () => 'unexpected failure', stage: 'images.detect' },
]

async function prepareScenario(t, scenario) {
  const original = new File(['original'], 'private.jpg', { type: 'image/jpeg' })
  const optimized = new File(['optimized'], 'private.jpg', { type: 'image/jpeg' })
  const blurred = new File(['blurred'], 'private.jpg', { type: 'image/jpeg' })
  let blurCalls = 0
  const h = await harness({
    prepare: async file => {
      assert.equal(file, original)
      return { file: optimized, outputDimensions: { width: 640, height: 480 } }
    },
    detect: async file => {
      assert.equal(file, optimized)
      if (scenario.detectionError) throw scenario.detectionError()
      return { faces: scenario.faces, summary: { faces: scenario.faces.length } }
    },
    blur: async (file, detectedFaces) => {
      blurCalls++
      assert.equal(file, optimized)
      assert.equal(detectedFaces, faces)
      if (scenario.blurError) throw new Error('Blur failed')
      return blurred
    },
  })
  const selection = await h.module('src/features/locations/location-image-selection')
  const image = await selection.preparePendingLocationImage(original, {
    id: 'image', isCover: true, originalIndex: 0, target: 'cover',
  })
  t.after(() => URL.revokeObjectURL(image.previewUrl))
  assert.equal(image.file, scenario.blurred ? blurred : optimized)
  assert.equal(image.status, 'pending')
  assert.equal(image.errorMessage, null)
  assert.equal(image.width, 640)
  assert.equal(image.height, 480)
  assert.equal(blurCalls, scenario.faces?.length ? 1 : 0)
  assert.equal(h.events.length, scenario.stage ? 1 : 0)
  if (scenario.stage) {
    const recorded = h.events[0]
    assert.equal(recorded.scope.tags.stage, scenario.stage)
    assert.equal(recorded.scope.tags.provider, scenario.stage === 'images.blur' ? 'browser' : 'google_vision')
    assert.equal(recorded.scope.level, 'warning')
    const sanitized = h.reporting.sanitizeAdminSentryEvent({
      ...recorded.scope,
      exception: { values: [{ type: 'Error', value: 'private diagnostic' }] },
    })
    assert.equal(sanitized.contexts.admin_operation.fallback_used, true)
    assert.equal(sanitized.tags.stage, scenario.stage)
    assert.equal(JSON.stringify(sanitized).includes('private'), false)
  }
  return { h, image }
}

for (const scenario of scenarios) {
  test(`${scenario.name}: image remains ready for upload`, async t => {
    await prepareScenario(t, scenario)
  })

  for (const mode of ['create', 'edit']) {
    test(`${scenario.name}: actual form can ${mode} and upload the image`, async t => {
      const { h, image } = await prepareScenario(t, scenario)
      const reportsBeforeSave = h.events.length
      let saves = 0
      let uploads = 0
      let markedSaved = false
      const save = async () => { saves++; return locationId }
      const form = await h.formHandlers({
        mode,
        locationId: mode === 'edit' ? locationId : undefined,
        pendingImages: [image],
        createLocation: save,
        updateLocation: save,
        protection: { markIncomplete() {}, markSaved() { markedSaved = true } },
        uploadLocationImage: async options => {
          uploads++
          assert.equal(options.file, image.file)
          assert.equal(options.locationId, locationId)
        },
      })
      await form.handleSubmit({ preventDefault() {} })
      assert.equal(saves, 1)
      assert.equal(uploads, 1)
      assert.equal(image.status, 'done')
      assert.equal(form.state.submitError, null)
      assert.equal(form.state.pending.length, 0)
      assert.equal(form.state.validations.length, 0)
      assert.equal(form.state.navigation[0], '/locations')
      assert.equal(markedSaved, true)
      assert.equal(h.events.length, reportsBeforeSave)
    })
  }
}

test('optimization failure still rejects before detection', async () => {
  const failure = new Error('Cannot optimize image')
  let detections = 0
  const h = await harness({
    prepare: async () => { throw failure },
    detect: async () => { detections++ },
  })
  const selection = await h.module('src/features/locations/location-image-selection')
  await assert.rejects(selection.preparePendingLocationImage(
    new File(['x'], 'image.jpg', { type: 'image/jpeg' }),
    { id: 'image', isCover: true, originalIndex: 0, target: 'cover' },
  ), error => error === failure)
  assert.equal(detections, 0)
  assert.equal(h.events.length, 0)
})

test('hung detection times out as best-effort fallback and keeps the image ready', async t => {
  const original = new File(['original'], 'private.jpg', { type: 'image/jpeg' })
  const optimized = new File(['optimized'], 'private.jpg', { type: 'image/jpeg' })
  const h = await harness({
    prepare: async file => {
      assert.equal(file, original)
      return { file: optimized, outputDimensions: { width: 640, height: 480 } }
    },
    detect: async file => {
      assert.equal(file, optimized)
      return new Promise(() => {})
    },
  })
  h.context.__LOCATION_IMAGE_DETECT_TIMEOUT_MS__ = 10
  const selection = await h.module('src/features/locations/location-image-selection')

  const image = await selection.preparePendingLocationImage(original, {
    id: 'image',
    isCover: true,
    originalIndex: 2,
    target: 'cover',
  })

  t.after(() => URL.revokeObjectURL(image.previewUrl))
  assert.equal(image.file, optimized)
  assert.equal(image.status, 'pending')
  assert.equal(image.errorMessage, null)
  assert.equal(h.events.length, 1)
  const recorded = h.events[0]
  assert.equal(recorded.scope.tags.stage, 'images.detect')
  assert.equal(recorded.scope.tags.provider, 'google_vision')
  assert.equal(recorded.scope.tags.outcome, 'partial')
  assert.equal(recorded.scope.level, 'warning')
  assert.equal(recorded.scope.contexts.admin_operation.fallback_used, true)
  assert.equal(recorded.scope.contexts.admin_operation.timeout_ms, 10)
})

test('hung automatic blur times out as best-effort fallback and keeps the image ready', async t => {
  const original = new File(['original'], 'private.jpg', { type: 'image/jpeg' })
  const optimized = new File(['optimized'], 'private.jpg', { type: 'image/jpeg' })
  const h = await harness({
    prepare: async file => {
      assert.equal(file, original)
      return { file: optimized, outputDimensions: { width: 640, height: 480 } }
    },
    detect: async file => {
      assert.equal(file, optimized)
      return { faces, summary: { faces: faces.length } }
    },
    blur: async (file, detectedFaces) => {
      assert.equal(file, optimized)
      assert.equal(detectedFaces, faces)
      return new Promise(() => {})
    },
  })
  h.context.__LOCATION_IMAGE_BLUR_TIMEOUT_MS__ = 10
  const selection = await h.module('src/features/locations/location-image-selection')

  const image = await selection.preparePendingLocationImage(original, {
    id: 'image',
    isCover: true,
    originalIndex: 3,
    target: 'cover',
  })

  t.after(() => URL.revokeObjectURL(image.previewUrl))
  assert.equal(image.file, optimized)
  assert.equal(image.status, 'pending')
  assert.equal(image.errorMessage, null)
  assert.equal(h.events.length, 1)
  const recorded = h.events[0]
  assert.equal(recorded.scope.tags.stage, 'images.blur')
  assert.equal(recorded.scope.tags.provider, 'browser')
  assert.equal(recorded.scope.tags.outcome, 'partial')
  assert.equal(recorded.scope.level, 'warning')
  assert.equal(recorded.scope.contexts.admin_operation.fallback_used, true)
  assert.equal(recorded.scope.contexts.admin_operation.timeout_ms, 10)
})
