import test from 'node:test'
import assert from 'node:assert/strict'
import { harness } from '../observability/harness.mjs'

function ftyp(...brands) {
  const boxSize = 16 + Math.max(0, brands.length - 1) * 4
  const bytes = new Uint8Array(boxSize)
  new DataView(bytes.buffer).setUint32(0, boxSize)
  bytes.set(new TextEncoder().encode('ftyp'), 4)
  bytes.set(new TextEncoder().encode(brands[0]), 8)
  for (const [index, brand] of brands.slice(1).entries()) {
    bytes.set(new TextEncoder().encode(brand), 16 + index * 4)
  }
  return bytes
}

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const heicBytes = ftyp('heic', 'mif1', 'MiHB')
const heifWithHevcBytes = ftyp('mif1', 'heix', 'MiHE')
const avifBytes = ftyp('avif', 'mif1', 'MA1B')

const cases = [
  ['A: JPEG real + .jpeg + image/jpeg', jpegBytes, 'foto.jpeg', 'image/jpeg', false],
  ['B: HEIC real + .heic + image/heic', heicBytes, 'foto.heic', 'image/heic', true],
  ['C: HEIC real + .HEIC + MIME vacío', heicBytes, 'foto.HEIC', '', true],
  ['D: HEIC real + .jpeg + image/jpeg', heicBytes, 'IMG_4836.jpeg', 'image/jpeg', true],
  ['E: HEIF con marca HEVC + .jpg + image/jpeg', heifWithHevcBytes, 'foto.jpg', 'image/jpeg', true],
  ['F: JPEG real + .heic + image/heic', jpegBytes, 'foto.heic', 'image/heic', false],
  ['G: AVIF real + .jpg + image/jpeg', avifBytes, 'foto.jpg', 'image/jpeg', false],
]

test('A-G: prepareImageUploadFile sólo llama heicTo para contenido HEIC/HEVC', async () => {
  let heicToCalls = 0

  class FakeImageBitmap {
    width = 1200
    height = 800
    close() {}
  }

  const h = await harness({
    actualImageProcessor: true,
    heicTo: async () => {
      heicToCalls += 1
      return new FakeImageBitmap()
    },
    optimize: async (file) => ({
      file,
      outputDimensions: { width: 1200, height: 800 },
      optimizedSize: file.size,
      originalSize: file.size,
      wasOptimized: false,
    }),
  })

  Object.assign(h.context, {
    ImageBitmap: FakeImageBitmap,
    performance,
    console: {
      error() {}, groupCollapsed() {}, groupEnd() {}, log() {}, warn() {},
    },
    document: {
      createElement() {
        return {
          width: 0,
          height: 0,
          getContext() { return { drawImage() {} } },
          toBlob(callback, mimeType) {
            callback(new Blob([jpegBytes], { type: mimeType }))
          },
        }
      },
    },
  })

  const processor = await h.module('src/features/images/image-upload.processor')

  for (const [label, bytes, name, type, expected] of cases) {
    const callsBefore = heicToCalls
    await processor.prepareImageUploadFile(new File([bytes], name, { type }))
    assert.equal(heicToCalls - callsBefore, expected ? 1 : 0, label)
  }
})

test('mif1 y msf1 sin una marca HEVC no se consideran convertibles', async () => {
  const h = await harness()
  const detector = await h.module('src/features/images/image-content-type')

  for (const brand of ['mif1', 'msf1']) {
    const result = await detector.shouldConvertHeicImageFile(
      new File([ftyp(brand)], `foto.${brand}`, { type: 'image/heic' }),
    )
    assert.equal(result.detectedContentType, 'image/heif-unknown')
    assert.equal(result.isHeic, false)
  }
})

test('el caso D se convierte a bytes JPEG y continúa por el decoder/optimizer', async () => {
  let heicToCalls = 0
  let closeCalls = 0

  class FakeImageBitmap {
    width = 1200
    height = 800
    close() { closeCalls += 1 }
  }

  const h = await harness({
    actualImageProcessor: true,
    heicTo: async ({ blob, type }) => {
      heicToCalls += 1
      assert.equal(type, 'bitmap')
      assert.deepEqual(
        new Uint8Array(await blob.slice(0, heicBytes.length).arrayBuffer()),
        heicBytes,
      )
      return new FakeImageBitmap()
    },
  })

  Object.assign(h.context, {
    ImageBitmap: FakeImageBitmap,
    performance,
    console: {
      error() {}, groupCollapsed() {}, groupEnd() {}, log() {}, warn() {},
    },
    document: {
      createElement(tag) {
        assert.equal(tag, 'canvas')
        return {
          width: 0,
          height: 0,
          getContext() { return { drawImage() {} } },
          toBlob(callback, mimeType) {
            callback(new Blob([jpegBytes], { type: mimeType }))
          },
        }
      },
    },
    window: {
      async createImageBitmap(file) {
        const signature = new Uint8Array(await file.slice(0, 3).arrayBuffer())
        assert.deepEqual(signature, jpegBytes.slice(0, 3))
        return new FakeImageBitmap()
      },
    },
  })

  const processor = await h.module('src/features/images/image-upload.processor')
  const optimizer = await h.module('src/features/locations/location-image-optimizer')
  const input = new File([heicBytes], 'IMG_4836.jpeg', { type: 'image/jpeg' })
  const prepared = await processor.prepareImageUploadFile(input)

  assert.equal(heicToCalls, 1)
  assert.equal(prepared.wasHeicConverted, true)
  assert.equal(prepared.file.type, 'image/jpeg')
  assert.notDeepEqual(
    new Uint8Array(await prepared.file.arrayBuffer()),
    new Uint8Array(await input.arrayBuffer()),
  )

  const optimized = await optimizer.optimizeLocationImageFile(prepared.file)
  assert.equal(optimized.file.type, 'image/jpeg')
  assert.deepEqual(
    new Uint8Array(await optimized.file.slice(0, 3).arrayBuffer()),
    jpegBytes.slice(0, 3),
  )
  assert.equal(closeCalls, 2)
})
