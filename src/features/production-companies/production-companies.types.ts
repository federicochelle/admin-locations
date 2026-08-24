export type ProductionCompanyListItem = {
  id: string
  name: string
  logoUrl: string | null
  logoPublicId: string | null
  active: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type ProductionCompanyFormValues = {
  name: string
}
