export const SITE_NAME = 'Sitio Locaciones'
export const BROWSER_TITLE = 'Admin'
export const DEFAULT_SEO_DESCRIPTION =
  'Plataforma para explorar, organizar y gestionar locaciones audiovisuales en Uruguay.'
export const DEFAULT_OG_IMAGE_PATH = '/opengraph.jpeg'
export const DEFAULT_OG_IMAGE_WIDTH = 1842
export const DEFAULT_OG_IMAGE_HEIGHT = 854
export const DEFAULT_OG_IMAGE_ALT =
  'Vista de marca de Sitio Locaciones para compartir la plataforma de locaciones audiovisuales.'

export type PageSeoInput = {
  description?: string
  imageAlt?: string
  imageHeight?: number
  imagePath?: string
  imageWidth?: number
  path?: string
  title?: string
  type?: string
}

export type PageSeo = {
  canonicalUrl: string
  description: string
  imageAlt: string
  imageHeight: number
  imageUrl: string
  imageWidth: number
  siteName: string
  title: string
  type: string
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function normalizePublicSiteUrl(value: string) {
  const trimmedValue = value.trim()

  if (!isAbsoluteUrl(trimmedValue)) {
    return ''
  }

  return trimTrailingSlash(trimmedValue)
}

function normalizePath(path: string) {
  if (!path.trim()) {
    return '/'
  }

  return path.startsWith('/') ? path : `/${path}`
}

export function getPublicSiteUrl() {
  const configuredUrl = import.meta.env.VITE_PUBLIC_SITE_URL

  if (configuredUrl) {
    const normalizedUrl = normalizePublicSiteUrl(configuredUrl)

    if (normalizedUrl) {
      return normalizedUrl
    }
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return trimTrailingSlash(window.location.origin)
  }

  return ''
}

export function buildPublicUrl(path = '/') {
  if (isAbsoluteUrl(path)) {
    return path
  }

  const normalizedPath = normalizePath(path)
  const publicSiteUrl = getPublicSiteUrl()

  return publicSiteUrl ? `${publicSiteUrl}${normalizedPath}` : normalizedPath
}

export function buildPageSeo(input: PageSeoInput = {}): PageSeo {
  const title = input.title?.trim() || SITE_NAME
  const description = input.description?.trim() || DEFAULT_SEO_DESCRIPTION
  const imagePath = input.imagePath?.trim() || DEFAULT_OG_IMAGE_PATH

  return {
    canonicalUrl: buildPublicUrl(input.path ?? '/'),
    description,
    imageAlt: input.imageAlt?.trim() || DEFAULT_OG_IMAGE_ALT,
    imageHeight: input.imageHeight ?? DEFAULT_OG_IMAGE_HEIGHT,
    imageUrl: buildPublicUrl(imagePath),
    imageWidth: input.imageWidth ?? DEFAULT_OG_IMAGE_WIDTH,
    siteName: SITE_NAME,
    title,
    type: input.type?.trim() || 'website',
  }
}
