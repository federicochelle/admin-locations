import {
  isHeicImageExtension,
  isHeicImageMimeType,
  isSupportedImageMimeType,
} from './image-upload.constants'

const IMAGE_SIGNATURE_READ_BYTES = 512

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx'])
const AVIF_BRANDS = new Set(['avif', 'avis'])
const HEIF_STRUCTURAL_BRANDS = new Set(['mif1', 'msf1'])

export type DetectedImageContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif'
  | 'image/heic'
  | 'image/heif-unknown'
  | null

function matchesBytes(bytes: Uint8Array, offset: number, expected: number[]) {
  return expected.every((value, index) => bytes[offset + index] === value)
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

function readFtypBrands(bytes: Uint8Array) {
  if (bytes.length < 16 || readAscii(bytes, 4, 4) !== 'ftyp') {
    return null
  }

  const declaredBoxSize = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(0)
  const boxEnd = Math.min(
    bytes.length,
    declaredBoxSize >= 16 ? declaredBoxSize : bytes.length,
  )
  const brands = [readAscii(bytes, 8, 4)]

  for (let offset = 16; offset + 4 <= boxEnd; offset += 4) {
    brands.push(readAscii(bytes, offset, 4))
  }

  return brands
}

export async function detectImageContentType(
  file: Blob,
): Promise<DetectedImageContentType> {
  const bytes = new Uint8Array(
    await file.slice(0, IMAGE_SIGNATURE_READ_BYTES).arrayBuffer(),
  )

  if (matchesBytes(bytes, 0, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg'
  }

  if (matchesBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png'
  }

  if (
    readAscii(bytes, 0, 4) === 'RIFF' &&
    readAscii(bytes, 8, 4) === 'WEBP'
  ) {
    return 'image/webp'
  }

  const brands = readFtypBrands(bytes)

  if (!brands) {
    return null
  }

  if (brands.some((brand) => AVIF_BRANDS.has(brand))) {
    return 'image/avif'
  }

  if (brands.some((brand) => HEIC_BRANDS.has(brand))) {
    return 'image/heic'
  }

  if (brands.some((brand) => HEIF_STRUCTURAL_BRANDS.has(brand))) {
    return 'image/heif-unknown'
  }

  return null
}

export async function shouldConvertHeicImageFile(file: File) {
  const detectedContentType = await detectImageContentType(file)

  if (detectedContentType === 'image/heic') {
    return { detectedContentType, isHeic: true }
  }

  if (detectedContentType !== null) {
    return { detectedContentType, isHeic: false }
  }

  if (isHeicImageMimeType(file.type)) {
    return { detectedContentType, isHeic: true }
  }

  if (isSupportedImageMimeType(file.type)) {
    return { detectedContentType, isHeic: false }
  }

  return {
    detectedContentType,
    isHeic: isHeicImageExtension(file.name),
  }
}
