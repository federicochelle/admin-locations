export type CategoryListItem = {
  id: string
  name: string
  locationsCount: number
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
  parent_id: string | null
  sort_order: number
  active: boolean
}

export type CategoryUpdatePayload = CategoryCreatePayload

export type CategoryFormValues = {
  name: string
  slug: string
  parent_id: string
  sort_order: string
  active: boolean
}

export type CategoryEditableRecord = {
  id: string
  name: string
  slug: string
  parent_id: string | null
  sort_order: number | null
  active: boolean | null
}
