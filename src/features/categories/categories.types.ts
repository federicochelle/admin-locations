export type CategoryListItem = {
  id: string
  name: string
  locationsCount: number
  image_url?: string | null
  image_cloudflare_id?: string | null
}

export type CategoryLocationListItem = {
  id: string
  locationCode: string | null
  title: string
  departmentName: string | null
  zoneName: string | null
}

export type CategoryParentOption = {
  id: string
  name: string
}

export type CategoryFormOptions = {
  parentCategories: CategoryParentOption[]
}

export type CategoryCreatePayload = {
  name: string
  slug: string
  location_code_prefix: string
  parent_id: string | null
  sort_order: number
  active: boolean
}

export type CategoryUpdatePayload = CategoryCreatePayload

export type CategoryFormValues = {
  name: string
  slug: string
  location_code_prefix: string
  parent_id: string
  sort_order: string
  active: boolean
  image_url: string | null
  image_cloudflare_id: string | null
}

export type CategoryEditableRecord = {
  id: string
  name: string
  slug: string
  location_code_prefix: string | null
  parent_id: string | null
  sort_order: number | null
  active: boolean | null
  image_url: string | null
  image_cloudflare_id: string | null
}
