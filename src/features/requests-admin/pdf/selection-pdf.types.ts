export type SelectionPdfProject = {
  product: string
  productionCompany: string
  locationManager: string
  email: string
  tentativeStartDate: string
  tentativeEndDate: string
}

export type SelectionPdfLocationImage = {
  key: string
  imageUrl: string
  sortOrder: number | null
}

export type SelectionPdfLocation = {
  locationId: string
  locationCode: string
  locationTitle: string
  categorySlug: string
  images: SelectionPdfLocationImage[]
}

export type SelectionPdfPayload = {
  project: SelectionPdfProject
  generatedAt: string
  totalImages: number
  totalLocations: number
  locations: SelectionPdfLocation[]
}

export type SelectionPdfProgress = {
  current: number
  total: number
  locationCode: string
}

export type SelectionPdfFailedImage = {
  key: string
  imageUrl: string
  locationCode: string
  message: string
}

export type SelectionPdfExportResult = {
  blob: Blob
  fileName: string
  totalImages: number
  includedImages: number
  failedImages: SelectionPdfFailedImage[]
}
