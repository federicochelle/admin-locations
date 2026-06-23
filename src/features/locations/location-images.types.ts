export type LocationImageContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif'

export type LocationImageUploadUrlInput = {
  locationId: string
  filename: string
  contentType: LocationImageContentType
}

export type LocationImageUploadUrlCloudflareResult = {
  id?: string | null
  uploadURL?: string | null
}

export type LocationImageUploadUrlResult = {
  uploadURL: string | null
  imageId: string | null
  cloudflare: LocationImageUploadUrlCloudflareResult | null
}

export type CloudflareDirectUploadResult = {
  id?: string
  filename?: string
  uploaded?: string
  requireSignedURLs?: boolean
  variants?: string[]
}

export type CloudflareDirectUploadResponse = {
  errors?: Array<{ code?: number; message?: string }>
  messages?: Array<{ code?: number; message?: string }>
  result?: CloudflareDirectUploadResult
  success?: boolean
}

export type LocationImageFinalizeInput = {
  locationId: string
  cloudflareImageId: string
  altText?: string | null
  caption?: string | null
  isCover?: boolean
  sortOrder?: number
}

export type LocationImageRecord = {
  id: string
  location_id: string
  url: string
  storage_key: string
  alt_text: string | null
  caption: string | null
  sort_order: number
  is_cover: boolean
  width: number | null
  height: number | null
  created_at: string
  updated_at: string
}

export type UploadLocationImageInput = {
  locationId: string
  file: File
  altText?: string | null
  caption?: string | null
  isCover?: boolean
  sortOrder?: number
  signal?: AbortSignal
  onStatusChange?: (status: Extract<PendingLocationImageStatus, 'uploading' | 'finalizing'>) => void
}

export type UploadLocationImageResult = {
  directUpload: CloudflareDirectUploadResponse
  finalizedImage: LocationImageRecord
  imageId: string
}

export type DeleteLocationImageInput = {
  locationId: string
  imageId: string
}

export type DeleteLocationImageResult = {
  success: true
}

export type PendingLocationImageStatus =
  | 'pending'
  | 'uploading'
  | 'finalizing'
  | 'done'
  | 'error'

export type PendingLocationImageFile = {
  id: string
  file: File
  previewUrl: string
  originalIndex: number
  isCover: boolean
  status: PendingLocationImageStatus
  errorMessage?: string | null
}
