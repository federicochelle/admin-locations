export type FeatureListItem = {
  id: string
  name: string
  slug: string
  group: string | null
  type: string | null
  active: boolean | null
}

export type FeatureCreatePayload = {
  name: string
  slug: string
  group: string | null
  type: string
  active: boolean
}

export type FeatureUpdatePayload = FeatureCreatePayload

export type FeatureFormValues = {
  name: string
  slug: string
  group: string
  type: string
  active: boolean
}

export type FeatureEditableRecord = {
  id: string
  name: string
  slug: string
  group: string | null
  type: string | null
  active: boolean | null
}
