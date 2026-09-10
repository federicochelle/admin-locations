import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
import { harness } from '../observability/harness.mjs'

const nativeMessage = 'Cannot decode the data in the argument to createImageBitmap'
const friendlyMessage = 'No pudimos procesar esta imagen. Probá con otra imagen o guardala nuevamente como JPG.'

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

async function setup({
  bitmap = 'reject',
  bitmapDeferred,
  dimensions = { width: 3200, height: 1600 },
  htmlFails = () => false,
  htmlHangs = false,
  drawFails = false,
} = {}) {
  const created = [], revoked = [], drawn = [], calls = [], images = []
  let closes = 0
  let optimizer
  const h = await harness({ prepare: file => optimizer.optimizeLocationImageFile(file) })
  const urls = new Map()
  const source = { ...dimensions, close() { closes++ } }
  const createImageBitmap = async (file, options) => {
    calls.push({ file, options })
    if (bitmapDeferred) return bitmapDeferred.promise
    if (bitmap === 'pending') return new Promise(() => {})
    if (bitmap === 'reject') throw new DOMException(nativeMessage, 'InvalidStateError')
    return source
  }
  Object.assign(h.context, {
    performance,
    console: { log() {}, warn() {}, error() {} },
    window: bitmap === 'absent' ? {} : { createImageBitmap },
    URL: {
      createObjectURL(file) {
        const url = `blob:test-${created.length}`
        created.push(url)
        urls.set(url, file)
        return url
      },
      revokeObjectURL(url) { revoked.push(url); urls.delete(url) },
    },
    Image: class {
      naturalWidth = dimensions.width
      naturalHeight = dimensions.height
      onload = null
      onerror = null
      _src = ''
      constructor() {
        images.push(this)
      }
      get src() {
        return this._src
      }
      set src(url) {
        this._src = url
        if (url === '') return
        if (htmlHangs) return
        queueMicrotask(() => htmlFails(urls.get(url)) ? this.onerror?.() : this.onload?.())
      }
    },
    document: {
      createElement(tag) {
        assert.equal(tag, 'canvas')
        return {
          width: 0, height: 0,
          getContext() { return { drawImage(...args) {
            drawn.push(args)
            if (drawFails) throw new Error('Canvas draw failed')
          } } },
          toBlob(callback, mime) { callback(new Blob(['encoded jpeg'], { type: mime })) },
        }
      },
    },
  })
  const decoder = await h.module('src/features/images/decode-image')
  optimizer = await h.module('src/features/locations/location-image-optimizer')
  return { h, decoder, optimizer, created, revoked, drawn, calls, images, closes: () => closes }
}

const file = (name = 'IMG_4836.jpeg', large = false) => new File(
  [large ? new Uint8Array(2 * 1024 * 1024) : 'jpeg bytes'], name, { type: 'image/jpeg' },
)

const sizedFile = (name, size) => new File(
  [new Uint8Array(size)], name, { type: 'image/jpeg' },
)

test('bitmap success returns dimensions and closes exactly once', async () => {
  const s = await setup({ bitmap: 'success' })
  const input = file()
  const decoded = await s.decoder.decodeImage(input)
  assert.equal(decoded.width, 3200)
  assert.equal(decoded.height, 1600)
  assert.equal(decoded.path, 'createImageBitmap')
  assert.equal(s.calls[0].file, input)
  assert.equal(s.calls[0].options.imageOrientation, 'from-image')
  decoded.release(); decoded.release()
  assert.equal(s.closes(), 1)
  assert.equal(s.created.length, 0)
})

for (const bitmap of ['reject', 'absent']) {
  test(`${bitmap}: HTMLImageElement fallback provides dimensions and releases URL`, async () => {
    const s = await setup({ bitmap })
    const dimensions = await s.decoder.readImageFileDimensions(file())
    assert.equal(dimensions.width, 3200)
    assert.equal(dimensions.height, 1600)
    assert.equal(dimensions.path, 'fallbackImage')
    assert.deepEqual(s.revoked, s.created)
    assert.equal(s.created.length, 1)
  })
}

test('hung createImageBitmap times out and uses HTMLImageElement fallback', async () => {
  const s = await setup({ bitmap: 'pending' })
  s.h.context.__LOCATION_IMAGE_DECODE_TIMEOUT_MS__ = 10

  const dimensions = await s.decoder.readImageFileDimensions(file())

  assert.equal(dimensions.width, 3200)
  assert.equal(dimensions.height, 1600)
  assert.equal(dimensions.path, 'fallbackImage')
  assert.deepEqual(s.revoked, s.created)
})

