export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export const DIRECT_UPLOAD_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const

export const HEIC_IMAGE_MIME_TYPES = [
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
] as const

export const SUPPORTED_IMAGE_MIME_TYPES = [
  ...DIRECT_UPLOAD_IMAGE_MIME_TYPES,
  ...HEIC_IMAGE_MIME_TYPES,
] as const

export const SUPPORTED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.heic',
  '.heif',
] as const

export const IMAGE_INPUT_ACCEPT = [
  ...SUPPORTED_IMAGE_MIME_TYPES,
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.heic',
  '.heif',
].join(',')

const SUPPORTED_IMAGE_MIME_TYPE_SET = new Set<string>(SUPPORTED_IMAGE_MIME_TYPES)
const HEIC_IMAGE_MIME_TYPE_SET = new Set<string>(HEIC_IMAGE_MIME_TYPES)
const SUPPORTED_IMAGE_EXTENSION_SET = new Set<string>(SUPPORTED_IMAGE_EXTENSIONS)
const HEIC_IMAGE_EXTENSION_SET = new Set<string>(['.heic', '.heif'])
const IMAGE_EXTENSION_TO_MIME_TYPE = new Map<string, string>([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.heic', 'image/heic'],
  ['.heif', 'image/heif'],
])

function normalizeImageMimeType(value: string) {
  return value.trim().toLowerCase()
}

export function getImageFileExtension(fileName: string) {
  const normalizedName = fileName.trim()
  const extensionMatch = normalizedName.match(/(\.[^./\\]+)$/)

  return extensionMatch ? extensionMatch[1].toLowerCase() : ''
}

export function isSupportedImageMimeType(value: string) {
  return SUPPORTED_IMAGE_MIME_TYPE_SET.has(normalizeImageMimeType(value))
}

export function isSupportedImageExtension(fileName: string) {
  return SUPPORTED_IMAGE_EXTENSION_SET.has(getImageFileExtension(fileName))
}

export function getImageMimeTypeFromFileName(fileName: string) {
  return IMAGE_EXTENSION_TO_MIME_TYPE.get(getImageFileExtension(fileName)) ?? null
}

export function isSupportedImageFile(file: Pick<File, 'name' | 'type'>) {
  return (
    isSupportedImageMimeType(file.type) ||
    isSupportedImageExtension(file.name)
  )
}

export function isHeicImageFile(file: Pick<File, 'name' | 'type'>) {
  return (
    HEIC_IMAGE_MIME_TYPE_SET.has(normalizeImageMimeType(file.type)) ||
    HEIC_IMAGE_EXTENSION_SET.has(getImageFileExtension(file.name))
  )
}

export function getUnsupportedImageFormatMessage() {
  return 'Formato de imagen no permitido. Usá JPG, PNG, WEBP, AVIF, HEIC o HEIF.'
}

export function assertSupportedImageFile(file: Pick<File, 'name' | 'type'>) {
  if (!isSupportedImageFile(file)) {
    throw new Error(getUnsupportedImageFormatMessage())
  }
}
