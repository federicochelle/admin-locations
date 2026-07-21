import { getSupabaseClient } from '../../../lib/supabase'
import {
  createSelectionPdf,
  openSelectionPdfInNewTab,
} from './selection-pdf-exporter'
import type {
  SelectionPdfLocation,
  SelectionPdfPayload,
} from './selection-pdf.types'

type RelatedNameRow =
  | {
      name?: string | null
      slug?: string | null
    }
  | {
      name?: string | null
      slug?: string | null
    }[]
  | null

type LocationCatalogImageRow = {
  url?: string | null
  sort_order?: number | null
  is_cover?: boolean | null
}

type RequestProjectSelectionImageRow = {
  id: string
  location_image_id?: string | null
  sort_order?: number | null
  image_url_snapshot?: string | null
  created_at?: string | null
}

type RequestProjectLocationLocationRow = {
  id: string
  title?: string | null
  location_code?: string | null
  published?: boolean | null
  categories?: RelatedNameRow
  departments?: RelatedNameRow
  zones?: RelatedNameRow
  location_images?: LocationCatalogImageRow[] | null
}

type RequestProjectLocationRelationRow = {
  id: string
  notes?: string | null
  sort_order?: number | null
  created_at?: string | null
  location_id?: string | null
  location_code_snapshot?: string | null
  location_title_snapshot?: string | null
  category_slug_snapshot?: string | null
  cover_image_url_snapshot?: string | null
  request_project_location_images?: RequestProjectSelectionImageRow[] | null
  locations?:
    | RequestProjectLocationLocationRow
    | RequestProjectLocationLocationRow[]
    | null
}

type RequestProjectRow = {
  id: string
  title?: string | null
  message?: string | null
  status?: string | null
  tentative_start_date?: string | null
  tentative_end_date?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type RequestProject = {
  id: string
  title: string
  message: string | null
  tentativeStartDate: string | null
  tentativeEndDate: string | null
  createdAt: string
  updatedAt: string
}

type RequestProjectLocation = {
  id: string
  notes: string | null
  sortOrder: number | null
  createdAt: string
  selectedImages: {
    id: string
    locationImageId: string | null
    imageUrl: string
    sortOrder: number | null
    createdAt: string
  }[]
  location: {
    id: string
    slug: string
    title: string
    locationCode: string
    categorySlug: string | null
    categoryName: string
    departmentName: string
    zoneName: string
    coverImageUrl: string | null
    coverImageAlt: string
  }
}

type SelectionPdfFormValues = {
  product: string
  productionCompany: string
  locationManager: string
  email: string
  tentativeStartDate: string
  tentativeEndDate: string
}

const REQUEST_PROJECT_SELECT = `
  id,
  title,
  message,
  status,
  tentative_start_date,
  tentative_end_date,
  created_at,
  updated_at
`

function normalizeValue(value: string) {
  return value.trim()
}

function normalizePublicValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function buildPublicSlug(locationCode?: string | null) {
  if (!locationCode) {
    return null
  }

  return normalizePublicValue(locationCode)
}

function getRelatedName(value: RelatedNameRow | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.name ?? null
  }

  return value?.name ?? null
}

function getSingleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function sortImages(images: LocationCatalogImageRow[] | null | undefined) {
  return [...(images ?? [])].sort((left, right) => {
    const leftCoverOrder = left.is_cover ? -1 : 0
    const rightCoverOrder = right.is_cover ? -1 : 0

    if (leftCoverOrder !== rightCoverOrder) {
      return leftCoverOrder - rightCoverOrder
    }

    return (
      (left.sort_order ?? Number.MAX_SAFE_INTEGER) -
      (right.sort_order ?? Number.MAX_SAFE_INTEGER)
    )
  })
}

function sortPersistedSelectionImages(
  images: RequestProjectSelectionImageRow[] | null | undefined,
) {
  return [...(images ?? [])].sort((left, right) => {
    const leftSortOrder = left.sort_order ?? Number.MAX_SAFE_INTEGER
    const rightSortOrder = right.sort_order ?? Number.MAX_SAFE_INTEGER

    if (leftSortOrder !== rightSortOrder) {
      return leftSortOrder - rightSortOrder
    }

    return (left.created_at ?? '').localeCompare(right.created_at ?? '')
  })
}

function mapRequestProject(row: RequestProjectRow): RequestProject {
  return {
    id: row.id,
    title: row.title?.trim() || 'Solicitud sin titulo',
    message: row.message?.trim() || null,
    tentativeStartDate: row.tentative_start_date ?? null,
    tentativeEndDate: row.tentative_end_date ?? null,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  }
}

