import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { APIProvider } from '@vis.gl/react-google-maps'
import Button from '../../components/ui/Button'
import PhoneInputField from '../../components/ui/PhoneInputField'
import { getLocationEditPath, routePaths } from '../../app/router/route-paths'
import useAuth from '../auth/useAuth'
import { getGoogleMapsApiKey } from '../../lib/env'
import {
  formatOwnerPhoneForInput,
  isValidOwnerPhone,
  toE164OwnerPhone,
} from '../../lib/phone'
import { createCategory } from '../categories/categories.service'
import { createOwner } from '../owners/owners.service'
import { createZone } from '../zones/zones.service'
import {
  createLocation,
  getLocationFormOptions,
  updateLocation,
} from './locations.service'
import LocationCategoryQuickCreateModal from './LocationCategoryQuickCreateModal'
import LocationImagesGrid from './LocationImagesGrid'
import LocationImageSourceModal from './LocationImageSourceModal'
import LocationImageUploader, {
  type LocationImageUploaderHandle,
} from './LocationImageUploader'
import LocationOwnerQuickCreateModal, {
  type LocationOwnerQuickCreateValues,
} from './LocationOwnerQuickCreateModal'
import {
  deleteLocationImage,
  uploadLocationImage,
} from './location-images.service'
import LocationSaveProgressModal, {
  type LocationSaveProgressState,
  type LocationSaveStageKey,
  type LocationSaveStageStatus,
} from './LocationSaveProgressModal'
import LocationAddressPicker from './LocationAddressPicker'
import LocationMapPreview from './LocationMapPreview'
import LocationZoneQuickCreateModal from './LocationZoneQuickCreateModal'
import DescriptionEditor from './components/location-analysis/DescriptionEditor'
import FeaturesEditor from './components/location-analysis/FeaturesEditor'
import LocationAnalysisPanel from './components/location-analysis/LocationAnalysisPanel'
import TagsEditor from './components/location-analysis/TagsEditor'
import { locationAnalysisService } from '../location-analysis/location-analysis.service'
import type {
  LocationAnalysisImageInput,
  LocationAnalysisInput,
  LocationAnalysisResult,
} from '../location-analysis/location-analysis.types'
import { resolvePublicLocationCoordinates } from './location-public-coordinates'
import type {
  LocationCreatePayload,
  LocationFeatureOption,
  LocationFormOptions,
  LocationFormValues,
  LocationUpdatePayload,
} from './locations.types'
import type {
  LocationImageRecord,
  PendingLocationImageFile,
  PendingLocationImageStatus,
} from './location-images.types'
import type { ParsedGooglePlaceAddress } from './location-address-parser'
import {
  getLoadedDropboxChooser,
  loadDropboxChooser,
} from './dropbox/dropbox-chooser'
import { downloadDropboxFiles } from './dropbox/dropbox-files'
import {
  createPendingLocationImagePlaceholder,
  preparePendingLocationImage,
} from './location-image-selection'
import { LOCATION_TOP_STACK_PLACEHOLDER_CLASS } from './location-top-stack.styles'
import { useLocationImages } from './useLocationImages'
import type { GroupedSelectableOptions } from './components/location-analysis/SelectableOptionsSection'
import { SUPPORTED_IMAGE_EXTENSIONS } from '../images/image-upload.constants'

export type LocationFormMode = 'create' | 'edit' | 'view'

type LocationFormProps = {
  mode?: LocationFormMode
  initialValues?: LocationFormValues
  locationId?: string
  locationCode?: string | null
  primaryCardActions?: React.ReactNode
  showImagesSection?: boolean
  showAdvancedSection?: boolean
}

const GOOGLE_MAPS_LIBRARIES = ['places']
type ImageSelectionTarget = 'cover' | 'gallery'

type LocationFormFieldErrors = {
  title: string | null
  address_private: string | null
  category_id: string | null
  owner_name: string | null
  owner_phone: string | null
}

type LocationAnalysisState = {
  analysisError: string | null
  analysisLoading: boolean
  analysisResult: LocationAnalysisResult | null
  suggestedFeatures: string[]
  suggestedTags: string[]
  suggestedDescription: string | null
}

const defaultInitialValues: LocationFormValues = {
  title: '',
  slug: '',
  description: '',
  category_id: '',
  department_id: '',
  zone_id: '',
  owner_id: '',
  status: 'draft',
  published: false,
  premium: false,
  featured: false,
  visibility_level: 'public',
  address_private: '',
  address_public: '',
  google_place_id: null,
  formatted_address: null,
  google_department_name: null,
  google_zone_name: null,
  address_components: null,
  lat: null,
  lng: null,
  approx_lat: null,
  approx_lng: null,
  show_exact_location: false,
  map_visibility: 'public',
  selectedFeatureIds: [],
  selectedTagIds: [],
}

const defaultAnalysisState: LocationAnalysisState = {
  analysisError: null,
  analysisLoading: false,
  analysisResult: null,
  suggestedFeatures: [],
  suggestedTags: [],
  suggestedDescription: null,
}

function toNullableString(value: string) {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function normalizeInlineOwnerValue(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeDepartmentName(value: string | null | undefined) {
  const trimmedValue = value?.trim()

  if (!trimmedValue) {
    return null
  }

  return trimmedValue
    .toLocaleLowerCase('es-UY')
    .replace(/^departamento de\s+/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugifyTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string' || reader.result.trim().length === 0) {
        reject(new Error(`${file.name}: no pudimos preparar la imagen para analizar.`))
        return
      }

      resolve(reader.result)
    }

    reader.onerror = () => {
      reject(new Error(`${file.name}: no pudimos leer la imagen para analizar.`))
    }

    reader.onabort = () => {
      reject(new Error(`${file.name}: se canceló la lectura de la imagen para analizar.`))
    }

    reader.readAsDataURL(file)
  })
}

function buildPayload(
  values: LocationFormValues,
  options?: {
    mode?: LocationFormMode
    initialValues?: LocationFormValues
  },
): LocationCreatePayload | LocationUpdatePayload {
  const deduplicatedSelectedFeatureIds = Array.from(
    new Set(values.selectedFeatureIds),
  )
  const deduplicatedSelectedTagIds = Array.from(new Set(values.selectedTagIds))
  const publicCoordinates = resolvePublicLocationCoordinates({
    lat: values.lat,
    lng: values.lng,
    currentPublicLat: values.approx_lat,
    currentPublicLng: values.approx_lng,
    previousLat: options?.mode === 'edit' ? options.initialValues?.lat ?? null : null,
    previousLng: options?.mode === 'edit' ? options.initialValues?.lng ?? null : null,
  })

  console.groupCollapsed('[Location payload audit] buildPayload')
  console.log('mode', options?.mode ?? 'create')
  console.log('lat', values.lat, 'type:', typeof values.lat)
  console.log('lng', values.lng, 'type:', typeof values.lng)
  console.log('current approx_lat', values.approx_lat, 'type:', typeof values.approx_lat)
  console.log('current approx_lng', values.approx_lng, 'type:', typeof values.approx_lng)
  console.log('generated publicCoordinates', publicCoordinates ?? null)
  console.groupEnd()

  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    description: toNullableString(values.description),
    category_id: values.category_id || null,
    department_id: values.department_id || null,
    zone_id: values.zone_id || null,
    owner_id: values.owner_id || null,
    status: 'published',
    published: true,
    premium: values.premium,
    featured: values.featured,
    visibility_level: values.visibility_level,
    address_private: toNullableString(values.address_private),
    address_public: toNullableString(values.address_public),
    google_place_id: values.google_place_id,
    formatted_address: values.formatted_address,
    google_department_name: values.google_department_name,
    google_zone_name: values.google_zone_name,
    address_components: values.address_components,
    lat: values.lat,
    lng: values.lng,
    approx_lat: publicCoordinates?.lat ?? null,
    approx_lng: publicCoordinates?.lng ?? null,
    show_exact_location: values.show_exact_location,
    map_visibility: values.map_visibility,
    selectedFeatureIds: deduplicatedSelectedFeatureIds,
    selectedTagIds: deduplicatedSelectedTagIds,
  }
}

function getLocationAddressPickerValue(values: LocationFormValues) {
  return values.formatted_address ?? values.address_private
}

function formatFeatureGroupLabel(group: string | null) {
  const normalizedGroup = group?.trim()

  if (!normalizedGroup) {
    return 'Otras características'
  }

  const featureGroupLabels: Record<string, string> = {
    visual_style: 'Estilo visual',
    environment: 'Entorno',
    usage: 'Uso',
    amenities: 'Comodidades',
    lighting: 'Iluminación',
    production_use: 'Uso para producción',
    logistics: 'Logística',
    interior_spaces: 'Espacios interiores',
    special_spaces: 'Espacios especiales',
  }

  if (featureGroupLabels[normalizedGroup]) {
    return featureGroupLabels[normalizedGroup]
  }

  return normalizedGroup
    .split('_')
    .map((segment) =>
      segment.length > 0
        ? `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`
        : segment,
    )
    .join(' ')
}

function getFeatureGroupSortOrder(group: string | null) {
  const normalizedGroup = group?.trim()

  const priorityByGroup: Record<string, number> = {
    visual_style: 0,
    environment: 1,
    usage: 2,
  }

  if (!normalizedGroup) {
    return Number.MAX_SAFE_INTEGER
  }

  return priorityByGroup[normalizedGroup] ?? Number.MAX_SAFE_INTEGER
}

function buildGroupedSelectableOptions<T extends { group: string | null }>(items: T[]) {
  const groups = new Map<
    string,
    {
      group: string | null
      items: T[]
    }
  >()

  for (const item of items) {
    const key = item.group?.trim() || 'ungrouped'
    const existingGroup = groups.get(key)

    if (existingGroup) {
      existingGroup.items.push(item)
      continue
    }

    groups.set(key, {
      group: item.group,
      items: [item],
    })
  }

  return Array.from(groups.values()).sort((leftGroup, rightGroup) => {
    const orderDifference =
      getFeatureGroupSortOrder(leftGroup.group) -
      getFeatureGroupSortOrder(rightGroup.group)

    if (orderDifference !== 0) {
      return orderDifference
    }

    return formatFeatureGroupLabel(leftGroup.group).localeCompare(
      formatFeatureGroupLabel(rightGroup.group),
      'es',
    )
  })
}

function renderGoogleLocationFallback(inputClassNameValue: string) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        value=""
        disabled
        placeholder="Buscar dirección..."
        autoComplete="off"
        className={inputClassNameValue}
        readOnly
      />
      <p className="text-sm text-slate-600">
        Google Places no está configurado. Puedes seguir usando la dirección manual.
      </p>
    </div>
  )
}

function LocationGoogleProvider({
  apiKey,
  children,
}: {
  apiKey: string | null
  children: React.ReactNode
}) {
  if (!apiKey) {
    return <>{children}</>
  }

  return (
    <APIProvider apiKey={apiKey} libraries={GOOGLE_MAPS_LIBRARIES}>
      {children}
    </APIProvider>
  )
}

