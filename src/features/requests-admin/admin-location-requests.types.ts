export type LocationRequestStatus =
  | 'pending'
  | 'in_review'
  | 'contacted'
  | 'closed'

export type AdminLocationRequest = {
  id: string
  userId: string
  locationId: string
  message: string | null
  status: LocationRequestStatus
  createdAt: string
  updatedAt: string | null
  requesterFullName: string | null
  requesterEmail: string | null
  requesterCompanyName: string | null
  requesterPhone: string | null
  locationTitle: string
  locationCode: string | null
  locationCoverImageUrl: string | null
  locationCategoryName: string | null
}

export const LOCATION_REQUEST_STATUS_OPTIONS: Array<{
  label: string
  value: LocationRequestStatus
}> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'closed', label: 'Cerrado' },
]
