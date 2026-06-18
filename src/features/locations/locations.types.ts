export type LocationStatus = string | null

export type LocationListItem = {
  id: string
  title: string
  slug: string
  locationCode: string | null
  coverImageUrl: string | null
  status: LocationStatus
  published: boolean
  featured: boolean
  premium: boolean
  categoryName: string | null
  departmentName: string | null
  zoneName: string | null
  ownerId: string | null
  ownerName: string | null
  ownerPhone: string | null
}

export type LocationOwnerOption = {
  id: string
  full_name: string
}

export type LocationCategoryOption = {
  id: string
  name: string
}

export type LocationDepartmentOption = {
  id: string
  name: string
}

export type LocationZoneOption = {
  id: string
  name: string
  department_id: string | null
}

export type LocationFeatureOption = {
  id: string
  name: string
  group: string | null
  active: boolean | null
}

export type LocationFormOptions = {
  owners: LocationOwnerOption[]
  categories: LocationCategoryOption[]
  departments: LocationDepartmentOption[]
  zones: LocationZoneOption[]
  features: LocationFeatureOption[]
}

export type LocationCreatePayload = {
  title: string
  slug: string
  description: string | null
  category_id: string | null
  department_id: string | null
  zone_id: string | null
  owner_id: string | null
  status: string
  published: boolean
  premium: boolean
  featured: boolean
  visibility_level: string
  address_private: string | null
  address_public: string | null
  google_place_id: string | null
  formatted_address: string | null
  google_department_name: string | null
  google_zone_name: string | null
  address_components: unknown | null
  lat: number | null
  lng: number | null
  approx_lat: number | null
  approx_lng: number | null
  show_exact_location: boolean
  map_visibility: string
  selectedFeatureIds: string[]
}

export type LocationUpdatePayload = LocationCreatePayload

export type LocationFormValues = {
  title: string
  slug: string
  description: string
  category_id: string
  department_id: string
  zone_id: string
  owner_id: string
  status: string
  published: boolean
  premium: boolean
  featured: boolean
  visibility_level: string
  address_private: string
  address_public: string
  google_place_id: string | null
  formatted_address: string | null
  google_department_name: string | null
  google_zone_name: string | null
  address_components: unknown | null
  lat: number | null
  lng: number | null
  approx_lat: number | null
  approx_lng: number | null
  show_exact_location: boolean
  map_visibility: string
  selectedFeatureIds: string[]
}

export type LocationEditableRecord = {
  id: string
  title: string
  slug: string
  location_code: string | null
  description: string | null
  category_id: string | null
  department_id: string | null
  zone_id: string | null
  owner_id: string | null
  status: string | null
  published: boolean | null
  premium: boolean | null
  featured: boolean | null
  visibility_level: string | null
  address_private: string | null
  address_public: string | null
  google_place_id: string | null
  formatted_address: string | null
  google_department_name: string | null
  google_zone_name: string | null
  address_components: unknown | null
  lat: number | null
  lng: number | null
  approx_lat: number | null
  approx_lng: number | null
  show_exact_location: boolean | null
  map_visibility: string | null
  selectedFeatureIds: string[]
}

export type LocationNameRelation =
  | {
      name: string | null
    }
  | {
      name: string | null
    }[]
  | null

export type LocationOwnerRelation =
  | {
      id: string | null
      full_name: string | null
      phone: string | null
    }
  | {
      id: string | null
      full_name: string | null
      phone: string | null
    }[]
  | null

export type SupabaseLocationRow = {
  id: string
  title: string
  slug: string
  location_code: string | null
  location_images:
    | {
        url: string | null
        is_cover: boolean | null
      }[]
    | null
  status: string | null
  published: boolean | null
  featured: boolean | null
  premium: boolean | null
  categories: LocationNameRelation
  departments: LocationNameRelation
  zones: LocationNameRelation
  owners: LocationOwnerRelation
}

export type LocationFeatureRelationRow = {
  feature_id: string | null
}

export type SupabaseLocationEditableRow = Omit<
  LocationEditableRecord,
  'selectedFeatureIds'
> & {
  location_features:
    | LocationFeatureRelationRow
    | LocationFeatureRelationRow[]
    | null
}
