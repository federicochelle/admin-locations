import { getSupabaseClient } from '../../../lib/supabase'
import type {
  LocationAnalysisFileImageInput,
  LocationAnalysisFunctionRequest,
  LocationAnalysisImageInput,
  LocationAnalysisInput,
  LocationAnalysisProvider,
  LocationAnalysisResult,
} from '../location-analysis.types'

const MAX_ANALYSIS_IMAGES = 12
const MAX_TAG_SLUGS = 6

function getUniqueSlugs(slugs: string[]) {
  return Array.from(
    new Set(
      slugs
        .filter((slug): slug is string => typeof slug === 'string')
        .map((slug) => slug.trim())
        .filter((slug) => slug.length > 0),
    ),
  )
}

function getPublicImageUrl(image: LocationAnalysisImageInput) {
  if (image.kind !== 'url') {
    return null
  }

  if (typeof image.url !== 'string') {
    return null
  }

  const url = image.url.trim()

  if (url.length === 0 || url.startsWith('blob:')) {
    return null
  }

  try {
    const parsedUrl = new URL(url)

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null
    }

    return parsedUrl.toString()
  } catch {
    return null
  }
}

function getFileImagePayload(image: LocationAnalysisFileImageInput) {
  const dataUrl = image.dataUrl.trim()

  if (dataUrl.length === 0 || !dataUrl.startsWith('data:')) {
    return null
  }

  return {
    dataUrl,
    filename: image.filename?.trim() || null,
    isCover: image.isCover === true,
    mimeType: image.mimeType?.trim() || null,
    order: typeof image.order === 'number' ? image.order : 0,
  }
}

function normalizeAnalysisImages(
  images: LocationAnalysisImageInput[],
): LocationAnalysisFunctionRequest['images'] {
  return images
    .map((image, index) => {
      if (image.kind === 'file') {
        const fileImage = getFileImagePayload(image)

        if (!fileImage) {
          return null
        }

        return {
          kind: 'file' as const,
          dataUrl: fileImage.dataUrl,
          filename: fileImage.filename,
          isCover: fileImage.isCover,
          mimeType: fileImage.mimeType,
          order: typeof image.order === 'number' ? image.order : index,
        }
      }

      const publicUrl = getPublicImageUrl(image)

      if (!publicUrl) {
        return null
      }

      return {
        kind: 'url' as const,
        url: publicUrl,
        isCover: image.isCover === true,
        order: typeof image.order === 'number' ? image.order : index,
      }
    })
    .filter(
      (
        image,
      ): image is LocationAnalysisFunctionRequest['images'][number] => image !== null,
    )
    .sort((leftImage, rightImage) => {
      if (leftImage.isCover !== rightImage.isCover) {
        return leftImage.isCover ? -1 : 1
      }

      return leftImage.order - rightImage.order
    })
    .slice(0, MAX_ANALYSIS_IMAGES)
}

function buildLocationAnalysisRequest(
  input: LocationAnalysisInput,
): LocationAnalysisFunctionRequest {
  return {
    locationId: input.locationId?.trim() || null,
    locationCode: input.locationCode?.trim() || null,
    category: input.categoryName?.trim() || null,
    department: input.departmentName?.trim() || null,
    zone: input.zoneName?.trim() || null,
    formattedAddress: input.formattedAddress?.trim() || null,
    googleDepartmentName: input.googleDepartmentName?.trim() || null,
    googleZoneName: input.googleZoneName?.trim() || null,
    latitude: typeof input.latitude === 'number' ? input.latitude : null,
    longitude: typeof input.longitude === 'number' ? input.longitude : null,
    approxLatitude:
      typeof input.approxLatitude === 'number' ? input.approxLatitude : null,
    approxLongitude:
      typeof input.approxLongitude === 'number' ? input.approxLongitude : null,
    showExactLocation: input.showExactLocation === true,
    mapVisibility: input.mapVisibility?.trim() || null,
    currentDescription: input.description?.trim() || '',
    currentFeatureSlugs: [...input.currentFeatureSlugs],
    currentTagSlugs: [...input.currentTagSlugs],
    availableFeatures: [...(input.availableFeatures ?? [])],
    availableTags: [...(input.availableTags ?? [])],
    images: normalizeAnalysisImages(input.images),
  }
}

function normalizeLocationAnalysisResponse(
  input: LocationAnalysisInput,
  data: unknown,
): LocationAnalysisResult {
  const availableFeatureSlugs = new Set(
    (input.availableFeatures ?? []).map((feature) => feature.slug),
  )
  const availableTagSlugs = new Set(
    (input.availableTags ?? []).map((tag) => tag.slug),
  )
  const rawResult =
    typeof data === 'object' && data !== null
      ? (data as Partial<LocationAnalysisResult>)
      : {}

  return {
    description:
      typeof rawResult.description === 'string'
        ? rawResult.description.trim()
        : '',
    featureSlugs: getUniqueSlugs(
      Array.isArray(rawResult.featureSlugs) ? rawResult.featureSlugs : [],
    ).filter((slug) => availableFeatureSlugs.has(slug)),
    tagSlugs: getUniqueSlugs(
      Array.isArray(rawResult.tagSlugs) ? rawResult.tagSlugs : [],
    )
      .filter((slug) => availableTagSlugs.has(slug))
      .slice(0, MAX_TAG_SLUGS),
  }
}

export class OpenAIProvider implements LocationAnalysisProvider {
  async analyzeLocation(
    input: LocationAnalysisInput,
  ): Promise<LocationAnalysisResult> {
    const supabase = getSupabaseClient()
    const body = buildLocationAnalysisRequest(input)
    const { data, error } = await supabase.functions.invoke<LocationAnalysisResult>(
      'location-analysis',
      {
        body,
      },
    )

    if (error) {
      throw new Error(error.message)
    }

    return normalizeLocationAnalysisResponse(input, data)
  }
}
