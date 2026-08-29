export type LocationRequestStatus =
  | 'pending'
  | 'confirmed'
  | 'discarded'

export type RequestProjectLocationStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'

export type AdminLocationRequest = {
  id: string
  userId: string
  title: string
  message: string | null
  status: LocationRequestStatus
  submittedAt: string
  updatedAt: string | null
  requesterFullName: string | null
  requesterEmail: string | null
  requesterCompanyName: string | null
  requesterPhone: string | null
  locationCount: number
  locationNames: string[]
}

export type PaginatedAdminLocationRequestsResult = {
  items: AdminLocationRequest[]
  totalCount: number
}

export type AdminRequestLocation = {
  id: string
  rowKey: string
  requestProjectVersionId: string
  requestProjectLocationId: string | null
  requestProjectLocationStatus: RequestProjectLocationStatus
  reservationId: string | null
  reservationRecordStatus: string | null
  reservationStartsAt: string | null
  reservationEndsAt: string | null
  title: string
  locationCode: string | null
  coverImageUrl: string | null
  categoryName: string | null
  departmentName: string | null
  zoneName: string | null
  ownerId: string | null
  ownerName: string | null
  ownerPhone: string | null
  ownerEmail: string | null
}

export type AdminLocationRequestVersion = {
  id: string
  versionNumber: number | null
  createdAt: string | null
  isActive: boolean
  isLatest: boolean
}

export type AdminManualRequestLocationOption = {
  id: string
  title: string
  locationCode: string | null
}

export type CreateAdminManualRequestInput = {
  userId: string
  title: string
  productionCompany: string | null
  contactName: string
  contactEmail: string
  contactPhone: string
  tentativeStartDate: string | null
  tentativeEndDate: string | null
  message: string | null
  locationIds: string[]
}

export type AdminLocationRequestDetail = {
  id: string
  userId: string
  title: string
  productionCompany: string | null
  message: string | null
  status: LocationRequestStatus
  createdAt: string
  submittedAt: string
  updatedAt: string | null
  tentativeStartDate: string | null
  tentativeEndDate: string | null
  requester: {
    userId: string
    fullName: string | null
    email: string | null
    phone: string | null
  }
  activeVersionId: string | null
  activeVersionNumber: number | null
  latestVersionId: string | null
  latestVersionNumber: number | null
  hasNewerVersion: boolean
  officialPdf: {
    bucket: string
    path: string
    fileName: string | null
    generatedAt: string | null
    uploadedAt: string | null
    sizeBytes: number | null
  } | null
  versions: AdminLocationRequestVersion[]
  locations: AdminRequestLocation[]
}

export const LOCATION_REQUEST_STATUS_OPTIONS: Array<{
  label: string
  value: LocationRequestStatus
}> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'discarded', label: 'Descartada' },
]