function mapRequestProjectLocation(
  row: RequestProjectLocationRelationRow,
): RequestProjectLocation | null {
  const location = getSingleRelation(row.locations)

  if (!location) {
    return null
  }

  const coverImage = sortImages(location.location_images).find((image) =>
    Boolean(image.url),
  )
  const locationCode =
    row.location_code_snapshot?.trim() ||
    location.location_code ||
    location.id
  const locationTitle =
    row.location_title_snapshot?.trim() ||
    location.title?.trim() ||
    locationCode
  const categorySlug =
    row.category_slug_snapshot?.trim() ||
    (getSingleRelation(location.categories)?.slug ?? null)
  const coverImageUrl =
    row.cover_image_url_snapshot?.trim() ||
    (coverImage?.url ?? null)
  const selectedImages = sortPersistedSelectionImages(
    row.request_project_location_images,
  )
    .filter((image) => Boolean(image.image_url_snapshot))
    .map((image) => ({
      id: image.id,
      locationImageId: image.location_image_id ?? null,
      imageUrl: image.image_url_snapshot ?? '',
      sortOrder: image.sort_order ?? null,
      createdAt: image.created_at ?? row.created_at ?? new Date(0).toISOString(),
    }))

  return {
    id: row.id,
    notes: row.notes?.trim() || null,
    sortOrder: row.sort_order ?? null,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    selectedImages,
    location: {
      id: location.id,
      slug: buildPublicSlug(locationCode) ?? location.id,
      title: locationTitle,
      locationCode,
      categorySlug,
      categoryName: getRelatedName(location.categories) ?? 'Sin categoria',
      departmentName: getRelatedName(location.departments) ?? 'Sin departamento',
      zoneName: getRelatedName(location.zones) ?? 'Sin zona',
      coverImageUrl,
      coverImageAlt: 'Imagen de locacion',
    },
  }
}

function mapRequestProjectToPdfFormValues(
  project: RequestProject,
): SelectionPdfFormValues {
  const values: SelectionPdfFormValues = {
    product: project.title,
    productionCompany: '',
    locationManager: '',
    email: '',
    tentativeStartDate: project.tentativeStartDate ?? '',
    tentativeEndDate: project.tentativeEndDate ?? '',
  }

  const message = project.message ?? ''

  for (const rawLine of message.split('\n')) {
    const line = rawLine.trim()

    if (line.startsWith('Empresa:')) {
      values.productionCompany = line.slice('Empresa:'.length).trim()
      continue
    }

    if (line.startsWith('Location manager:')) {
      values.locationManager = line.slice('Location manager:'.length).trim()
      continue
    }

    if (line.startsWith('Email:')) {
      values.email = line.slice('Email:'.length).trim()
    }
  }

  return values
}

async function getRequestProjectById(id: string) {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('request_projects')
    .select(REQUEST_PROJECT_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }

    throw new Error(error.message)
  }

  return mapRequestProject(data as RequestProjectRow)
}

async function getRequestProjectLocations(projectId: string) {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('request_project_locations')
    .select(
      `
        id,
        notes,
        sort_order,
        created_at,
        location_id,
        location_code_snapshot,
        location_title_snapshot,
        category_slug_snapshot,
        cover_image_url_snapshot,
        request_project_location_images (
          id,
          location_image_id,
          sort_order,
          image_url_snapshot,
          created_at
        ),
        locations!inner (
          id,
          title,
          location_code,
          published,
          categories (
            name,
            slug
          ),
          departments (
            name
          ),
          zones (
            name
          ),
          location_images (
            url,
            sort_order,
            is_cover
          )
        )
      `,
    )
    .eq('request_project_id', projectId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as RequestProjectLocationRelationRow[])
    .map((row) => mapRequestProjectLocation(row))
    .filter((location): location is RequestProjectLocation => Boolean(location))
}

function buildSelectionPdfPayloadFromProject(
  values: SelectionPdfFormValues,
  locations: RequestProjectLocation[],
  generatedAt: string,
): SelectionPdfPayload {
  const pdfLocations: SelectionPdfLocation[] = locations.map((location) => {
    const payloadImages =
      location.selectedImages.length > 0
        ? location.selectedImages.map((image) => ({
            key: `${location.location.id}:${image.id}`,
            imageUrl: image.imageUrl,
            sortOrder: image.sortOrder,
          }))
        : location.location.coverImageUrl
          ? [
              {
                key: `${location.location.id}:cover`,
                imageUrl: location.location.coverImageUrl,
                sortOrder: location.sortOrder,
              },
            ]
          : []

    console.log('[selection-pdf][location-audit]', {
      locationId: location.location.id,
      rowsFromDatabase: location.selectedImages.length,
      imagesMappedToPayload: payloadImages.length,
      imageUrls: payloadImages.map((image) => image.imageUrl),
    })

    return {
      locationId: location.location.id,
      locationCode: location.location.locationCode,
      locationTitle: location.location.title,
      categorySlug: location.location.categorySlug ?? '',
      images: payloadImages,
    }
  })

  const totalImages = pdfLocations.reduce(
    (count, location) => count + location.images.length,
    0,
  )

  return {
    project: {
      product: normalizeValue(values.product),
      productionCompany: normalizeValue(values.productionCompany),
      locationManager: normalizeValue(values.locationManager),
      email: normalizeValue(values.email),
      tentativeStartDate: normalizeValue(values.tentativeStartDate),
      tentativeEndDate: normalizeValue(values.tentativeEndDate),
    },
    generatedAt,
    totalImages,
    totalLocations: pdfLocations.length,
    locations: pdfLocations,
  }
}

export async function buildSelectionPdfPayloadFromRequest(
  requestId: string,
): Promise<SelectionPdfPayload> {
  const [project, projectLocations] = await Promise.all([
    getRequestProjectById(requestId),
    getRequestProjectLocations(requestId),
  ])

  if (!project) {
    throw new Error('No encontramos la solicitud indicada.')
  }

  const values = mapRequestProjectToPdfFormValues(project)

  return buildSelectionPdfPayloadFromProject(
    values,
    projectLocations,
    project.updatedAt || project.createdAt,
  )
}

export async function openSelectionPdfFromRequest(requestId: string) {
  const payload = await buildSelectionPdfPayloadFromRequest(requestId)
  const result = await createSelectionPdf(payload)
  openSelectionPdfInNewTab(result.blob)

  return result
}
