export type LocationAnalysisUrlImageInput = {
  id: string
  kind: 'url'
  url: string | null
  isCover?: boolean
  order?: number
}

export type LocationAnalysisFileImageInput = {
  id: string
  kind: 'file'
  dataUrl: string
  mimeType: string | null
  filename: string | null
  isCover?: boolean
  order?: number
}

export type LocationAnalysisImageInput =
  | LocationAnalysisUrlImageInput
  | LocationAnalysisFileImageInput

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

export type LocationAnalysisInput = {
  title: string
  locationId?: string | null
  locationCode?: string | null
  categoryName: string | null
  departmentName: string | null
  zoneName: string | null
  formattedAddress?: string | null
  googleDepartmentName?: string | null
  googleZoneName?: string | null
  latitude?: number | null
  longitude?: number | null
  approxLatitude?: number | null
  approxLongitude?: number | null
  showExactLocation?: boolean
  mapVisibility?: string | null
  description: string | null
  currentFeatureSlugs: string[]
  currentTagSlugs: string[]
  availableFeatures?: LocationAnalysisFeatureCatalogItem[]
  availableTags?: LocationAnalysisTagCatalogItem[]
  images: LocationAnalysisImageInput[]
}

export type LocationAnalysisResult = {
  description: string
  featureSlugs: string[]
  tagSlugs: string[]
}

export type LocationAnalysisFunctionRequest = {
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
  images: Array<
    | {
        kind: 'url'
        url: string
        isCover: boolean
        order: number
      }
    | {
        kind: 'file'
        dataUrl: string
        mimeType: string | null
        filename: string | null
        isCover: boolean
        order: number
      }
  >
}

export interface LocationAnalysisProvider {
  analyzeLocation(
    input: LocationAnalysisInput,
  ): Promise<LocationAnalysisResult>
}