test('late createImageBitmap result is closed after timeout fallback wins', async () => {
  const bitmapDeferred = createDeferred()
  const s = await setup({ bitmapDeferred })
  s.h.context.__LOCATION_IMAGE_DECODE_TIMEOUT_MS__ = 10

  const dimensions = await s.decoder.readImageFileDimensions(file())

  assert.equal(dimensions.path, 'fallbackImage')
  assert.equal(s.closes(), 0)
  bitmapDeferred.resolve({ width: 3200, height: 1600, close() { s.h.context.__lateBitmapCloses = (s.h.context.__lateBitmapCloses ?? 0) + 1 } })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(s.h.context.__lateBitmapCloses, 1)
  assert.equal(s.closes(), 0)
  assert.deepEqual(s.revoked, s.created)
})

test('hung HTMLImageElement fallback times out with friendly message and URL cleanup', async () => {
  const s = await setup({ bitmap: 'absent', htmlHangs: true })
  s.h.context.__LOCATION_IMAGE_DECODE_TIMEOUT_MS__ = 10

  await assert.rejects(s.decoder.decodeImage(file()), error => {
    assert.equal(error.message, friendlyMessage)
    assert.equal(error.cause?.errors?.[1]?.name, 'AdminOperationTimeoutError')
    assert.equal(error.cause?.errors?.[1]?.timeoutMs, 10)
    return true
  })
  assert.deepEqual(s.revoked, s.created)
})

test('hung HTMLImageElement fallback clears handlers and src before late load', async () => {
  const s = await setup({ bitmap: 'absent', htmlHangs: true })
  s.h.context.__LOCATION_IMAGE_DECODE_TIMEOUT_MS__ = 10

  await assert.rejects(s.decoder.decodeImage(file()), { message: friendlyMessage })

  assert.equal(s.images.length, 1)
  const image = s.images[0]
  assert.equal(image.onload, null)
  assert.equal(image.onerror, null)
  assert.equal(image.src, '')
  assert.deepEqual(s.revoked, s.created)
  image.onload?.()
  assert.deepEqual(s.revoked, s.created)
})

test('fallback URL stays alive until source is consumed; release is idempotent', async () => {
  const s = await setup()
  const decoded = await s.decoder.decodeImage(file())
  assert.equal(s.revoked.length, 0)
  decoded.release(); decoded.release()
  assert.deepEqual(s.revoked, s.created)
})

test('both decoders fail: friendly message and URL cleanup', async () => {
  const s = await setup({ htmlFails: () => true })
  await assert.rejects(s.decoder.decodeImage(file()), error => {
    assert.equal(error.message, friendlyMessage)
    assert.equal(error.message.includes(nativeMessage), false)
    return true
  })
  assert.deepEqual(s.revoked, s.created)
})

test('Safari fallback continues resize and JPEG compression', async () => {
  const s = await setup()
  const result = await s.optimizer.optimizeLocationImageFile(file(undefined, true))
  assert.equal(result.file.type, 'image/jpeg')
  assert.equal(await result.file.text(), 'encoded jpeg')
  assert.equal(result.wasOptimized, true)
  assert.equal(result.outputDimensions.width, 2400)
  assert.equal(result.outputDimensions.height, 1200)
  assert.equal(result.perf.path, 'fallbackImage')
  assert.equal(s.drawn.length, 1)
  assert.deepEqual(s.revoked, s.created)
})

test('optimizes by file size or dimensions and skips canvas only when both are within limits', async () => {
  const cases = [
    { dimensions: { width: 800, height: 600 }, size: 500 * 1024, optimized: false, output: { width: 800, height: 600 } },
    { dimensions: { width: 1920, height: 1080 }, size: 2 * 1024 * 1024, optimized: true, output: { width: 1920, height: 1080 } },
    { dimensions: { width: 4032, height: 3024 }, size: Math.round(1.2 * 1024 * 1024), optimized: true, output: { width: 2400, height: 1800 } },
    { dimensions: { width: 6000, height: 4000 }, size: Math.round(1.4 * 1024 * 1024), optimized: true, output: { width: 2400, height: 1600 } },
    { dimensions: { width: 4032, height: 3024 }, size: 6 * 1024 * 1024, optimized: true, output: { width: 2400, height: 1800 } },
  ]

  for (const [index, testCase] of cases.entries()) {
    const s = await setup({ dimensions: testCase.dimensions })
    const result = await s.optimizer.optimizeLocationImageFile(
      sizedFile(`case-${index}.jpeg`, testCase.size),
    )

    assert.equal(result.wasOptimized, testCase.optimized)
    assert.equal(result.outputDimensions.width, testCase.output.width)
    assert.equal(result.outputDimensions.height, testCase.output.height)
    assert.equal(s.drawn.length, testCase.optimized ? 1 : 0)
    assert.deepEqual(s.revoked, s.created)
  }
})

