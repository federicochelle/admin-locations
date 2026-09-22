import { useEffect } from 'react'
import { BROWSER_TITLE, buildPageSeo, type PageSeoInput } from '../utils/seo'

function ensureMetaByAttribute(
  attribute: 'name' | 'property',
  key: string,
) {
  const selector = `meta[${attribute}="${key}"]`
  const existingMeta = document.head.querySelector<HTMLMetaElement>(selector)

  if (existingMeta) {
    return existingMeta
  }

  const meta = document.createElement('meta')
  meta.setAttribute(attribute, key)
  document.head.append(meta)
  return meta
}

function setMetaContent(
  attribute: 'name' | 'property',
  key: string,
  content: string | number,
) {
  ensureMetaByAttribute(attribute, key).setAttribute('content', String(content))
}

function ensureCanonicalLink() {
  const existingLink = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  )

  if (existingLink) {
    return existingLink
  }

  const link = document.createElement('link')
  link.setAttribute('rel', 'canonical')
  document.head.append(link)
  return link
}

export function usePageSeo(input: PageSeoInput = {}) {
  useEffect(() => {
    const seo = buildPageSeo({
      path: `${window.location.pathname}${window.location.search}`,
      ...input,
    })

    document.title = BROWSER_TITLE
    ensureCanonicalLink().setAttribute('href', seo.canonicalUrl)

    setMetaContent('name', 'description', seo.description)
    setMetaContent('property', 'og:title', seo.title)
    setMetaContent('property', 'og:description', seo.description)
    setMetaContent('property', 'og:image', seo.imageUrl)
    setMetaContent('property', 'og:image:width', seo.imageWidth)
    setMetaContent('property', 'og:image:height', seo.imageHeight)
    setMetaContent('property', 'og:image:alt', seo.imageAlt)
    setMetaContent('property', 'og:url', seo.canonicalUrl)
    setMetaContent('property', 'og:type', seo.type)
    setMetaContent('property', 'og:site_name', seo.siteName)
    setMetaContent('name', 'twitter:card', 'summary_large_image')
    setMetaContent('name', 'twitter:title', seo.title)
    setMetaContent('name', 'twitter:description', seo.description)
    setMetaContent('name', 'twitter:image', seo.imageUrl)
    setMetaContent('name', 'twitter:image:alt', seo.imageAlt)
  }, [input])
}
