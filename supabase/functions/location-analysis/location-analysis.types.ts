export type LocationAnalysisFeatureCatalogItem = {
  name: string
  slug: string
  group: string | null
  aliases: string[]
}

export type LocationAnalysisTagCatalogItem = {
  name: string
  slug: string
  category: string | null
  aliases: string[]
}

export type LocationAnalysisImageInput = {
  url: string
  isCover: boolean
  order: number
}

export type LocationAnalysisRequestBody = {
  locationId?: unknown
  locationCode?: unknown
  category?: unknown
  department?: unknown
  zone?: unknown
  formattedAddress?: unknown
  googleDepartmentName?: unknown
  googleZoneName?: unknown
  latitude?: unknown
  longitude?: unknown
  approxLatitude?: unknown
  approxLongitude?: unknown
  showExactLocation?: unknown
  mapVisibility?: unknown
  currentDescription?: unknown
  currentFeatureSlugs?: unknown
  currentTagSlugs?: unknown
  availableFeatures?: unknown
  availableTags?: unknown
  images?: unknown
}

export type LocationAnalysisRequest = {
  locationId: string | null
  locationCode: string | null
  category: string | null
  department: string | null
  zone: string | null
  formattedAddress: string | null
  googleDepartmentName: string | null
  googleZoneName: string | null
  latitude: number | null
  longitude: number | null
  approxLatitude: number | null
  approxLongitude: number | null
  showExactLocation: boolean
  mapVisibility: string | null
  currentDescription: string
  currentFeatureSlugs: string[]
  currentTagSlugs: string[]
  availableFeatures: LocationAnalysisFeatureCatalogItem[]
  availableTags: LocationAnalysisTagCatalogItem[]
  images: LocationAnalysisImageInput[]
}

export type LocationAnalysisResponse = {
  description: string
  featureSlugs: string[]
  tagSlugs: string[]
}