for (const bitmap of ['success', 'reject']) {
  test(`${bitmap}: releases source even when canvas drawing throws`, async () => {
    const s = await setup({ bitmap, drawFails: true })
    await assert.rejects(s.optimizer.optimizeLocationImageFile(file(undefined, true)), /Canvas draw failed/)
    if (bitmap === 'success') assert.equal(s.closes(), 1)
    else assert.deepEqual(s.revoked, s.created)
  })
}

test('actual LocationForm batch keeps failures on their image and processes the others', async () => {
  const s = await setup({ htmlFails: input => input.name === 'bad.jpeg' })
  const selection = await s.h.module('src/features/locations/location-image-selection')
  const applicationSelection = await s.h.module('src/features/locations/application/location-image-selection')
  const source = await fs.readFile('src/features/locations/LocationForm.tsx', 'utf8')
  const ast = ts.createSourceFile('LocationForm.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const names = new Set([
    'handleSelectedImageFiles',
    'renderImageFeedback',
    'handleRemovePendingImage',
    'revokePreviewUrl',
  ])
  const declarations = []
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) declarations.push('export ' + node.getText(ast))
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.equal(declarations.length, names.size)
  let images = []
  const context = s.h.context
  Object.assign(context, selection, applicationSelection, s.h.reporting, {
    isReadOnly: false, isMountedRef: { current: true }, pendingImagesRef: { current: [] },
    removedPendingImageIdsRef: { current: new Set() }, IMAGE_PREPARATION_CONCURRENCY: 3,
    imageValidationErrors: [],
    setTotalImagesToProcess() {}, setProcessedImagesCount() {}, setIsPreparingImages() {},
    setEditDeleteErrorMessage() {}, setImageSelectionTarget() {},
    setImageValidationErrors(value) { context.imageValidationErrors = value },
    setPendingImages(updater) { images = updater(images); context.pendingImagesRef.current = images },
    getNextPendingImageOriginalIndex: () => 0,
    reportLocationFailure() {},
  })
  const output = ts.transpileModule(declarations.join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
  }).outputText
  const mod = new vm.SourceTextModule(output, { context })
  await mod.link(() => { throw new Error('Unexpected import') }); await mod.evaluate()

  const revokedBeforeNonBlobUrls = s.revoked.length
  mod.namespace.revokePreviewUrl('data:image/gif;base64,R0lGODlhAQABAAAAACw=')
  mod.namespace.revokePreviewUrl('http://example.com/image.jpg')
  mod.namespace.revokePreviewUrl('https://example.com/image.jpg')
  assert.equal(s.revoked.length, revokedBeforeNonBlobUrls)

  const blobUrl = context.URL.createObjectURL(file('cleanup.jpeg'))
  mod.namespace.revokePreviewUrl(blobUrl)
  assert.equal(s.revoked.at(-1), blobUrl)

  await mod.namespace.handleSelectedImageFiles([file('good.jpeg'), file('bad.jpeg'), file('also-good.jpeg')], 'gallery')
  assert.deepEqual(Array.from(images, image => image.status), ['pending', 'error', 'pending'])
  assert.equal(images[1].errorMessage, friendlyMessage)
  assert.equal(images[0].errorMessage, null)
  assert.equal(images[2].errorMessage, null)
  assert.equal(context.imageValidationErrors.length, 0)
  assert.equal(mod.namespace.renderImageFeedback(), null)
  mod.namespace.handleRemovePendingImage(images[1].id)
  assert.equal(mod.namespace.renderImageFeedback(), null)
  assert.equal(images.length, 2)
  for (const image of [...images]) mod.namespace.handleRemovePendingImage(image.id)
  assert.deepEqual([...s.revoked].sort(), [...s.created].sort())
})
