export type LocationRequestStatus =
  | 'submitted'
  | 'closed'

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

export type AdminRequestLocation = {
  id: string
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

export type AdminLocationRequestDetail = {
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
  locationManagerName: string | null
  tentativeStartDate: string | null
  tentativeEndDate: string | null
  officialPdf: {
    bucket: string
    path: string
    fileName: string | null
    generatedAt: string | null
    uploadedAt: string | null
    sizeBytes: number | null
  } | null
  locations: AdminRequestLocation[]
}

export const LOCATION_REQUEST_STATUS_OPTIONS: Array<{
  label: string
  value: LocationRequestStatus
}> = [
  { value: 'submitted', label: 'Pendiente' },
  { value: 'closed', label: 'Finalizada' },
]
