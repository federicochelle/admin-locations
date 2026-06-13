export type OwnerStatus = string | null

export type OwnerListItem = {
  id: string
  full_name: string
  company_name: string | null
  email: string | null
  phone: string | null
  locations_count: number
  whatsapp: string | null
  status: OwnerStatus
}

export type OwnerCreatePayload = {
  full_name: string
  company_name: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  document_or_rut: string | null
  notes: string | null
  status: string
}

export type OwnerUpdatePayload = OwnerCreatePayload

export type OwnerFormValues = {
  full_name: string
  company_name: string
  email: string
  phone: string
  whatsapp: string
  document_or_rut: string
  notes: string
  status: string
}

export type OwnerEditableRecord = {
  id: string
  full_name: string
  company_name: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  document_or_rut: string | null
  notes: string | null
  status: string | null
}

export type OwnerLocationListItem = {
  id: string
  locationCode: string | null
  title: string
  coverImageUrl: string | null
  departmentName: string | null
  zoneName: string | null
  published: boolean
  status: string | null
}

export type OwnerEditableDetails = {
  owner: OwnerEditableRecord
  locations: OwnerLocationListItem[]
}
