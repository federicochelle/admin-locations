export type ProposalStatus =
  | 'pending'
  | 'reviewing'
  | 'contacted'
  | 'scheduled'
  | 'approved'
  | 'rejected'

export type ProposalStatusFilter =
  | 'pending'
  | 'approved'
  | 'rejected'

export type ProposalImage = {
  id: string
  submissionId: string
  cloudflareImageId: string | null
  imageUrl: string | null
  storageBucket: string | null
  storagePath: string | null
  signedUrl: string | null
  isStorageImage: boolean
  sortOrder: number | null
  createdAt: string
}

export type ProposalListItem = {
  id: string
  status: ProposalStatus
  submittedAt: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  address: string | null
  department: string | null
  zone: string | null
  internalTitle?: string | null
}

export type PaginatedProposalSubmissionsResult = {
  items: ProposalListItem[]
  totalCount: number
}

export type ProposalDetails = ProposalListItem & {
  updatedAt: string | null
  locationType: string | null
  description: string | null
  message: string | null
  adminNotes: string | null
  imageReadUrlsError: string | null
  images: ProposalImage[]
}

export type UpdateProposalSubmissionInput = {
  id: string
  status: ProposalStatus
}

export const PROPOSAL_STATUS_OPTIONS: Array<{
  label: string
  value: ProposalStatusFilter
}> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'approved', label: 'Aprobada' },
  { value: 'rejected', label: 'Rechazada' },
]