function FieldLabel({
  children,
  htmlFor,
  required = false,
}: {
  children: string
  htmlFor: string
  required?: boolean
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-medium text-slate-700"
    >
      {children}
      {required ? <span className="text-slate-500"> *</span> : null}
    </label>
  )
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      className="h-6 w-6"
    >
      <path
        d="m5 7.5 5 5 5-5"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronUpIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      className="h-6 w-6"
    >
      <path
        d="m5 12.5 5-5 5 5"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function getFieldErrorInputClassName(errorMessage: string | null) {
  return errorMessage ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''
}

function getDefaultFieldErrors(): LocationFormFieldErrors {
  return {
    title: null,
    address_private: null,
    category_id: null,
    owner_name: null,
    owner_phone: null,
  }
}

function validateRequiredFields(
  values: LocationFormValues,
  options: {
    ownerName: string
    ownerPhone: string
  },
): LocationFormFieldErrors {
  const normalizedOwnerName = normalizeInlineOwnerValue(options.ownerName)
  const normalizedOwnerPhone = normalizeInlineOwnerValue(options.ownerPhone)

  return {
    title:
      values.title.trim().length > 0 ? null : 'El título es obligatorio.',
    category_id:
      values.category_id.trim().length > 0
        ? null
        : 'Debe seleccionar una categoría.',
    address_private:
      values.address_private.trim().length > 0
        ? null
        : 'Debe ingresar una dirección.',
    owner_name:
      normalizedOwnerName.length === 0
        ? 'Debe ingresar el nombre del dueño.'
        : null,
    owner_phone:
      normalizedOwnerPhone.length === 0
        ? 'Debe ingresar el teléfono del dueño.'
        : values.owner_id.trim().length === 0 && !isValidOwnerPhone(normalizedOwnerPhone)
          ? 'Ingresá un teléfono válido con código de país.'
        : null,
  }
}

function hasFieldErrors(fieldErrors: LocationFormFieldErrors) {
  return Object.values(fieldErrors).some((errorMessage) => errorMessage !== null)
}

function getFormHeading(mode: LocationFormMode) {
  if (mode === 'edit') {
    return 'Editar locación'
  }

  if (mode === 'view') {
    return 'Detalle de locación'
  }

  return 'Panel de creación'
}

function getGalleryUploadLabel(
  isPreparingImages: boolean,
  processedImagesCount: number,
  totalImagesToProcess: number,
) {
  if (!isPreparingImages) {
    return 'Subir imágenes'
  }

  return `Procesando imágenes ${processedImagesCount} de ${totalImagesToProcess}...`
}

function ReadOnlyImagePlaceholder({ message }: { message: string }) {
  return (
    <div
      className={[
        LOCATION_TOP_STACK_PLACEHOLDER_CLASS,
        'rounded-none border-solid border-slate-300 text-sm text-slate-600',
      ].join(' ')}
    >
      <p>{message}</p>
    </div>
  )
}

function ReadOnlyFieldValue({
  value,
}: {
  value: string | null | undefined
}) {
  const normalizedValue = value?.trim()

  return (
    <div className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm">
      {normalizedValue && normalizedValue.length > 0 ? normalizedValue : '-'}
    </div>
  )
}

function SectionCard({
  actions,
  children,
  description,
  title,
}: {
  actions?: React.ReactNode
  children: React.ReactNode
  description?: string
  title?: string
}) {
  return (
    <section className="-mx-9 w-[calc(100%+4.5rem)] space-y-5 rounded-none border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur-sm sm:-mx-6 sm:w-[calc(100%+3rem)] sm:rounded-[28px] sm:p-6 lg:p-7">
      {title || description || actions ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {title || description ? (
            <div className="space-y-1">
              {title ? (
                <h3 className="text-2xl font-semibold text-slate-950">{title}</h3>
              ) : null}
              {description ? (
                <p className="text-sm leading-6 text-slate-600">{description}</p>
              ) : null}
            </div>
          ) : (
            <div />
          )}
          {actions ? <div className="shrink-0 sm:ml-auto">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

function AccordionSectionCard({
  actions,
  children,
  description,
  isOpen,
  onToggle,
  title,
}: {
  actions?: React.ReactNode
  children: React.ReactNode
  description?: string
  isOpen: boolean
  onToggle: () => void
  title: string
}) {
  return (
    <section className="-mx-9 w-[calc(100%+4.5rem)] space-y-5 rounded-none border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur-sm sm:-mx-6 sm:w-[calc(100%+3rem)] sm:rounded-[28px] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start justify-between gap-4 rounded-2xl px-1 py-1 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
          aria-expanded={isOpen}
        >
          <div className="min-w-0 space-y-1">
            <h3 className="text-2xl font-semibold text-slate-950">{title}</h3>
            {description ? (
              <p className="text-sm leading-6 text-slate-600">{description}</p>
            ) : null}
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-slate-950 transition duration-300 ease-out">
            {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </span>
        </button>
        {actions ? <div className="shrink-0 sm:ml-auto">{actions}</div> : null}
      </div>
      <div
        className={[
          'grid overflow-hidden border-t border-slate-100 transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        ].join(' ')}
        aria-hidden={!isOpen}
      >
        <div
          className={[
            'min-h-0 pt-1 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
            isOpen ? 'translate-y-0' : '-translate-y-1',
          ].join(' ')}
        >
          {children}
        </div>
      </div>
    </section>
  )
}

const IMAGE_UPLOAD_CONCURRENCY = 3
const IMAGE_UPLOAD_TIMEOUT_MS = 90_000
const IMAGE_UPLOAD_TIMEOUT_ERROR_MESSAGE =
  'La subida tardó demasiado y fue cancelada. Intenta nuevamente.'

const SAVE_SUCCESS_DELAY_MS = 1000
const defaultOwnerQuickCreateValues: LocationOwnerQuickCreateValues = {
  full_name: '',
  company_name: '',
  email: '',
  phone: '',
  notes: '',
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function buildOwnerQuickCreatePayload(values: LocationOwnerQuickCreateValues) {
  return {
    full_name: normalizeInlineOwnerValue(values.full_name),
    company_name: toNullableString(values.company_name),
    email: toNullableString(values.email),
    phone: toE164OwnerPhone(values.phone),
    whatsapp: null,
    document_or_rut: null,
    notes: toNullableString(values.notes),
    status: 'active',
  }
}

function buildInlineOwnerCreatePayload(input: {
  full_name: string
  phone: string
}) {
  return {
    full_name: normalizeInlineOwnerValue(input.full_name),
    company_name: null,
    email: null,
    phone: toE164OwnerPhone(input.phone),
    whatsapp: null,
    document_or_rut: null,
    notes: null,
    status: 'active',
  }
}

function slugifyCategoryName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function slugifyZoneName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildSaveProgressState(input: {
  deletingTotal: number
  shouldSyncGallery: boolean
  uploadingTotal: number
}): LocationSaveProgressState {
  return {
    errorMessage: null,
    stages: [
      { key: 'location', status: 'pending' },
      {
        key: 'deleteImages',
        status: input.deletingTotal > 0 ? 'pending' : 'skipped',
      },
      {
        key: 'uploadImages',
        status: input.uploadingTotal > 0 ? 'pending' : 'skipped',
      },
      {
        key: 'syncGallery',
        status: input.shouldSyncGallery ? 'pending' : 'skipped',
      },
      { key: 'completed', status: 'pending' },
    ],
    successMessage: null,
    deletingDone: 0,
    deletingTotal: input.deletingTotal,
    uploadingDone: 0,
    uploadingTotal: input.uploadingTotal,
    uploadingCurrentIndex: null,
    uploadingCurrentName: null,
    uploadingCurrentStep: null,
  }
}

function getNextPendingImageOriginalIndex(
  currentImages: PendingLocationImageFile[],
) {
  const highestOriginalIndex = currentImages.reduce(
    (maxIndex, image) => Math.max(maxIndex, image.originalIndex),
    -1,
  )

  return highestOriginalIndex + 1
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error
      ? error.name === 'AbortError'
      : false
}

function revokePreviewUrl(previewUrl: string) {
  if (!previewUrl.startsWith('blob:')) {
    return
  }

  URL.revokeObjectURL(previewUrl)
}

function openDropboxChooser(
  dropbox: DropboxGlobal,
  target: ImageSelectionTarget,
) {
  return new Promise<DropboxChooserFile[]>((resolve, reject) => {
    try {
      dropbox.choose({
        linkType: 'direct',
        multiselect: target === 'gallery',
        folderselect: false,
        extensions: [...SUPPORTED_IMAGE_EXTENSIONS],
        success(files) {
          resolve(files)
        },
        cancel() {
          resolve([])
        },
      })
    } catch (error) {
      reject(error)
    }
  })
}

function LocationForm({
  mode = 'create',
  initialValues = defaultInitialValues,
  locationId,
  locationCode = null,
  primaryCardActions,
  showImagesSection = mode === 'create',
  showAdvancedSection = mode === 'edit',
}: LocationFormProps) {
  const isReadOnly = mode === 'view'
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [values, setValues] = useState<LocationFormValues>(initialValues)
  const [options, setOptions] = useState<LocationFormOptions | null>(null)
  const [isOptionsLoading, setIsOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFeaturesSectionOpen, setIsFeaturesSectionOpen] = useState(false)
  const [isGallerySectionOpen, setIsGallerySectionOpen] = useState(true)
  const [analysisState, setAnalysisState] =
    useState<LocationAnalysisState>(defaultAnalysisState)
  const [saveProgress, setSaveProgress] = useState<LocationSaveProgressState | null>(
    null,
  )
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isCategoryComboboxOpen, setIsCategoryComboboxOpen] = useState(false)
  const [categorySearchTerm, setCategorySearchTerm] = useState('')
  const [categoryCreateName, setCategoryCreateName] = useState('')
  const [categoryCreateError, setCategoryCreateError] = useState<string | null>(null)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false)
  const [isZoneComboboxOpen, setIsZoneComboboxOpen] = useState(false)
  const [zoneSearchTerm, setZoneSearchTerm] = useState('')
  const [zoneCreateName, setZoneCreateName] = useState('')
  const [zoneCreateError, setZoneCreateError] = useState<string | null>(null)
  const [isCreatingZone, setIsCreatingZone] = useState(false)
  const [zoneDepartmentPrompt, setZoneDepartmentPrompt] = useState<string | null>(null)
  const [isOwnerComboboxOpen, setIsOwnerComboboxOpen] = useState(false)
  const [ownerSearchTerm, setOwnerSearchTerm] = useState('')
  const [ownerPhoneInput, setOwnerPhoneInput] = useState('')
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false)
  const [ownerCreateValues, setOwnerCreateValues] =
    useState<LocationOwnerQuickCreateValues>(defaultOwnerQuickCreateValues)
  const [ownerCreateError, setOwnerCreateError] = useState<string | null>(null)
  const [isCreatingOwner, setIsCreatingOwner] = useState(false)
  const [isImageSourceModalOpen, setIsImageSourceModalOpen] = useState(false)
  const [imageSelectionTarget, setImageSelectionTarget] =
    useState<ImageSelectionTarget | null>(null)
  const [isDropboxImporting, setIsDropboxImporting] = useState(false)
  const [, setDropboxImportProgress] = useState<{
    processed: number
    total: number
  } | null>(null)
  const [pendingImages, setPendingImages] = useState<PendingLocationImageFile[]>(
    [],
  )
  const [imageValidationErrors, setImageValidationErrors] = useState<string[]>(
    [],
  )
  const [fieldErrors, setFieldErrors] = useState<LocationFormFieldErrors>(
    getDefaultFieldErrors(),
  )
  const [isPreparingImages, setIsPreparingImages] = useState(false)
  const [processedImagesCount, setProcessedImagesCount] = useState(0)
  const [totalImagesToProcess, setTotalImagesToProcess] = useState(0)
  const pendingImagesRef = useRef<PendingLocationImageFile[]>([])
  const [pendingDeletedPersistedImageIds, setPendingDeletedPersistedImageIds] =
    useState<string[]>([])
  const [editDeleteErrorMessage, setEditDeleteErrorMessage] = useState<string | null>(
    null,
  )
  const categoryComboboxRef = useRef<HTMLDivElement | null>(null)
  const coverImageUploaderRef = useRef<LocationImageUploaderHandle | null>(null)
  const dropboxAbortControllerRef = useRef<AbortController | null>(null)
  const isDropboxChooserLoadingRef = useRef(false)
  const galleryImageUploaderRef = useRef<LocationImageUploaderHandle | null>(null)
  const isMountedRef = useRef(true)
  const ownerComboboxRef = useRef<HTMLDivElement | null>(null)
  const removedPendingImageIdsRef = useRef<Set<string>>(new Set())
  const zoneComboboxRef = useRef<HTMLDivElement | null>(null)
  const locationImages = useLocationImages(
    mode !== 'create' ? locationId ?? null : null,
  )
  const googleMapsApiKey = useMemo(() => {
    try {
      return getGoogleMapsApiKey()
    } catch (error) {
      console.error('No pudimos leer la API key de Google Maps.', error)

      return null
    }
  }, [])

  async function loadFormOptions() {
    try {
      setIsOptionsLoading(true)
      setOptionsError(null)

      const nextOptions = await getLocationFormOptions()
      setOptions(nextOptions)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos cargar las opciones del formulario.'

      setOptionsError(message)
    } finally {
      setIsOptionsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    void getLocationFormOptions()
      .then((nextOptions) => {
        if (!isActive) {
          return
        }

        setOptions(nextOptions)
        setOptionsError(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos cargar las opciones del formulario.'

        setOptionsError(message)
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsOptionsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    pendingImagesRef.current = pendingImages
  }, [pendingImages])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      dropboxAbortControllerRef.current?.abort(
        new DOMException(
          'La importación desde Dropbox fue cancelada.',
          'AbortError',
        ),
      )
      pendingImagesRef.current.forEach((image) => {
        revokePreviewUrl(image.previewUrl)
      })
    }
  }, [])

  useEffect(() => {
    if (isReadOnly) {
      return
    }

    let isActive = true
    isDropboxChooserLoadingRef.current = true

    void loadDropboxChooser()
      .catch(() => {
        // Si falla la precarga, reintentamos cuando el usuario abra el modal o toque Dropbox.
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        isDropboxChooserLoadingRef.current = false
      })

    return () => {
      isActive = false
    }
  }, [isReadOnly])

  useEffect(() => {
    if (!isImageSourceModalOpen || isReadOnly) {
      return
    }

    if (getLoadedDropboxChooser() || isDropboxChooserLoadingRef.current) {
      return
    }

    let isActive = true
    isDropboxChooserLoadingRef.current = true

    void loadDropboxChooser()
      .catch(() => {
        // Intentamos precargar el script para abrir el chooser desde el click del usuario.
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        isDropboxChooserLoadingRef.current = false
      })

    return () => {
      isActive = false
    }
  }, [isImageSourceModalOpen, isReadOnly])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        categoryComboboxRef.current &&
        !categoryComboboxRef.current.contains(event.target as Node)
      ) {
        setIsCategoryComboboxOpen(false)
      }

      if (
        ownerComboboxRef.current &&
        !ownerComboboxRef.current.contains(event.target as Node)
      ) {
        setIsOwnerComboboxOpen(false)
      }

      if (
        zoneComboboxRef.current &&
        !zoneComboboxRef.current.contains(event.target as Node)
      ) {
        setIsZoneComboboxOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  const hasPersistedImagesMode = mode === 'edit' || mode === 'view'
  const visiblePersistedImages: LocationImageRecord[] =
    hasPersistedImagesMode
      ? locationImages.images.filter(
          (image) => !pendingDeletedPersistedImageIds.includes(image.id),
        )
      : []
  const hasAnalyzablePersistedImages =
    mode === 'edit' &&
    visiblePersistedImages.some((image) => image.url.trim().length > 0)
  const hasAnalyzablePendingImages = pendingImages.some(
    (image) => image.status === 'pending' && image.width > 0 && image.height > 0,
  )
  const persistedCoverImage: LocationImageRecord | null =
    hasPersistedImagesMode
      ? visiblePersistedImages.find((image) => image.is_cover === true) ?? null
      : null
  const persistedGalleryImages: LocationImageRecord[] =
    hasPersistedImagesMode
      ? persistedCoverImage
        ? visiblePersistedImages.filter((image) => image.id !== persistedCoverImage.id)
        : visiblePersistedImages
      : []
  const pendingCoverImage = pendingImages.find((image) => image.isCover) ?? null
  const pendingGalleryImages = pendingImages.filter((image) => !image.isCover)
  const hasProcessingPendingImages = pendingImages.some(
    (image) => image.status === 'processing',
  )
  const combinedEditGalleryImages = [
    ...persistedGalleryImages.map((image, index) => ({
      kind: 'persisted' as const,
      image,
      index,
    })),
    ...pendingGalleryImages.map((image) => ({
      kind: 'pending' as const,
      image,
    })),
  ]
  const selectedDepartment =
    options?.departments.find((department) => department.id === values.department_id) ??
    null
  const selectedCategoryName =
    options?.categories.find((category) => category.id === values.category_id)?.name ?? ''
  const selectedOwner =
    options?.owners.find((owner) => owner.id === values.owner_id) ?? null
  const selectedOwnerName = selectedOwner?.full_name ?? ''
  const selectedOwnerPhone = formatOwnerPhoneForInput(selectedOwner?.phone)
  const filteredZones = useMemo(
    () =>
      options?.zones.filter((zone) => zone.department_id === values.department_id) ??
      [],
    [options, values.department_id],
  )
  const selectedZoneName =
    filteredZones.find((zone) => zone.id === values.zone_id)?.name ?? ''
  const categoryInputValue =
    categorySearchTerm.length > 0 || values.category_id === ''
      ? categorySearchTerm
      : selectedCategoryName
  const ownerInputValue =
    ownerSearchTerm.length > 0 || values.owner_id === ''
      ? ownerSearchTerm
      : selectedOwnerName
  const ownerPhoneValue =
    ownerPhoneInput.length > 0 || values.owner_id === ''
      ? ownerPhoneInput
      : selectedOwnerPhone
  const zoneInputValue =
    zoneSearchTerm.length > 0 || values.zone_id === ''
      ? zoneSearchTerm
      : selectedZoneName
  const resolvedViewAddress =
    values.formatted_address?.trim() ||
    values.address_private.trim() ||
    null
  const filteredCategories = useMemo(() => {
    const normalizedSearch = categorySearchTerm.trim().toLocaleLowerCase()

    if (!options) {
      return []
    }

    if (normalizedSearch.length === 0) {
      return options.categories
    }

    return options.categories.filter((category) =>
      category.name.toLocaleLowerCase().startsWith(normalizedSearch),
    )
  }, [categorySearchTerm, options])
  const filteredOwners = useMemo(() => {
    const normalizedSearch = ownerSearchTerm.trim().toLocaleLowerCase()

    if (!options) {
      return []
    }

    if (normalizedSearch.length === 0) {
      return options.owners
    }

    return options.owners.filter((owner) =>
      owner.full_name.toLocaleLowerCase().startsWith(normalizedSearch),
    )
  }, [options, ownerSearchTerm])
  const filteredZoneOptions = useMemo(() => {
    const normalizedSearch = zoneSearchTerm.trim().toLocaleLowerCase()

    if (normalizedSearch.length === 0) {
      return filteredZones
    }

    return filteredZones.filter((zone) =>
      zone.name.toLocaleLowerCase().startsWith(normalizedSearch),
    )
  }, [filteredZones, zoneSearchTerm])
  const selectedTags = useMemo(
    () =>
      (options?.tags ?? []).filter((tag) => values.selectedTagIds.includes(tag.id)),
    [options, values.selectedTagIds],
  )
  const selectedFeatures = useMemo(
    () =>
      (options?.features ?? []).filter((feature) =>
        values.selectedFeatureIds.includes(feature.id),
      ),
    [options, values.selectedFeatureIds],
  )
  const availableTags = useMemo(
    () => (options?.tags ?? []).filter((tag) => tag.active === true),
    [options],
  )
  const suggestedFeatureNames = useMemo(
    () =>
      (options?.features ?? [])
        .filter((feature) => analysisState.suggestedFeatures.includes(feature.slug))
        .map((feature) => feature.name),
    [analysisState.suggestedFeatures, options],
  )
  const suggestedTagNames = useMemo(
    () =>
      (options?.tags ?? [])
        .filter((tag) => analysisState.suggestedTags.includes(tag.slug))
        .map((tag) => tag.name),
    [analysisState.suggestedTags, options],
  )
  const featureGroups = useMemo<GroupedSelectableOptions<LocationFeatureOption>[]>(() => {
    if (!options) {
      return []
    }

    const filteredFeatures = options.features.filter((feature) => {
      if (feature.active !== true) {
        return false
      }

      if (feature.type && feature.type !== 'boolean') {
        return false
      }

      if (isReadOnly && !values.selectedFeatureIds.includes(feature.id)) {
        return false
      }

      return true
    })

    return buildGroupedSelectableOptions<LocationFeatureOption>(filteredFeatures)
  }, [isReadOnly, options, values.selectedFeatureIds])

  function handleOwnerCreateChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (isReadOnly) {
      return
    }

    const { name, value } = event.target

    setOwnerCreateValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }))
  }

  function handleCategoryCreateChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (isReadOnly) {
      return
    }

    setCategoryCreateName(event.target.value)
  }

  function handleCategorySearchChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (isReadOnly) {
      return
    }

    const nextValue = event.target.value

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      category_id:
        nextValue.trim().length > 0 ? null : 'Debe seleccionar una categoría.',
    }))
    setCategorySearchTerm(nextValue)
    setIsCategoryComboboxOpen(true)

    const selectedCategory =
      options?.categories.find((category) => category.id === values.category_id) ?? null

    if (nextValue.trim().length === 0) {
      setValues((currentValues) => ({
        ...currentValues,
        category_id: '',
      }))
      return
    }

    if (selectedCategory && selectedCategory.name !== nextValue) {
      setValues((currentValues) => ({
        ...currentValues,
        category_id: '',
      }))
    }
  }

  function handleCategorySelect(categoryId: string, categoryName: string) {
    if (isReadOnly) {
      return
    }

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      category_id: null,
    }))
    setValues((currentValues) => ({
      ...currentValues,
      category_id: categoryId,
    }))
    setCategorySearchTerm(categoryName)
    setIsCategoryComboboxOpen(false)
  }

  function handleCategoryDropdownToggle() {
    if (isReadOnly) {
      return
    }

    setIsCategoryComboboxOpen((currentValue) => !currentValue)
  }

  function handleOwnerSearchChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (isReadOnly) {
      return
    }

    const nextValue = event.target.value

    setOwnerSearchTerm(nextValue)
    setIsOwnerComboboxOpen(true)
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      owner_name: null,
    }))

    if (nextValue.trim().length === 0) {
      setOwnerPhoneInput('')
      setValues((currentValues) => ({
        ...currentValues,
        owner_id: '',
      }))
      return
    }

    if (selectedOwner && selectedOwner.full_name !== nextValue) {
      setOwnerPhoneInput(formatOwnerPhoneForInput(selectedOwner.phone))
      setValues((currentValues) => ({
        ...currentValues,
        owner_id: '',
      }))
    }
  }

  function handleOwnerSelect(ownerId: string, ownerName: string) {
    if (isReadOnly) {
      return
    }

    const selectedOwnerOption =
      options?.owners.find((owner) => owner.id === ownerId) ?? null

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      owner_name: null,
      owner_phone: null,
    }))
    setValues((currentValues) => ({
      ...currentValues,
      owner_id: ownerId,
    }))
    setOwnerSearchTerm(ownerName)
    setOwnerPhoneInput(formatOwnerPhoneForInput(selectedOwnerOption?.phone))
    setIsOwnerComboboxOpen(false)
  }

  function handleOwnerPhoneChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (isReadOnly || values.owner_id) {
      return
    }

    setOwnerPhoneInput(event.target.value)
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      owner_phone: null,
    }))
  }

  function handleOwnerDropdownToggle() {
    if (isReadOnly) {
      return
    }

    setIsOwnerComboboxOpen((currentValue) => !currentValue)
  }

  function handleZoneSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (isReadOnly) {
      return
    }

    const nextValue = event.target.value

    setZoneSearchTerm(nextValue)
    setIsZoneComboboxOpen(true)

    const selectedZone =
      filteredZones.find((zone) => zone.id === values.zone_id) ?? null

    if (nextValue.trim().length === 0) {
      setValues((currentValues) => ({
        ...currentValues,
        zone_id: '',
      }))
      return
    }

    if (selectedZone && selectedZone.name !== nextValue) {
      setValues((currentValues) => ({
        ...currentValues,
        zone_id: '',
      }))
    }
  }

  function handleZoneSelect(zoneId: string, zoneName: string) {
    if (isReadOnly) {
      return
    }

    setValues((currentValues) => ({
      ...currentValues,
      zone_id: zoneId,
    }))
    setZoneSearchTerm(zoneName)
    setIsZoneComboboxOpen(false)
  }

  function handleZoneDropdownToggle() {
    if (isReadOnly) {
      return
    }

    if (!values.department_id) {
      return
    }

    setIsZoneComboboxOpen((currentValue) => !currentValue)
  }

  function handleZoneCreateChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (isReadOnly) {
      return
    }

    setZoneCreateName(event.target.value)
  }

  function handleOpenCategoryModal() {
    if (isReadOnly) {
      return
    }

    setCategoryCreateError(null)
    setCategoryCreateName('')
    setIsCategoryModalOpen(true)
  }

  function handleCloseCategoryModal() {
    if (isCreatingCategory) {
      return
    }

    setIsCategoryModalOpen(false)
    setCategoryCreateError(null)
    setCategoryCreateName('')
  }

  function handleOpenZoneModal() {
    if (isReadOnly) {
      return
    }

    if (!values.department_id) {
      setZoneDepartmentPrompt('Primero seleccioná un departamento.')
      return
    }

    setZoneDepartmentPrompt(null)
    setZoneCreateError(null)
    setZoneCreateName('')
    setIsZoneModalOpen(true)
  }

  function handleCloseZoneModal() {
    if (isCreatingZone) {
      return
    }

    setIsZoneModalOpen(false)
    setZoneCreateError(null)
    setZoneCreateName('')
  }

  async function handleCategoryQuickCreateSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (isReadOnly) {
      return
    }

    const trimmedName = categoryCreateName.trim()

    if (!trimmedName) {
      setCategoryCreateError('El nombre es obligatorio.')
      return
    }

    try {
      setIsCreatingCategory(true)
      setCategoryCreateError(null)

      const createdCategoryId = await createCategory({
        name: trimmedName,
        slug: slugifyCategoryName(trimmedName) || 'categoria',
        parent_id: null,
        sort_order: 0,
        active: true,
      }, {
        actorProfileId: profile?.id ?? null,
      })
      const nextOptions = await getLocationFormOptions()

      setOptions(nextOptions)
      setValues((currentValues) => ({
        ...currentValues,
        category_id: createdCategoryId,
      }))
      const createdCategory =
        nextOptions.categories.find((category) => category.id === createdCategoryId) ?? null
      setCategorySearchTerm(createdCategory?.name ?? trimmedName)
      setIsCategoryModalOpen(false)
      setCategoryCreateName('')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos crear la categoría.'

      setCategoryCreateError(message)
    } finally {
      setIsCreatingCategory(false)
    }
  }

  async function handleZoneQuickCreateSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (isReadOnly) {
      return
    }

    const trimmedName = zoneCreateName.trim()

    if (!trimmedName) {
      setZoneCreateError('El nombre es obligatorio.')
      return
    }

    if (!values.department_id || !selectedDepartment) {
      setZoneCreateError('Primero seleccioná un departamento.')
      return
    }

    try {
      setIsCreatingZone(true)
      setZoneCreateError(null)

      const createdZoneId = await createZone({
        name: trimmedName,
        slug: slugifyZoneName(trimmedName) || 'zona',
        department_id: values.department_id,
        active: true,
        department: selectedDepartment.name,
        lat: null,
        lng: null,
      }, {
        actorProfileId: profile?.id ?? null,
      })
      const nextOptions = await getLocationFormOptions()

      setOptions(nextOptions)
      setValues((currentValues) => ({
        ...currentValues,
        zone_id: createdZoneId,
      }))
      const createdZone =
        nextOptions.zones.find((zone) => zone.id === createdZoneId) ?? null
      setZoneSearchTerm(createdZone?.name ?? trimmedName)
      setZoneDepartmentPrompt(null)
      setIsZoneModalOpen(false)
      setZoneCreateName('')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos crear la zona.'

      setZoneCreateError(message)
    } finally {
      setIsCreatingZone(false)
    }
  }

  function handleCloseOwnerModal() {
    if (isCreatingOwner) {
      return
    }

    setIsOwnerModalOpen(false)
    setOwnerCreateError(null)
    setOwnerCreateValues(defaultOwnerQuickCreateValues)
  }

  function abortActiveDropboxImport() {
    dropboxAbortControllerRef.current?.abort(
      new DOMException(
        'La importación desde Dropbox fue cancelada.',
        'AbortError',
      ),
    )
    dropboxAbortControllerRef.current = null
  }

  function handleOpenImageSourceModal(target: ImageSelectionTarget) {
    if (isReadOnly || isDropboxImporting) {
      return
    }

    setImageSelectionTarget(target)
    setIsImageSourceModalOpen(true)
  }

  function handleCloseImageSourceModal() {
    if (isDropboxImporting) {
      return
    }

    setIsImageSourceModalOpen(false)
    setImageSelectionTarget(null)
  }

  function handleSelectDeviceSource() {
    if (!imageSelectionTarget || isDropboxImporting) {
      return
    }

    const target = imageSelectionTarget
    setIsImageSourceModalOpen(false)

    window.setTimeout(() => {
      if (target === 'cover') {
        coverImageUploaderRef.current?.openFileDialog()
        return
      }

      galleryImageUploaderRef.current?.openFileDialog()
    }, 0)
  }

  async function continueDropboxImport(
    selectedFilesPromise: Promise<DropboxChooserFile[]>,
    target: ImageSelectionTarget,
  ) {
    try {
      const selectedFiles = await selectedFilesPromise

      if (!isMountedRef.current) {
        return
      }

      if (selectedFiles.length === 0) {
        setImageSelectionTarget(null)
        return
      }

      const controller = new AbortController()
      dropboxAbortControllerRef.current = controller
      setIsDropboxImporting(true)
      setDropboxImportProgress({
        processed: 0,
        total: selectedFiles.length,
      })

      const { files, errors } = await downloadDropboxFiles(selectedFiles, {
        signal: controller.signal,
        onProgress: (processed, total) => {
          if (!isMountedRef.current) {
            return
          }

          setDropboxImportProgress({
            processed,
            total,
          })
        },
      })

      if (!isMountedRef.current) {
        return
      }

      if (files.length === 0) {
        setImageValidationErrors(
          errors.length > 0
            ? errors
            : ['No pudimos importar archivos desde Dropbox.'],
        )
        setImageSelectionTarget(null)
        return
      }

      await handleSelectedImageFiles(files, target)

      if (!isMountedRef.current) {
        return
      }

      if (errors.length > 0) {
        setImageValidationErrors((currentErrors) => [
          ...errors,
          ...currentErrors,
        ])
      }

      setImageSelectionTarget(null)
    } catch (error) {
      if (!isMountedRef.current || isAbortError(error)) {
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos importar las imágenes desde Dropbox.'

      setImageValidationErrors([message])
      setImageSelectionTarget(null)
    } finally {
      dropboxAbortControllerRef.current = null

      if (isMountedRef.current) {
        setIsDropboxImporting(false)
        setDropboxImportProgress(null)
      }
    }
  }

  function handleSelectDropboxSource() {
    if (import.meta.env.DEV) {
      console.debug('[Dropbox] handler ejecutado')
    }

    if (isDropboxImporting) {
      return
    }

    const target = imageSelectionTarget

    if (!target) {
      setImageValidationErrors([
        'No pudimos determinar si querías importar portada o galería.',
      ])
      return
    }

    abortActiveDropboxImport()
    setEditDeleteErrorMessage(null)

    const dropbox = getLoadedDropboxChooser()

    if (!dropbox) {
      setImageValidationErrors([
        'Preparando Dropbox... Intenta nuevamente en un momento.',
      ])

      if (!isDropboxChooserLoadingRef.current) {
        isDropboxChooserLoadingRef.current = true
        void loadDropboxChooser()
          .catch(() => {
            if (!isMountedRef.current) {
              return
            }

            setImageValidationErrors([
              'No pudimos cargar Dropbox Chooser. Intenta nuevamente.',
            ])
          })
          .finally(() => {
            if (!isMountedRef.current) {
              return
            }

            isDropboxChooserLoadingRef.current = false
          })
      }

      return
    }

    if (
      typeof dropbox.isBrowserSupported === 'function' &&
      !dropbox.isBrowserSupported()
    ) {
      setImageValidationErrors([
        'Dropbox no es compatible con este navegador.',
      ])
      return
    }

    if (import.meta.env.DEV) {
      console.debug('[Dropbox] abriendo chooser')
    }

    const selectedFilesPromise = openDropboxChooser(dropbox, target)
    setIsImageSourceModalOpen(false)
    void continueDropboxImport(selectedFilesPromise, target)
  }

  async function handleOwnerQuickCreateSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (isReadOnly) {
      return
    }

    const trimmedName = ownerCreateValues.full_name.trim()

    if (!trimmedName) {
      setOwnerCreateError('El nombre completo es obligatorio.')
      return
    }

    if (ownerCreateValues.phone.trim().length > 0 && !toE164OwnerPhone(ownerCreateValues.phone)) {
      setOwnerCreateError('Ingresá un teléfono válido con código de país.')
      return
    }

    try {
      setIsCreatingOwner(true)
      setOwnerCreateError(null)

      const createdOwnerId = await createOwner(
        buildOwnerQuickCreatePayload(ownerCreateValues),
        {
          actorProfileId: profile?.id ?? null,
        },
      )
      const nextOptions = await getLocationFormOptions()

      setOptions(nextOptions)
      setValues((currentValues) => ({
        ...currentValues,
        owner_id: createdOwnerId,
      }))
      const createdOwner =
        nextOptions.owners.find((owner) => owner.id === createdOwnerId) ?? null
      setOwnerSearchTerm(createdOwner?.full_name ?? normalizeInlineOwnerValue(trimmedName))
      setOwnerPhoneInput(
        formatOwnerPhoneForInput(
          createdOwner?.phone ?? normalizeInlineOwnerValue(ownerCreateValues.phone),
        ),
      )
      setIsOwnerModalOpen(false)
      setOwnerCreateValues(defaultOwnerQuickCreateValues)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos crear el dueño.'

      setOwnerCreateError(message)
    } finally {
      setIsCreatingOwner(false)
    }
  }

  function openSaveProgress() {
    setSaveProgress(
      buildSaveProgressState({
        deletingTotal: pendingDeletedPersistedImageIds.length,
        shouldSyncGallery:
          mode === 'edit' &&
          (pendingDeletedPersistedImageIds.length > 0 || pendingImages.length > 0),
        uploadingTotal: pendingImages.length,
      }),
    )
  }

  function updateSaveProgress(
    updater: (currentState: LocationSaveProgressState) => LocationSaveProgressState,
  ) {
    setSaveProgress((currentState) => {
      if (!currentState) {
        return currentState
      }

      return updater(currentState)
    })
  }

  function updateStageStatus(
    key: LocationSaveStageKey,
    status: LocationSaveStageStatus,
  ) {
    updateSaveProgress((currentState) => ({
      ...currentState,
      stages: currentState.stages.map((stage) =>
        stage.key === key
          ? {
              ...stage,
              status,
            }
          : stage,
      ),
    }))
  }

  function setSaveProgressError(
    key: LocationSaveStageKey,
    message: string,
  ) {
    updateSaveProgress((currentState) => ({
      ...currentState,
      errorMessage: message,
      stages: currentState.stages.map((stage) =>
        stage.key === key
          ? {
              ...stage,
              status: 'error',
            }
          : stage,
      ),
    }))
  }

