export type ProposalStatus =
  | 'pending'
  | 'reviewing'
  | 'contacted'
  | 'scheduled'
  | 'approved'
  | 'rejected'

export type ProposalImage = {
  id: string
  submissionId: string
  cloudflareImageId: string | null
  imageUrl: string
  sortOrder: number | null
  createdAt: string
}

export type ProposalListItem = {
  id: string
  status: ProposalStatus
  createdAt: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  title: string
  department: string | null
  zone: string | null
}

export type ProposalDetails = ProposalListItem & {
  updatedAt: string | null
  address: string | null
  locationType: string | null
  description: string | null
  message: string | null
  adminNotes: string | null
  images: ProposalImage[]
}

export type UpdateProposalSubmissionInput = {
  id: string
  status: ProposalStatus
  adminNotes: string | null
}

export const PROPOSAL_STATUS_OPTIONS: Array<{
  label: string
  value: ProposalStatus
}> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'reviewing', label: 'En revisión' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'scheduled', label: 'Visita agendada' },
  { value: 'approved', label: 'Aprobada' },
  { value: 'rejected', label: 'Rechazada' },
]