function markSaveProgressSuccess() {
  updateSaveProgress((currentState) => ({
    ...currentState,
    successMessage: 'Cambios guardados correctamente',
  }))
}

  function handleTextChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    if (isReadOnly) {
      return
    }

    const { name, value } = event.target
    const nextFieldError =
      name === 'title'
        ? value.trim().length > 0
          ? null
          : 'El título es obligatorio.'
        : name === 'category_id'
        ? value.trim().length > 0
          ? null
          : 'Debe seleccionar una categoría.'
        : name === 'address_private'
            ? value.trim().length > 0
              ? null
              : 'Debe ingresar una dirección.'
            : null

    if (
      name === 'title' ||
      name === 'category_id' ||
      name === 'address_private'
    ) {
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        [name]: nextFieldError,
      }))
    }

    if (name === 'title') {
      const nextSlug = slugifyTitle(value)

      setValues((currentValues) => ({
        ...currentValues,
        slug: nextSlug,
        title: value,
      }))

      return
    }

    if (name === 'department_id') {
      setZoneSearchTerm('')
      setIsZoneComboboxOpen(false)
      setZoneDepartmentPrompt(null)

      setValues((currentValues) => ({
        ...currentValues,
        department_id: value,
        zone_id: '',
      }))

      return
    }

    setValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }))
  }

  function handleCheckboxChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (isReadOnly) {
      return
    }

    const { checked, name } = event.target

    setValues((currentValues) => ({
      ...currentValues,
      [name]: checked,
    }))
  }

  function handleFeatureToggle(featureId: string) {
    if (isReadOnly) {
      return
    }

    setValues((currentValues) => {
      const nextSelectedFeatureIds = new Set(currentValues.selectedFeatureIds)

      if (nextSelectedFeatureIds.has(featureId)) {
        nextSelectedFeatureIds.delete(featureId)
      } else {
        nextSelectedFeatureIds.add(featureId)
      }

      return {
        ...currentValues,
        selectedFeatureIds: Array.from(nextSelectedFeatureIds),
      }
    })
  }

  function handleTagToggle(tagId: string) {
    if (isReadOnly) {
      return
    }

    setValues((currentValues) => {
      const nextTagIds = new Set(currentValues.selectedTagIds)

      if (nextTagIds.has(tagId)) {
        nextTagIds.delete(tagId)
      } else {
        nextTagIds.add(tagId)
      }

      return {
        ...currentValues,
        selectedTagIds: Array.from(nextTagIds),
      }
    })
  }

  function resetAnalysisState() {
    setAnalysisState(defaultAnalysisState)
  }

  async function handleAnalyzeLocation() {
    if (isReadOnly || !options) {
      return
    }

    const pendingImagesForAnalysis = pendingImages
      .filter((image) => image.status === 'pending' && image.width > 0 && image.height > 0)
      .sort((leftImage, rightImage) => leftImage.originalIndex - rightImage.originalIndex)

    let transientPendingAnalysisImages: LocationAnalysisImageInput[] = []

    try {
      transientPendingAnalysisImages = await Promise.all(
        pendingImagesForAnalysis.map(async (image) => ({
          id: image.id,
          kind: 'file' as const,
          dataUrl: await readFileAsDataUrl(image.file),
          mimeType: image.file.type.trim() || null,
          filename: image.file.name.trim() || null,
          isCover: image.isCover,
          order: image.originalIndex,
        })),
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos preparar las imagenes para el analisis.'

      setAnalysisState((currentState) => ({
        ...currentState,
        analysisError: message,
        analysisLoading: false,
        analysisResult: null,
        suggestedDescription: null,
        suggestedFeatures: [],
        suggestedTags: [],
      }))
      return
    }

    const analysisInput: LocationAnalysisInput = {
      title: values.title.trim(),
      locationId,
      locationCode,
      categoryName: selectedCategoryName.trim() || null,
      departmentName: selectedDepartment?.name?.trim() || null,
      zoneName: selectedZoneName.trim() || null,
      formattedAddress: values.formatted_address,
      googleDepartmentName: values.google_department_name,
      googleZoneName: values.google_zone_name,
      latitude: values.lat,
      longitude: values.lng,
      approxLatitude: values.approx_lat,
      approxLongitude: values.approx_lng,
      showExactLocation: values.show_exact_location,
      mapVisibility: values.map_visibility,
      description: values.description.trim() || null,
      currentFeatureSlugs: selectedFeatures.map((feature) => feature.slug),
      currentTagSlugs: selectedTags.map((tag) => tag.slug),
      availableFeatures: (options.features ?? []).map((feature) => ({
        name: feature.name,
        slug: feature.slug,
        group: feature.group,
        aliases: [...feature.aliases],
      })),
      availableTags: (options.tags ?? []).map((tag) => ({
        name: tag.name,
        slug: tag.slug,
        category: tag.group,
        aliases: [...tag.aliases],
      })),
      images: [
        ...visiblePersistedImages.map((image) => ({
          id: image.id,
          kind: 'url' as const,
          url: image.url,
          isCover: image.is_cover === true,
          order: image.sort_order,
        })),
        ...transientPendingAnalysisImages,
      ],
    }

    try {
      setAnalysisState((currentState) => ({
        ...currentState,
        analysisError: null,
        analysisLoading: true,
        analysisResult: null,
        suggestedDescription: null,
        suggestedFeatures: [],
        suggestedTags: [],
      }))

      const result = await locationAnalysisService.analyzeLocation(analysisInput)

      setAnalysisState({
        analysisError: null,
        analysisLoading: false,
        analysisResult: result,
        suggestedDescription: result.description,
        suggestedFeatures: result.featureSlugs,
        suggestedTags: result.tagSlugs,
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos analizar la locación.'

      setAnalysisState((currentState) => ({
        ...currentState,
        analysisError: message,
        analysisLoading: false,
        analysisResult: null,
        suggestedDescription: null,
        suggestedFeatures: [],
        suggestedTags: [],
      }))
    } finally {
      transientPendingAnalysisImages = []
    }
  }

  function handleApplyAnalysisChanges() {
    if (!options || !analysisState.analysisResult) {
      return
    }

    const nextSelectedFeatureIds = options.features
      .filter((feature) =>
        analysisState.analysisResult?.featureSlugs.includes(feature.slug),
      )
      .map((feature) => feature.id)
    const nextSelectedTagIds = options.tags
      .filter((tag) => analysisState.analysisResult?.tagSlugs.includes(tag.slug))
      .map((tag) => tag.id)

    setValues((currentValues) => ({
      ...currentValues,
      description: analysisState.analysisResult?.description ?? currentValues.description,
      selectedFeatureIds: nextSelectedFeatureIds,
      selectedTagIds: nextSelectedTagIds,
    }))

    resetAnalysisState()
  }

  function handleGooglePlaceSelected(place: ParsedGooglePlaceAddress) {
    if (isReadOnly) {
      return
    }

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      address_private: place.formatted_address ? null : currentErrors.address_private,
    }))
    setValues((currentValues) => {
      const normalizedGoogleDepartment = normalizeDepartmentName(
        place.google_department_name,
      )
      const matchingDepartments = normalizedGoogleDepartment
        ? (options?.departments ?? []).filter(
            (department) =>
              normalizeDepartmentName(department.name) ===
              normalizedGoogleDepartment,
          )
        : []
      const departmentId =
        matchingDepartments.length === 1
          ? matchingDepartments[0]?.id ?? currentValues.department_id
          : currentValues.department_id
      const publicCoordinates = resolvePublicLocationCoordinates({
        lat: place.lat,
        lng: place.lng,
        currentPublicLat: currentValues.approx_lat,
        currentPublicLng: currentValues.approx_lng,
        previousLat: currentValues.lat,
        previousLng: currentValues.lng,
      })

      return {
        ...currentValues,
        address_private:
          place.formatted_address ?? currentValues.address_private,
        formatted_address: place.formatted_address,
        google_place_id: place.google_place_id,
        google_department_name: place.google_department_name,
        department_id: departmentId,
        google_zone_name: place.google_zone_name,
        address_components: place.address_components,
        lat: place.lat,
        lng: place.lng,
        approx_lat: publicCoordinates?.lat ?? null,
        approx_lng: publicCoordinates?.lng ?? null,
      }
    })
  }

  async function handleSelectedImageFiles(
    files: File[],
    target: 'cover' | 'gallery',
  ) {
    if (isReadOnly || files.length === 0) {
      return
    }

    const isCoverSelection = target === 'cover'
    const selectedFiles = isCoverSelection ? files.slice(0, 1) : files
    const totalFiles = selectedFiles.length
    setTotalImagesToProcess(totalFiles)
    setProcessedImagesCount(0)
    setIsPreparingImages(true)
    setImageValidationErrors([])

    try {
      const startingOriginalIndex = getNextPendingImageOriginalIndex(
        pendingImagesRef.current,
      )
      setEditDeleteErrorMessage(null)
      const placeholders = selectedFiles.map((file, index) => {
        const placeholder = createPendingLocationImagePlaceholder(file, {
          isCover: isCoverSelection && index === 0,
          originalIndex: startingOriginalIndex + index,
          target,
        })

        removedPendingImageIdsRef.current.delete(placeholder.id)
        return placeholder
      })

      setPendingImages((currentImages) => {
        if (!isCoverSelection) {
          return [...currentImages, ...placeholders]
        }

        const nextImages: PendingLocationImageFile[] = []

        currentImages.forEach((image) => {
          if (image.selectionTarget === 'cover' && image.isCover) {
            removedPendingImageIdsRef.current.add(image.id)
            revokePreviewUrl(image.previewUrl)
            return
          }

          nextImages.push({
            ...image,
            isCover: false,
          })
        })

        return [...nextImages, ...placeholders]
      })
      setImageSelectionTarget(null)

      const nextErrors: string[] = []

      for (const [index, placeholder] of placeholders.entries()) {
        try {
          const preparedImage = await preparePendingLocationImage(placeholder.file, {
            id: placeholder.id,
            isCover: placeholder.isCover,
            originalIndex: placeholder.originalIndex,
            target,
          })

          if (
            !isMountedRef.current ||
            removedPendingImageIdsRef.current.has(preparedImage.id)
          ) {
            revokePreviewUrl(preparedImage.previewUrl)
            continue
          }

          setPendingImages((currentImages) =>
            currentImages.map((image) =>
              image.id === preparedImage.id
                ? {
                    ...image,
                    errorMessage: null,
                    file: preparedImage.file,
                    height: preparedImage.height,
                    previewUrl: preparedImage.previewUrl,
                    status: 'pending',
                    width: preparedImage.width,
                  }
                : image,
            ),
          )
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : `${placeholder.file.name}: no pudimos optimizar la imagen seleccionada.`

          nextErrors.push(message)

          if (!isMountedRef.current || removedPendingImageIdsRef.current.has(placeholder.id)) {
            continue
          }

          setPendingImages((currentImages) =>
            currentImages.map((image) =>
              image.id === placeholder.id
                ? {
                    ...image,
                    errorMessage: message,
                    status: 'error',
                  }
                : image,
            ),
          )
        } finally {
          if (isMountedRef.current) {
            setProcessedImagesCount(Math.min(index + 1, totalFiles))
          }
        }
      }

      if (isMountedRef.current) {
        setImageValidationErrors(nextErrors)
      }
    } finally {
      if (isMountedRef.current) {
        setIsPreparingImages(false)
      }
    }
  }

  async function handleCoverImageSelected(files: FileList | null) {
    const filesArray = Array.from(files ?? [])

    if (filesArray.length === 0) {
      return
    }

    await handleSelectedImageFiles(filesArray, 'cover')
  }

  async function handleGalleryImagesSelected(files: FileList | null) {
    const filesArray = Array.from(files ?? [])

    if (filesArray.length === 0) {
      return
    }

    await handleSelectedImageFiles(filesArray, 'gallery')
  }

  function handleRemovePendingImage(imageId: string) {
    if (isReadOnly) {
      return
    }

    removedPendingImageIdsRef.current.add(imageId)
    setPendingImages((currentImages) => {
      const imageToRemove = currentImages.find((image) => image.id === imageId)

      if (imageToRemove) {
        revokePreviewUrl(imageToRemove.previewUrl)
      }

      return currentImages.filter((image) => image.id !== imageId)
    })
  }

  function renderImageFeedback() {
    if (imageValidationErrors.length === 0) {
      return null
    }

    return (
      <div className="space-y-3">
        {imageValidationErrors.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <ul className="space-y-1">
              {imageValidationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    )
  }

  function handleSetCoverImage(imageId: string) {
    if (isReadOnly) {
      return
    }

    setPendingImages((currentImages) =>
      currentImages.map((image) => ({
        ...image,
        isCover: image.id === imageId,
      })),
    )
  }

  async function handleDeletePersistedImage(imageId: string) {
    if (isReadOnly || mode !== 'edit' || !locationId) {
      return
    }

    setEditDeleteErrorMessage(null)
    setPendingDeletedPersistedImageIds((currentIds) =>
      currentIds.includes(imageId) ? currentIds : [...currentIds, imageId],
    )
  }

  function updatePendingImage(
    imageId: string,
    updates: Partial<PendingLocationImageFile>,
  ) {
    setPendingImages((currentImages) =>
      currentImages.map((image) =>
        image.id === imageId
          ? {
              ...image,
              ...updates,
            }
          : image,
      ),
    )
  }

  async function runPendingImageDeletes(nextLocationId: string) {
    if (pendingDeletedPersistedImageIds.length === 0) {
      updateStageStatus('deleteImages', 'skipped')
      return
    }

    updateStageStatus('deleteImages', 'active')

    for (const [index, imageId] of pendingDeletedPersistedImageIds.entries()) {
      updateSaveProgress((currentState) => ({
        ...currentState,
        deletingDone: index,
      }))

      try {
        await deleteLocationImage({
          imageId,
          locationId: nextLocationId,
        })
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos eliminar una de las imagenes.'

        setEditDeleteErrorMessage(message)
        setSaveProgressError('deleteImages', message)
        throw new Error(message, { cause: error })
      }

      updateSaveProgress((currentState) => ({
        ...currentState,
        deletingDone: index + 1,
      }))
    }

    updateStageStatus('deleteImages', 'done')
  }

  async function runPendingImageUploads(nextLocationId: string) {
    if (pendingImages.length === 0) {
      updateStageStatus('uploadImages', 'skipped')
      return null
    }

    let hasImageErrors = false
    const persistedSortOrderBase =
      mode === 'edit'
        ? visiblePersistedImages.reduce(
            (maxSortOrder, image) => Math.max(maxSortOrder, image.sort_order),
            -1,
          ) + 1
        : 0
    const uploads = [...pendingImages]
      .filter(
        (image) =>
          image.status === 'pending' ||
          (image.status === 'error' && image.width > 0 && image.height > 0),
      )
      .sort((leftImage, rightImage) => leftImage.originalIndex - rightImage.originalIndex)
      .map((image) => ({
        image,
        sortOrder: persistedSortOrderBase + image.originalIndex,
      }))

    if (uploads.length === 0) {
      updateStageStatus('uploadImages', 'skipped')
      return null
    }
    const activeUploadStatuses = new Map<
      string,
      Extract<PendingLocationImageStatus, 'uploading' | 'finalizing'>
    >()
    let completedUploads = 0
    let nextUploadIndex = 0

    function syncUploadProgress() {
      const activeUploadStatusesList = Array.from(activeUploadStatuses.values())
      const uploadingCurrentStep =
        activeUploadStatusesList.length === 0
          ? null
          : activeUploadStatusesList.includes('finalizing')
            ? 'finalizing'
            : 'uploading'

      updateSaveProgress((currentState) => ({
        ...currentState,
        uploadingDone: completedUploads,
        uploadingCurrentIndex:
          activeUploadStatusesList.length > 0
            ? Math.min(completedUploads + 1, currentState.uploadingTotal)
            : null,
        uploadingCurrentName: null,
        uploadingCurrentStep,
      }))
    }

    async function processUpload(
      image: PendingLocationImageFile,
      sortOrder: number,
    ) {
      const controller = new AbortController()
      let uploadTimeoutId: number | null = null

      try {
        updatePendingImage(image.id, {
          errorMessage: null,
          status: 'uploading',
        })

        activeUploadStatuses.set(image.id, 'uploading')
        syncUploadProgress()
        console.info('[UPLOAD START]', image.id)

        const uploadTask = uploadLocationImage({
          file: image.file,
          height: image.height,
          isCover: image.isCover,
          locationId: nextLocationId,
          sortOrder,
          width: image.width,
          signal: controller.signal,
          onStatusChange: (status) => {
            updatePendingImage(image.id, {
              status,
            })

            activeUploadStatuses.set(image.id, status)
            syncUploadProgress()
          },
        })
        uploadTimeoutId = window.setTimeout(() => {
          controller.abort(new Error(IMAGE_UPLOAD_TIMEOUT_ERROR_MESSAGE))
        }, IMAGE_UPLOAD_TIMEOUT_MS)

        await uploadTask

        updatePendingImage(image.id, {
          errorMessage: null,
          status: 'done',
        })
        console.info('[UPLOAD SUCCESS]', image.id)
      } catch (error) {
        hasImageErrors = true

        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos subir esta imagen.'

        if (message === IMAGE_UPLOAD_TIMEOUT_ERROR_MESSAGE) {
          console.warn('[UPLOAD TIMEOUT]', image.id)
        } else {
          console.error('[UPLOAD ERROR]', image.id, error)
        }

        updatePendingImage(image.id, {
          errorMessage: message,
          status: 'error',
        })
      } finally {
        if (uploadTimeoutId !== null) {
          window.clearTimeout(uploadTimeoutId)
        }

        activeUploadStatuses.delete(image.id)
        completedUploads += 1
        syncUploadProgress()
      }
    }

    async function runUploadWorker() {
      while (nextUploadIndex < uploads.length) {
        const currentUploadIndex = nextUploadIndex
        nextUploadIndex += 1

        const currentUpload = uploads[currentUploadIndex]

        if (!currentUpload) {
          return
        }

        await processUpload(currentUpload.image, currentUpload.sortOrder)
      }
    }

    updateStageStatus('uploadImages', 'active')
    syncUploadProgress()

    const workerCount = Math.min(IMAGE_UPLOAD_CONCURRENCY, uploads.length)

    await Promise.all(
      Array.from({ length: workerCount }, () => runUploadWorker()),
    )

    if (hasImageErrors) {
      const message =
        mode === 'edit'
          ? 'Los cambios de la locacion fueron guardados, pero algunas imagenes no se pudieron subir. Revisalas y volve a intentar.'
          : 'La locacion fue creada, pero algunas imagenes no se pudieron subir. Podes completarlas desde edicion.'

      setSaveProgressError('uploadImages', message)
      return message
    }

    updateStageStatus('uploadImages', 'done')
    return null
  }

  async function syncVisibleGallery() {
    const shouldSyncGallery =
      mode === 'edit' &&
      (pendingDeletedPersistedImageIds.length > 0 || pendingImages.length > 0)

    if (!shouldSyncGallery) {
      updateStageStatus('syncGallery', 'skipped')
      return
    }

    updateStageStatus('syncGallery', 'active')
    await locationImages.refresh()
    updateStageStatus('syncGallery', 'done')
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isReadOnly) {
      return
    }

    const nextFieldErrors = validateRequiredFields(values, {
      ownerName: ownerInputValue,
      ownerPhone: ownerPhoneValue,
    })

    setFieldErrors(nextFieldErrors)

    if (hasFieldErrors(nextFieldErrors)) {
      const firstErrorMessage =
        nextFieldErrors.title ??
        nextFieldErrors.category_id ??
        nextFieldErrors.address_private ??
        nextFieldErrors.owner_name ??
        nextFieldErrors.owner_phone ??
        'No pudimos guardar la locación.'

      setSubmitError(firstErrorMessage)
      return
    }

    let resolvedOwnerId = values.owner_id || null
    let createdOwnerName: string | null = null

    try {
      setIsSubmitting(true)
      setSubmitError(null)
      setEditDeleteErrorMessage(null)
      openSaveProgress()
      updateStageStatus('location', 'active')

      if (!resolvedOwnerId) {
        const normalizedOwnerName = normalizeInlineOwnerValue(ownerInputValue)
        const normalizedOwnerPhone = normalizeInlineOwnerValue(ownerPhoneValue)

        if (normalizedOwnerName.length > 0 && normalizedOwnerPhone.length > 0) {
          resolvedOwnerId = await createOwner(
            buildInlineOwnerCreatePayload({
              full_name: normalizedOwnerName,
              phone: normalizedOwnerPhone,
            }),
            {
              actorProfileId: profile?.id ?? null,
            },
          )
          createdOwnerName = normalizedOwnerName
          setValues((currentValues) => ({
            ...currentValues,
            owner_id: resolvedOwnerId ?? '',
          }))
          setOwnerSearchTerm(normalizedOwnerName)
          setOwnerPhoneInput(normalizedOwnerPhone)
        }
      }

      const payload = buildPayload(
        {
          ...values,
          owner_id: resolvedOwnerId ?? '',
        },
        {
          mode,
          initialValues,
        },
      )

      if (mode === 'edit') {
        if (!locationId) {
          throw new Error('Falta el identificador de la locación a editar.')
        }

        await updateLocation(locationId, payload, {
          actorProfileId: profile?.id ?? null,
        })
        updateStageStatus('location', 'done')

        await runPendingImageDeletes(locationId)
        setPendingDeletedPersistedImageIds([])
        const uploadErrorMessage = await runPendingImageUploads(locationId)
        await syncVisibleGallery()

        setPendingImages((currentImages) => {
          currentImages.forEach((image) => {
            if (image.status === 'done') {
              revokePreviewUrl(image.previewUrl)
            }
          })

          return currentImages.filter((image) => image.status !== 'done')
        })

        if (uploadErrorMessage) {
          throw new Error(uploadErrorMessage)
        }

        updateStageStatus('completed', 'done')
        markSaveProgressSuccess()
        await wait(SAVE_SUCCESS_DELAY_MS)
        navigate(routePaths.locations)
      } else {
        const createdLocationId = await createLocation(payload, {
          actorProfileId: profile?.id ?? null,
        })
        updateStageStatus('location', 'done')

        await runPendingImageDeletes(createdLocationId)
        setPendingDeletedPersistedImageIds([])

        const uploadErrorMessage = await runPendingImageUploads(createdLocationId)

        setPendingImages((currentImages) => {
          currentImages.forEach((image) => {
            if (image.status === 'done') {
              revokePreviewUrl(image.previewUrl)
            }
          })

          return currentImages.filter((image) => image.status !== 'done')
        })

        if (uploadErrorMessage) {
          await wait(SAVE_SUCCESS_DELAY_MS)
          navigate(getLocationEditPath(createdLocationId))
          return
        }

        await syncVisibleGallery()

        updateStageStatus('completed', 'done')
        markSaveProgressSuccess()
        await wait(SAVE_SUCCESS_DELAY_MS)
        navigate(routePaths.locations)
      }
    } catch (error) {
      const defaultErrorMessage =
        createdOwnerName
          ? `El dueño "${createdOwnerName}" se creó correctamente, pero no pudimos guardar la locación.`
          : mode === 'edit'
            ? 'No pudimos guardar los cambios.'
            : 'No pudimos guardar la locación.'
      const message =
        error instanceof Error
          ? createdOwnerName
            ? `${defaultErrorMessage} ${error.message}`
            : error.message
          : defaultErrorMessage

      setSubmitError(message)
      updateSaveProgress((currentState) =>
        currentState.errorMessage
          ? currentState
          : {
              ...currentState,
              errorMessage: message,
              stages: currentState.stages.map((stage) =>
                stage.key === 'location'
                  ? {
                      ...stage,
                      status: 'error',
                    }
                  : stage,
              ),
            },
      )
      await wait(SAVE_SUCCESS_DELAY_MS)
      setSaveProgress(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isOptionsLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <p className="text-sm text-slate-600">
          Cargando opciones del formulario...
        </p>
      </div>
    )
  }

  if (optionsError || !options) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            No pudimos cargar el formulario
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {optionsError ?? 'Faltan datos base para renderizar el formulario.'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => void loadFormOptions()}>
            Reintentar
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(routePaths.locations)}
          >
            Volver
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      {!isReadOnly ? <LocationSaveProgressModal progress={saveProgress} /> : null}
      {!isReadOnly ? (
        <LocationImageSourceModal
          isDropboxImporting={isDropboxImporting}
          isOpen={isImageSourceModalOpen}
          onChooseDevice={handleSelectDeviceSource}
          onChooseDropbox={() => void handleSelectDropboxSource()}
          onClose={handleCloseImageSourceModal}
          target={imageSelectionTarget}
        />
      ) : null}
      {!isReadOnly ? (
        <LocationZoneQuickCreateModal
          departmentName={selectedDepartment?.name ?? ''}
          errorMessage={zoneCreateError}
          isOpen={isZoneModalOpen}
          isSubmitting={isCreatingZone}
          name={zoneCreateName}
          onChange={handleZoneCreateChange}
          onClose={handleCloseZoneModal}
          onSubmit={handleZoneQuickCreateSubmit}
        />
      ) : null}
      {!isReadOnly ? (
        <LocationCategoryQuickCreateModal
          errorMessage={categoryCreateError}
          isOpen={isCategoryModalOpen}
          isSubmitting={isCreatingCategory}
          name={categoryCreateName}
          onChange={handleCategoryCreateChange}
          onClose={handleCloseCategoryModal}
          onSubmit={handleCategoryQuickCreateSubmit}
        />
      ) : null}
      {!isReadOnly ? (
        <LocationOwnerQuickCreateModal
          errorMessage={ownerCreateError}
          isOpen={isOwnerModalOpen}
          isSubmitting={isCreatingOwner}
          values={ownerCreateValues}
          onChange={handleOwnerCreateChange}
          onClose={handleCloseOwnerModal}
          onSubmit={handleOwnerQuickCreateSubmit}
        />
      ) : null}

      <form className="space-y-6 sm:space-y-7" onSubmit={handleSubmit}>
        {submitError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        ) : null}

      <SectionCard>
        <LocationGoogleProvider apiKey={googleMapsApiKey}>
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 text-2xl font-semibold text-slate-950">
                  {getFormHeading(mode)}
                </h3>
                {primaryCardActions ? (
                  <div className="shrink-0">{primaryCardActions}</div>
                ) : null}
              </div>

              <div>
                <FieldLabel htmlFor="title" required>
                  Título
                </FieldLabel>
                <input
                  id="title"
                  name="title"
                  className={[
                    inputClassName(),
                    getFieldErrorInputClassName(fieldErrors.title),
                  ].join(' ')}
                  value={values.title}
                  onChange={handleTextChange}
                  readOnly={isReadOnly}
                  required
                />
                {!isReadOnly && fieldErrors.title ? (
                  <p className="mt-2 text-sm text-red-600">{fieldErrors.title}</p>
                ) : null}
              </div>

              <div>
                <FieldLabel htmlFor="category_id" required>
                  Categoría
                </FieldLabel>
                {isReadOnly ? (
                  <ReadOnlyFieldValue value={selectedCategoryName} />
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="relative flex-1" ref={categoryComboboxRef}>
                      <input
                        id="category_id"
                        name="category_id"
                        type="text"
                        autoComplete="off"
                        className={[
                          inputClassName(),
                          getFieldErrorInputClassName(fieldErrors.category_id),
                          'pr-10',
                        ].join(' ')}
                        value={categoryInputValue}
                        readOnly={isReadOnly}
                        placeholder="Buscar categoría"
                        onChange={handleCategorySearchChange}
                        onFocus={() => {
                          if (isReadOnly) {
                            return
                          }

                          setIsCategoryComboboxOpen(true)
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Mostrar categorías"
                        onClick={handleCategoryDropdownToggle}
                        disabled={isReadOnly}
                        className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 transition hover:text-slate-700"
                      >
                        <ChevronDownIcon />
                      </button>
                      {!isReadOnly && isCategoryComboboxOpen ? (
                        <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                          {filteredCategories.length > 0 ? (
                            <div className="category-combobox-scrollbar max-h-[260px] space-y-1 overflow-x-hidden overflow-y-auto pr-1">
                              {filteredCategories.map((category) => (
                                <button
                                  key={category.id}
                                  type="button"
                                  onClick={() =>
                                    handleCategorySelect(category.id, category.name)
                                  }
                                  className={[
                                    'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition',
                                    values.category_id === category.id
                                      ? 'bg-slate-900 text-white'
                                      : 'text-slate-700 hover:bg-slate-100',
                                  ].join(' ')}
                                >
                                  {category.name}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="max-h-[260px] overflow-x-hidden overflow-y-auto px-3 py-2 text-sm text-slate-500">
                              No se encontraron categorías.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    {!isReadOnly ? (
                      <button
                        type="button"
                        aria-label="Crear categoría"
                        disabled={isSubmitting || isCreatingCategory}
                        onClick={handleOpenCategoryModal}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#B8924A] bg-[#B8924A] text-xl font-semibold text-white shadow-sm transition hover:border-[#A37C2E] hover:bg-[#A37C2E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(184,146,74,0.20)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        +
                      </button>
                    ) : null}
                  </div>
                )}
                {fieldErrors.category_id ? (
                  <p className="mt-2 text-sm text-red-700">
                    {fieldErrors.category_id}
                  </p>
                ) : null}
              </div>

              <div>
                <FieldLabel htmlFor="owner_id" required>
                  Dueño
                </FieldLabel>
                {isReadOnly ? (
                  <div className="space-y-3">
                    <ReadOnlyFieldValue value={selectedOwnerName} />
                    <div>
                      <FieldLabel htmlFor="owner_phone">Teléfono</FieldLabel>
                      <ReadOnlyFieldValue value={ownerPhoneValue} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative" ref={ownerComboboxRef}>
                        <input
                          id="owner_id"
                          name="owner_id"
                          type="text"
                          autoComplete="off"
                          className={[
                            inputClassName(),
                            getFieldErrorInputClassName(fieldErrors.owner_name),
                            'pr-10',
                          ].join(' ')}
                          value={ownerInputValue}
                          readOnly={isReadOnly}
                          placeholder="Buscar dueño o escribir uno nuevo"
                          onChange={handleOwnerSearchChange}
                          onFocus={() => {
                            if (isReadOnly) {
                              return
                            }

                            setIsOwnerComboboxOpen(true)
                          }}
                        />
                        <button
                          type="button"
                          aria-label="Mostrar dueños"
                          onClick={handleOwnerDropdownToggle}
                          disabled={isReadOnly}
                          className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 transition hover:text-slate-700"
                        >
                          <ChevronDownIcon />
                        </button>
                        {!isReadOnly && isOwnerComboboxOpen ? (
                          <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                            {filteredOwners.length > 0 ? (
                              <div className="category-combobox-scrollbar max-h-[260px] space-y-1 overflow-x-hidden overflow-y-auto pr-1">
                                {filteredOwners.map((owner) => (
                                  <button
                                    key={owner.id}
                                    type="button"
                                    onClick={() =>
                                      handleOwnerSelect(owner.id, owner.full_name)
                                    }
                                    className={[
                                      'flex w-full flex-col rounded-xl px-3 py-2 text-left text-sm transition',
                                      values.owner_id === owner.id
                                        ? 'bg-slate-900 text-white'
                                        : 'text-slate-700 hover:bg-slate-100',
                                    ].join(' ')}
                                  >
                                    <span className="font-medium">
                                      {owner.full_name}
                                    </span>
                                    <span
                                      className={[
                                        'text-xs',
                                        values.owner_id === owner.id
                                          ? 'text-slate-200'
                                          : 'text-slate-500',
                                      ].join(' ')}
                                    >
                                      {owner.phone?.trim() || 'Sin teléfono'}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="max-h-[260px] overflow-x-hidden overflow-y-auto px-3 py-2 text-sm text-slate-500">
                                No se encontraron dueños.
                              </p>
                            )}
                          </div>
                        ) : null}
                    </div>
                    {fieldErrors.owner_name ? (
                      <p className="text-sm text-red-700">{fieldErrors.owner_name}</p>
                    ) : null}
                    <div>
                      <FieldLabel htmlFor="owner_phone" required>
                        Teléfono
                      </FieldLabel>
                      {isReadOnly ? (
                        <ReadOnlyFieldValue value={ownerPhoneValue} />
                      ) : (
                        <PhoneInputField
                          id="owner_phone"
                          name="owner_phone"
                          value={ownerPhoneValue}
                          readOnly={Boolean(values.owner_id)}
                          placeholder={
                            values.owner_id
                              ? 'Teléfono del dueño seleccionado'
                              : 'Ingresar teléfono'
                          }
                          onChange={(nextValue) =>
                            handleOwnerPhoneChange({
                              target: {
                                value: nextValue,
                              },
                            } as React.ChangeEvent<HTMLInputElement>)
                          }
                          errorMessage={fieldErrors.owner_phone}
                        />
                      )}
                      {fieldErrors.owner_phone ? (
                        <p className="mt-2 text-sm text-red-700">
                          {fieldErrors.owner_phone}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <FieldLabel htmlFor="google-location-search" required>
                  Dirección
                </FieldLabel>
                {isReadOnly ? (
                  <ReadOnlyFieldValue value={resolvedViewAddress} />
                ) : (
                  <>
                    {googleMapsApiKey ? (
                      <LocationAddressPicker
                        formattedAddress={values.formatted_address}
                        value={getLocationAddressPickerValue(values)}
                        disabled={isSubmitting || isReadOnly}
                        error={fieldErrors.address_private}
                        onPlaceSelected={handleGooglePlaceSelected}
                      />
                    ) : (
                      renderGoogleLocationFallback(inputClassName())
                    )}
                  </>
                )}
                {!isReadOnly && fieldErrors.address_private ? (
                  <p className="mt-2 text-sm text-red-700">
                    {fieldErrors.address_private}
                  </p>
                ) : null}
              </div>
            </div>

            {showImagesSection && mode === 'create' ? (
              <div className="min-w-0 space-y-4 xl:pl-6 2xl:pl-8">
                <LocationImagesGrid
                  images={pendingCoverImage ? [pendingCoverImage] : []}
                  emptyCoverAction={
                    <LocationImageUploader
                      ref={coverImageUploaderRef}
                      disabled={isSubmitting || isPreparingImages || isDropboxImporting}
                      helperText="Selecciona una sola imagen para portada."
                      label="Subir portada"
                      multiple={false}
                      onTrigger={() => handleOpenImageSourceModal('cover')}
                      variant="empty-state"
                      onFilesSelected={handleCoverImageSelected}
                    />
                  }
                  isLocked={isSubmitting}
                  onRemove={handleRemovePendingImage}
                  onSetCover={handleSetCoverImage}
                  showCount={false}
                  showGallery={false}
                />
                {renderImageFeedback()}
                {googleMapsApiKey ? (
                  <LocationMapPreview
                    lat={values.lat}
                    lng={values.lng}
                    disabled={isSubmitting}
                  />
                ) : (
                  <LocationMapPreview
                    lat={values.lat}
                    lng={values.lng}
                    disabled={isSubmitting}
                    mapEnabled={false}
                  />
                )}
              </div>
            ) : null}

            {showImagesSection && mode === 'edit' ? (
              <div className="min-w-0 space-y-4 xl:pl-6 2xl:pl-8">
                {pendingCoverImage ? (
                  <LocationImagesGrid
                    images={[pendingCoverImage]}
                    isLocked={isSubmitting}
                    mode="pending"
                    onRemove={handleRemovePendingImage}
                    onSetCover={handleSetCoverImage}
                    showCount={false}
                    showGallery={false}
                  />
                ) : (
                  <LocationImagesGrid
                    images={persistedCoverImage ? [persistedCoverImage] : []}
                    emptyCoverAction={
                      <LocationImageUploader
                        ref={coverImageUploaderRef}
                        disabled={isSubmitting || isPreparingImages || isDropboxImporting}
                        helperText="Selecciona una sola imagen para portada."
                        label="Subir portada"
                        multiple={false}
                        onTrigger={() => handleOpenImageSourceModal('cover')}
                        variant="empty-state"
                        onFilesSelected={handleCoverImageSelected}
                      />
                    }
                    isLocked={isSubmitting}
                    mode="persisted"
                    onRemove={(imageId) => void handleDeletePersistedImage(imageId)}
                    showCount={false}
                    showGallery={false}
                  />
                )}
                {renderImageFeedback()}
                {googleMapsApiKey ? (
                  <LocationMapPreview
                    lat={values.lat}
                    lng={values.lng}
                    disabled={isSubmitting}
                  />
                ) : (
                  <LocationMapPreview
                    lat={values.lat}
                    lng={values.lng}
                    disabled={isSubmitting}
                    mapEnabled={false}
                  />
                )}
              </div>
            ) : null}

            {showImagesSection && mode === 'view' ? (
              <div className="min-w-0 space-y-4 xl:pl-6 2xl:pl-8">
                <LocationImagesGrid
                  images={persistedCoverImage ? [persistedCoverImage] : []}
                  emptyCoverAction={
                    <ReadOnlyImagePlaceholder message="Esta locación todavía no tiene portada." />
                  }
                  isLocked
                  mode="persisted"
                  showCount={false}
                  showGallery={false}
                />
                {googleMapsApiKey ? (
                  <LocationMapPreview lat={values.lat} lng={values.lng} disabled />
                ) : (
                  <LocationMapPreview
                    lat={values.lat}
                    lng={values.lng}
                    disabled
                    mapEnabled={false}
                  />
                )}
              </div>
            ) : null}
          </div>

          <div className="hidden">
            <div>
              <FieldLabel htmlFor="department_id">
                Departamento
              </FieldLabel>
              <select
                id="department_id"
                name="department_id"
                className={[
                  inputClassName(),
                ].join(' ')}
                value={values.department_id}
                onChange={handleTextChange}
              >
                <option value="">Seleccionar departamento</option>
                {options.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="zone_id">Zona</FieldLabel>
              <div className="flex items-start gap-3">
                <div className="relative flex-1" ref={zoneComboboxRef}>
                  <input
                    id="zone_id"
                    name="zone_id"
                    type="text"
                    autoComplete="off"
                    className={[
                      inputClassName(),
                      'pr-10',
                      !values.department_id
                        ? 'border-slate-400 bg-slate-300 text-slate-600'
                        : '',
                    ].join(' ')}
                    value={zoneInputValue}
                    placeholder={
                      values.department_id
                        ? 'Buscar zona'
                        : 'Seleccione un departamento primero'
                    }
                    onChange={handleZoneSearchChange}
                    onFocus={() => {
                      if (!values.department_id) {
                        return
                      }

                      setIsZoneComboboxOpen(true)
                    }}
                    disabled={!values.department_id}
                  />
                  <button
                    type="button"
                    aria-label="Mostrar zonas"
                    onClick={handleZoneDropdownToggle}
                    disabled={!values.department_id}
                    className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    <ChevronDownIcon />
                  </button>
                  {isZoneComboboxOpen ? (
                    <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                      {filteredZoneOptions.length > 0 ? (
                        <div className="category-combobox-scrollbar max-h-[260px] space-y-1 overflow-x-hidden overflow-y-auto pr-1">
                          {filteredZoneOptions.map((zone) => (
                            <button
                              key={zone.id}
                              type="button"
                              onClick={() => handleZoneSelect(zone.id, zone.name)}
                              className={[
                                'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition',
                                values.zone_id === zone.id
                                  ? 'bg-slate-900 text-white'
                                  : 'text-slate-700 hover:bg-slate-100',
                              ].join(' ')}
                            >
                              {zone.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="max-h-[260px] overflow-x-hidden overflow-y-auto px-3 py-2 text-sm text-slate-500">
                          No se encontraron zonas.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Crear zona"
                  disabled={isSubmitting || isCreatingZone}
                  onClick={handleOpenZoneModal}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#B8924A] bg-[#B8924A] text-xl font-semibold text-white shadow-sm transition hover:border-[#A37C2E] hover:bg-[#A37C2E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(184,146,74,0.20)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  +
                </button>
              </div>
              {zoneDepartmentPrompt ? (
                <p className="mt-2 text-sm text-amber-700">{zoneDepartmentPrompt}</p>
              ) : null}
            </div>
          </div>

        </div>
        </LocationGoogleProvider>
      </SectionCard>

      <AccordionSectionCard
        title="Características"
        isOpen={isFeaturesSectionOpen}
        onToggle={() => setIsFeaturesSectionOpen((currentValue) => !currentValue)}
      >
        <div className="space-y-8">
          {mode === 'edit' || mode === 'create' ? (
            <LocationAnalysisPanel
              analysisError={analysisState.analysisError}
              analysisLoading={analysisState.analysisLoading}
              analysisResult={analysisState.analysisResult}
              isDisabled={
                isSubmitting ||
                isPreparingImages ||
                (mode === 'edit'
                  ? !hasAnalyzablePersistedImages
                  : !hasAnalyzablePendingImages)
              }
              isReadOnly={isReadOnly}
              onAnalyze={() => void handleAnalyzeLocation()}
              onApplyChanges={handleApplyAnalysisChanges}
              onDiscard={resetAnalysisState}
              suggestedFeatureNames={suggestedFeatureNames}
              suggestedTagNames={suggestedTagNames}
            />
          ) : null}
          <DescriptionEditor
            className={inputClassName()}
            description={values.description}
            isReadOnly={isReadOnly}
            onChange={handleTextChange}
          />
          <TagsEditor
            availableTags={availableTags}
            isDisabled={isSubmitting || isPreparingImages}
            isReadOnly={isReadOnly}
            onToggle={handleTagToggle}
            selectedTags={selectedTags}
            selectedTagIds={values.selectedTagIds}
          />
          <FeaturesEditor
            featureGroups={featureGroups}
            formatGroupLabel={formatFeatureGroupLabel}
            isDisabled={isSubmitting || isPreparingImages}
            isReadOnly={isReadOnly}
            onToggle={handleFeatureToggle}
            selectedFeatureIds={values.selectedFeatureIds}
          />
        </div>
      </AccordionSectionCard>

      <div className="hidden">
        {showAdvancedSection ? (
          <>
            <select
              name="status"
              value={values.status}
              onChange={handleTextChange}
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
            <input
              type="checkbox"
              name="premium"
              checked={values.premium}
              onChange={handleCheckboxChange}
            />
            <input
              type="checkbox"
              name="featured"
              checked={values.featured}
              onChange={handleCheckboxChange}
            />
          </>
        ) : null}
        <select
          name="visibility_level"
          value={values.visibility_level}
          onChange={handleTextChange}
        >
          <option value="public">public</option>
          <option value="private">private</option>
          <option value="restricted">restricted</option>
        </select>
        <select
          name="map_visibility"
          value={values.map_visibility}
          onChange={handleTextChange}
        >
          <option value="public">public</option>
          <option value="approximate">approximate</option>
          <option value="private">private</option>
        </select>
        <input
          name="address_public"
          value={values.address_public}
          onChange={handleTextChange}
        />
        <input
          type="hidden"
          name="address_private"
          value={values.address_private}
          onChange={handleTextChange}
        />
        <input
          type="checkbox"
          name="published"
          checked={values.published}
          onChange={handleCheckboxChange}
        />
        <input
          type="checkbox"
          name="show_exact_location"
          checked={values.show_exact_location}
          onChange={handleCheckboxChange}
        />
      </div>

      {showImagesSection && mode === 'create' ? (
        <AccordionSectionCard
          title="Galería de imágenes"
          isOpen={isGallerySectionOpen}
          onToggle={() => setIsGallerySectionOpen((currentValue) => !currentValue)}
        >
          <div className="space-y-4">
            <div className="flex justify-end">
              <LocationImageUploader
                ref={galleryImageUploaderRef}
                disabled={isSubmitting || isPreparingImages || isDropboxImporting}
                label={getGalleryUploadLabel(
                  isPreparingImages,
                  processedImagesCount,
                  totalImagesToProcess,
                )}
                onTrigger={() => handleOpenImageSourceModal('gallery')}
                onFilesSelected={handleGalleryImagesSelected}
              />
            </div>
            {pendingGalleryImages.length > 0 ? (
              <LocationImagesGrid
                images={pendingGalleryImages}
                isLocked={isSubmitting}
                onRemove={handleRemovePendingImage}
                showCount={false}
                showCover={false}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                Todavía no cargaste imágenes de galería.
              </div>
            )}
          </div>
        </AccordionSectionCard>
      ) : null}

      {showImagesSection && mode === 'edit' ? (
        <AccordionSectionCard
          title="Galería de imágenes"
          isOpen={isGallerySectionOpen}
          onToggle={() => setIsGallerySectionOpen((currentValue) => !currentValue)}
        >
          <div className="space-y-4">
            <div className="flex justify-end">
              <LocationImageUploader
                ref={galleryImageUploaderRef}
                disabled={isSubmitting || isPreparingImages || isDropboxImporting}
                label={getGalleryUploadLabel(
                  isPreparingImages,
                  processedImagesCount,
                  totalImagesToProcess,
                )}
                onTrigger={() => handleOpenImageSourceModal('gallery')}
                onFilesSelected={handleGalleryImagesSelected}
              />
            </div>
            {combinedEditGalleryImages.length > 0 ? (
              <LocationImagesGrid
                images={combinedEditGalleryImages}
                isLocked={isSubmitting}
                mode="mixed"
                onRemovePending={handleRemovePendingImage}
                onRemovePersisted={(imageId) => void handleDeletePersistedImage(imageId)}
                showCount={false}
                showCover={false}
              />
            ) : null}

            {combinedEditGalleryImages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                Esta locación todavía no tiene imágenes de galería.
              </div>
            ) : null}
            {editDeleteErrorMessage ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editDeleteErrorMessage}
              </div>
            ) : null}
          </div>
        </AccordionSectionCard>
      ) : null}

      {showImagesSection && mode === 'view' ? (
        <AccordionSectionCard
          title="Galería de imágenes"
          isOpen={isGallerySectionOpen}
          onToggle={() => setIsGallerySectionOpen((currentValue) => !currentValue)}
        >
          <div className="space-y-4">
            {persistedGalleryImages.length > 0 ? (
              <LocationImagesGrid
                images={persistedGalleryImages}
                isLocked
                mode="persisted"
                showCount={false}
                showCover={false}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                Esta locación todavía no tiene imágenes de galería.
              </div>
            )}
          </div>
        </AccordionSectionCard>
      ) : null}

        {!isReadOnly ? (
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => navigate(routePaths.locations)}
              disabled={isSubmitting || hasProcessingPendingImages || isDropboxImporting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || hasProcessingPendingImages || isDropboxImporting}
            >
              {isSubmitting
                ? mode === 'edit'
                  ? 'Guardando cambios...'
                  : 'Guardando...'
                : hasProcessingPendingImages
                  ? `Procesando imagenes ${processedImagesCount} de ${totalImagesToProcess}...`
                : mode === 'edit'
                  ? 'Guardar cambios'
                  : 'Guardar locación'}
            </Button>
          </div>
        ) : null}
      </form>
    </>
  )
}

export default LocationForm
