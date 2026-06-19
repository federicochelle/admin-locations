import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { APIProvider } from '@vis.gl/react-google-maps'
import Button from '../../components/ui/Button'
import { getLocationEditPath, routePaths } from '../../app/router/route-paths'
import useAuth from '../auth/useAuth'
import { getGoogleMapsApiKey } from '../../lib/env'
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
import LocationImageUploader from './LocationImageUploader'
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
import type {
  LocationCreatePayload,
  LocationFormOptions,
  LocationFormValues,
  LocationUpdatePayload,
} from './locations.types'
import type {
  LocationImageRecord,
  PendingLocationImageFile,
} from './location-images.types'
import type { ParsedGooglePlaceAddress } from './location-address-parser'
import {
  optimizeLocationImageFile,
} from './location-image-optimizer'
import { useLocationImages } from './useLocationImages'

export type LocationFormMode = 'create' | 'edit'

type LocationFormProps = {
  mode?: LocationFormMode
  initialValues?: LocationFormValues
  locationId?: string
  showImagesSection?: boolean
  showAdvancedSection?: boolean
}

type LocationFormFieldErrors = {
  address_private: string | null
  category_id: string | null
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
}

function toNullableString(value: string) {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
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

function buildPayload(
  values: LocationFormValues,
): LocationCreatePayload | LocationUpdatePayload {
  const deduplicatedSelectedFeatureIds = Array.from(
    new Set(values.selectedFeatureIds),
  )

  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    description: toNullableString(values.description),
    category_id: values.category_id || null,
    department_id: values.department_id || null,
    zone_id: values.zone_id || null,
    owner_id: values.owner_id || null,
    status: values.status,
    published: values.published,
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
    approx_lat: values.approx_lat,
    approx_lng: values.approx_lng,
    show_exact_location: values.show_exact_location,
    map_visibility: values.map_visibility,
    selectedFeatureIds: deduplicatedSelectedFeatureIds,
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
    <APIProvider apiKey={apiKey} libraries={['places']}>
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
    address_private: null,
    category_id: null,
  }
}

function validateRequiredFields(
  values: LocationFormValues,
): LocationFormFieldErrors {
  return {
    category_id:
      values.category_id.trim().length > 0
        ? null
        : 'Debe seleccionar una categoría.',
    address_private:
      values.address_private.trim().length > 0
        ? null
        : 'Debe ingresar una dirección.',
  }
}

function hasFieldErrors(fieldErrors: LocationFormFieldErrors) {
  return Object.values(fieldErrors).some((errorMessage) => errorMessage !== null)
}

function getFormHeading(mode: LocationFormMode) {
  return mode === 'edit' ? 'Editar locación' : 'Panel de creación'
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
    <section className="-mx-6 w-[calc(100%+3rem)] space-y-5 rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur-sm sm:p-6 lg:p-7">
      {title || description ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? (
              <h3 className="text-2xl font-semibold text-slate-950">{title}</h3>
            ) : null}
            {description ? (
              <p className="text-sm leading-6 text-slate-600">{description}</p>
            ) : null}
          </div>
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
    <section className="-mx-6 w-[calc(100%+3rem)] space-y-5 rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur-sm sm:p-6">
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

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
])

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

function getSelectedImagesCount(
  files: FileList | null,
  isCoverSelection: boolean,
) {
  if (!files || files.length === 0) {
    return 0
  }

  return isCoverSelection ? 1 : files.length
}

function buildOwnerQuickCreatePayload(values: LocationOwnerQuickCreateValues) {
  return {
    full_name: values.full_name.trim(),
    company_name: toNullableString(values.company_name),
    email: toNullableString(values.email),
    phone: toNullableString(values.phone),
    whatsapp: null,
    document_or_rut: null,
    notes: toNullableString(values.notes),
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

function LocationForm({
  mode = 'create',
  initialValues = defaultInitialValues,
  locationId,
  showImagesSection = mode === 'create',
  showAdvancedSection = mode === 'edit',
}: LocationFormProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [values, setValues] = useState<LocationFormValues>(initialValues)
  const [options, setOptions] = useState<LocationFormOptions | null>(null)
  const [isOptionsLoading, setIsOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFeaturesSectionOpen, setIsFeaturesSectionOpen] = useState(false)
  const [isGallerySectionOpen, setIsGallerySectionOpen] = useState(false)
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
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false)
  const [ownerCreateValues, setOwnerCreateValues] =
    useState<LocationOwnerQuickCreateValues>(defaultOwnerQuickCreateValues)
  const [ownerCreateError, setOwnerCreateError] = useState<string | null>(null)
  const [isCreatingOwner, setIsCreatingOwner] = useState(false)
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
  const ownerComboboxRef = useRef<HTMLDivElement | null>(null)
  const zoneComboboxRef = useRef<HTMLDivElement | null>(null)
  const locationImages = useLocationImages(
    mode === 'edit' ? locationId ?? null : null,
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
    return () => {
      pendingImagesRef.current.forEach((image) => {
        URL.revokeObjectURL(image.previewUrl)
      })
    }
  }, [])

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

  const visiblePersistedImages: LocationImageRecord[] =
    mode === 'edit'
      ? locationImages.images.filter(
          (image) => !pendingDeletedPersistedImageIds.includes(image.id),
        )
      : []
  const persistedCoverImage: LocationImageRecord | null =
    mode === 'edit'
      ? visiblePersistedImages.find((image) => image.is_cover === true) ?? null
      : null
  const persistedGalleryImages: LocationImageRecord[] =
    mode === 'edit'
      ? persistedCoverImage
        ? visiblePersistedImages.filter((image) => image.id !== persistedCoverImage.id)
        : visiblePersistedImages
      : []
  const pendingCoverImage = pendingImages.find((image) => image.isCover) ?? null
  const pendingGalleryImages = pendingImages.filter((image) => !image.isCover)
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
  const selectedOwnerName =
    options?.owners.find((owner) => owner.id === values.owner_id)?.full_name ?? ''
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
  const zoneInputValue =
    zoneSearchTerm.length > 0 || values.zone_id === ''
      ? zoneSearchTerm
      : selectedZoneName
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
  const featureGroups = useMemo(() => {
    if (!options) {
      return []
    }

    const groups = new Map<
      string,
      {
        group: string | null
        items: LocationFormOptions['features']
      }
    >()

    for (const feature of options.features) {
      if (feature.active !== true) {
        continue
      }

      if (feature.type && feature.type !== 'boolean') {
        continue
      }

      const key = feature.group?.trim() || 'ungrouped'
      const existingGroup = groups.get(key)

      if (existingGroup) {
        existingGroup.items.push(feature)
        continue
      }

      groups.set(key, {
        group: feature.group,
        items: [feature],
      })
    }

    return Array.from(groups.values())
  }, [options])

  function handleOwnerCreateChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target

    setOwnerCreateValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }))
  }

  function handleCategoryCreateChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    setCategoryCreateName(event.target.value)
  }

  function handleCategorySearchChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
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
    setIsCategoryComboboxOpen((currentValue) => !currentValue)
  }

  function handleOwnerSearchChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const nextValue = event.target.value

    setOwnerSearchTerm(nextValue)
    setIsOwnerComboboxOpen(true)

    const selectedOwner =
      options?.owners.find((owner) => owner.id === values.owner_id) ?? null

    if (nextValue.trim().length === 0) {
      setValues((currentValues) => ({
        ...currentValues,
        owner_id: '',
      }))
      return
    }

    if (selectedOwner && selectedOwner.full_name !== nextValue) {
      setValues((currentValues) => ({
        ...currentValues,
        owner_id: '',
      }))
    }
  }

  function handleOwnerSelect(ownerId: string, ownerName: string) {
    setValues((currentValues) => ({
      ...currentValues,
      owner_id: ownerId,
    }))
    setOwnerSearchTerm(ownerName)
    setIsOwnerComboboxOpen(false)
  }

  function handleOwnerDropdownToggle() {
    setIsOwnerComboboxOpen((currentValue) => !currentValue)
  }

  function handleZoneSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
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
    setValues((currentValues) => ({
      ...currentValues,
      zone_id: zoneId,
    }))
    setZoneSearchTerm(zoneName)
    setIsZoneComboboxOpen(false)
  }

  function handleZoneDropdownToggle() {
    if (!values.department_id) {
      return
    }

    setIsZoneComboboxOpen((currentValue) => !currentValue)
  }

  function handleZoneCreateChange(event: React.ChangeEvent<HTMLInputElement>) {
    setZoneCreateName(event.target.value)
  }

  function handleOpenCategoryModal() {
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

  function handleOpenOwnerModal() {
    setOwnerCreateError(null)
    setOwnerCreateValues(defaultOwnerQuickCreateValues)
    setIsOwnerModalOpen(true)
  }

  function handleCloseOwnerModal() {
    if (isCreatingOwner) {
      return
    }

    setIsOwnerModalOpen(false)
    setOwnerCreateError(null)
    setOwnerCreateValues(defaultOwnerQuickCreateValues)
  }

  async function handleOwnerQuickCreateSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const trimmedName = ownerCreateValues.full_name.trim()

    if (!trimmedName) {
      setOwnerCreateError('El nombre completo es obligatorio.')
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
      setOwnerSearchTerm(createdOwner?.full_name ?? trimmedName)
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
    const { name, value } = event.target
    const nextFieldError =
      name === 'category_id'
        ? value.trim().length > 0
          ? null
          : 'Debe seleccionar una categoría.'
        : name === 'address_private'
            ? value.trim().length > 0
              ? null
              : 'Debe ingresar una dirección.'
            : null

    if (name === 'category_id' || name === 'address_private') {
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
    const { checked, name } = event.target

    setValues((currentValues) => ({
      ...currentValues,
      [name]: checked,
    }))
  }

  function handleFeatureToggle(featureId: string) {
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

  function handleGooglePlaceSelected(place: ParsedGooglePlaceAddress) {
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      address_private: place.formatted_address ? null : currentErrors.address_private,
    }))
    setValues((currentValues) => ({
      ...currentValues,
      address_private:
        place.formatted_address ?? currentValues.address_private,
      formatted_address: place.formatted_address,
      google_place_id: place.google_place_id,
      google_department_name: place.google_department_name,
      google_zone_name: place.google_zone_name,
      address_components: place.address_components,
      lat: place.lat,
      lng: place.lng,
    }))
  }

  async function buildPendingImages(
    files: FileList | null,
    isCoverSelection: boolean,
  ) {
    if (!files || files.length === 0) {
      return {
        errors: [] as string[],
        images: [] as PendingLocationImageFile[],
      }
    }

    const nextErrors: string[] = []
    const nextImages: PendingLocationImageFile[] = []
    const selectedFiles = isCoverSelection ? [files[0]] : Array.from(files)

    for (const [index, file] of selectedFiles.entries()) {
      if (!file) {
        continue
      }

      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        nextErrors.push(
          `${file.name}: formato no permitido. Usá JPG, PNG, WEBP o AVIF.`,
        )
        continue
      }

      try {
        const optimizationResult = await optimizeLocationImageFile(file)

        if (optimizationResult.file.size > MAX_IMAGE_SIZE_BYTES) {
          nextErrors.push(
            `${file.name}: sigue superando el máximo de 10MB después de optimizar.`,
          )
          continue
        }

        nextImages.push({
          id: crypto.randomUUID(),
          file: optimizationResult.file,
          previewUrl: URL.createObjectURL(optimizationResult.file),
          isCover: isCoverSelection && index === 0,
          status: 'pending',
        })
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `${file.name}: no pudimos optimizar la imagen seleccionada.`

        nextErrors.push(message)
      } finally {
        setProcessedImagesCount((currentCount) =>
          Math.min(currentCount + 1, selectedFiles.length),
        )
      }
    }

    return {
      errors: nextErrors,
      images: nextImages,
    }
  }

  async function handleCoverImageSelected(files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    const totalFiles = getSelectedImagesCount(files, true)
    setTotalImagesToProcess(totalFiles)
    setProcessedImagesCount(0)
    setIsPreparingImages(true)

    try {
      const { errors, images } = await buildPendingImages(files, true)
      setImageValidationErrors(errors)
      setEditDeleteErrorMessage(null)

      if (images.length === 0) {
        return
      }

      setPendingImages((currentImages) => {
        const normalizedImages = currentImages.map((image) => ({
          ...image,
          isCover: false,
        }))

        return [...normalizedImages, ...images]
      })
    } finally {
      setIsPreparingImages(false)
    }
  }

  async function handleGalleryImagesSelected(files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    const totalFiles = getSelectedImagesCount(files, false)
    setTotalImagesToProcess(totalFiles)
    setProcessedImagesCount(0)
    setIsPreparingImages(true)

    try {
      const { errors, images } = await buildPendingImages(files, false)
      setImageValidationErrors(errors)
      setEditDeleteErrorMessage(null)

      if (images.length === 0) {
        return
      }

      setPendingImages((currentImages) => [...currentImages, ...images])
    } finally {
      setIsPreparingImages(false)
    }
  }

  function handleRemovePendingImage(imageId: string) {
    setPendingImages((currentImages) => {
      const imageToRemove = currentImages.find((image) => image.id === imageId)

      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl)
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
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ul className="space-y-1">
            {imageValidationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  function handleSetCoverImage(imageId: string) {
    setPendingImages((currentImages) =>
      currentImages.map((image) => ({
        ...image,
        isCover: image.id === imageId,
      })),
    )
  }

  async function handleDeletePersistedImage(imageId: string) {
    if (mode !== 'edit' || !locationId) {
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

    updateStageStatus('uploadImages', 'active')

    for (const [index, image] of pendingImages.entries()) {
      try {
        updatePendingImage(image.id, {
          errorMessage: null,
          status: 'pending',
        })

        updateSaveProgress((currentState) => ({
          ...currentState,
          uploadingCurrentIndex: index + 1,
          uploadingCurrentName: image.file.name,
          uploadingCurrentStep: 'uploading',
        }))

        await uploadLocationImage({
          file: image.file,
          isCover: image.isCover,
          locationId: nextLocationId,
          onStatusChange: (status) => {
            updatePendingImage(image.id, {
              status,
            })

            updateSaveProgress((currentState) => ({
              ...currentState,
              uploadingCurrentIndex: index + 1,
              uploadingCurrentName: image.file.name,
              uploadingCurrentStep: status,
            }))
          },
        })

        updatePendingImage(image.id, {
          errorMessage: null,
          status: 'done',
        })

        updateSaveProgress((currentState) => ({
          ...currentState,
          uploadingDone: index + 1,
        }))
      } catch (error) {
        hasImageErrors = true

        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos subir esta imagen.'

        updatePendingImage(image.id, {
          errorMessage: message,
          status: 'error',
        })
      }
    }

    updateSaveProgress((currentState) => ({
      ...currentState,
      uploadingCurrentIndex: null,
      uploadingCurrentName: null,
      uploadingCurrentStep: null,
    }))

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

    const nextFieldErrors = validateRequiredFields(values)

    setFieldErrors(nextFieldErrors)

    if (hasFieldErrors(nextFieldErrors)) {
      const firstErrorMessage =
        nextFieldErrors.category_id ??
        nextFieldErrors.address_private ??
        'No pudimos guardar la locación.'

      setSubmitError(firstErrorMessage)
      return
    }

    try {
      setIsSubmitting(true)
      setSubmitError(null)
      setEditDeleteErrorMessage(null)
      openSaveProgress()
      updateStageStatus('location', 'active')

      const payload = buildPayload(values)

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
              URL.revokeObjectURL(image.previewUrl)
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
              URL.revokeObjectURL(image.previewUrl)
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
      const message =
        error instanceof Error
          ? error.message
          : mode === 'edit'
            ? 'No pudimos guardar los cambios.'
            : 'No pudimos guardar la locación.'

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
      <LocationSaveProgressModal progress={saveProgress} />
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
      <LocationCategoryQuickCreateModal
        errorMessage={categoryCreateError}
        isOpen={isCategoryModalOpen}
        isSubmitting={isCreatingCategory}
        name={categoryCreateName}
        onChange={handleCategoryCreateChange}
        onClose={handleCloseCategoryModal}
        onSubmit={handleCategoryQuickCreateSubmit}
      />
      <LocationOwnerQuickCreateModal
        errorMessage={ownerCreateError}
        isOpen={isOwnerModalOpen}
        isSubmitting={isCreatingOwner}
        values={ownerCreateValues}
        onChange={handleOwnerCreateChange}
        onClose={handleCloseOwnerModal}
        onSubmit={handleOwnerQuickCreateSubmit}
      />

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
              <div>
                <h3 className="text-2xl font-semibold text-slate-950">
                  {getFormHeading(mode)}
                </h3>
              </div>

              <div>
                <FieldLabel htmlFor="title">
                  Título
                </FieldLabel>
                <input
                  id="title"
                  name="title"
                  className={inputClassName()}
                  value={values.title}
                  onChange={handleTextChange}
                />
              </div>

              <div>
                <FieldLabel htmlFor="category_id" required>
                  Categoría
                </FieldLabel>
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
                      placeholder="Buscar categoría"
                      onChange={handleCategorySearchChange}
                      onFocus={() => setIsCategoryComboboxOpen(true)}
                    />
                    <button
                      type="button"
                      aria-label="Mostrar categorías"
                      onClick={handleCategoryDropdownToggle}
                      className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 transition hover:text-slate-700"
                    >
                      <ChevronDownIcon />
                    </button>
                    {isCategoryComboboxOpen ? (
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
                  <button
                  type="button"
                  aria-label="Crear categoría"
                  disabled={isSubmitting || isCreatingCategory}
                  onClick={handleOpenCategoryModal}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#B8924A] bg-[#B8924A] text-xl font-semibold text-white shadow-sm transition hover:border-[#A37C2E] hover:bg-[#A37C2E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(184,146,74,0.20)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    +
                  </button>
                </div>
                {fieldErrors.category_id ? (
                  <p className="mt-2 text-sm text-red-700">
                    {fieldErrors.category_id}
                  </p>
                ) : null}
              </div>

              <div>
                <FieldLabel htmlFor="owner_id">Dueño</FieldLabel>
                <div className="flex items-start gap-3">
                  <div className="relative flex-1" ref={ownerComboboxRef}>
                    <input
                      id="owner_id"
                      name="owner_id"
                      type="text"
                      autoComplete="off"
                      className={[inputClassName(), 'pr-10'].join(' ')}
                      value={ownerInputValue}
                      placeholder="Buscar dueño"
                      onChange={handleOwnerSearchChange}
                      onFocus={() => setIsOwnerComboboxOpen(true)}
                    />
                    <button
                      type="button"
                      aria-label="Mostrar dueños"
                      onClick={handleOwnerDropdownToggle}
                      className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 transition hover:text-slate-700"
                    >
                      <ChevronDownIcon />
                    </button>
                    {isOwnerComboboxOpen ? (
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
                                  'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition',
                                  values.owner_id === owner.id
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-700 hover:bg-slate-100',
                                ].join(' ')}
                              >
                                {owner.full_name}
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
                  <button
                    type="button"
                    aria-label="Crear dueño"
                    disabled={isSubmitting || isCreatingOwner}
                    onClick={handleOpenOwnerModal}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#B8924A] bg-[#B8924A] text-xl font-semibold text-white shadow-sm transition hover:border-[#A37C2E] hover:bg-[#A37C2E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(184,146,74,0.20)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="google-location-search" required>
                  Dirección
                </FieldLabel>
                {googleMapsApiKey ? (
                  <LocationAddressPicker
                    formattedAddress={values.formatted_address}
                    value={getLocationAddressPickerValue(values)}
                    disabled={isSubmitting}
                    error={fieldErrors.address_private}
                    onPlaceSelected={handleGooglePlaceSelected}
                  />
                ) : (
                  renderGoogleLocationFallback(inputClassName())
                )}
                {fieldErrors.address_private ? (
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
                      disabled={isSubmitting || isPreparingImages}
                      helperText="Selecciona una sola imagen para portada."
                      label="Subir portada"
                      multiple={false}
                      variant="empty-state"
                      onFilesSelected={handleCoverImageSelected}
                    />
                  }
                  isLocked={isSubmitting || isPreparingImages}
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
                    isLocked={isSubmitting || isPreparingImages}
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
                        disabled={isSubmitting || isPreparingImages}
                        helperText="Selecciona una sola imagen para portada."
                        label="Subir portada"
                        multiple={false}
                        variant="empty-state"
                        onFilesSelected={handleCoverImageSelected}
                      />
                    }
                    isLocked={isSubmitting || isPreparingImages}
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

          <div>
            <FieldLabel htmlFor="description">Notas internas</FieldLabel>
            <textarea
              id="description"
              name="description"
              className={inputClassName()}
              value={values.description}
              onChange={handleTextChange}
              rows={5}
            />
          </div>
        </div>
        </LocationGoogleProvider>
      </SectionCard>

      <AccordionSectionCard
        title="Características"
        isOpen={isFeaturesSectionOpen}
        onToggle={() => setIsFeaturesSectionOpen((currentValue) => !currentValue)}
      >
        {featureGroups.length > 0 ? (
          <div className="space-y-6">
            {featureGroups.map((featureGroup) => (
              <div
                key={featureGroup.group ?? 'ungrouped'}
                className="space-y-4 py-1"
              >
                <div>
                  <h4 className="text-base font-bold uppercase tracking-[0.14em] text-slate-950">
                    {formatFeatureGroupLabel(featureGroup.group)}
                  </h4>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {featureGroup.items.map((feature) => {
                    const isSelected = values.selectedFeatureIds.includes(feature.id)

                    return (
                      <label
                        key={feature.id}
                        className={[
                          'flex min-w-0 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition',
                          isSelected
                            ? 'border-[#B8924A] bg-[#0f1723] text-[#B8924A] shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleFeatureToggle(feature.id)}
                          disabled={isSubmitting || isPreparingImages}
                          className={[
                            'mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300',
                            isSelected
                              ? 'border-[#B8924A] text-[#B8924A] focus:ring-[rgba(184,146,74,0.20)]'
                              : 'text-slate-900 focus:ring-slate-300',
                          ].join(' ')}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium">{feature.name}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            No hay features booleanas activas disponibles.
          </div>
        )}
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
                disabled={isSubmitting || isPreparingImages}
                label={getGalleryUploadLabel(
                  isPreparingImages,
                  processedImagesCount,
                  totalImagesToProcess,
                )}
                onFilesSelected={handleGalleryImagesSelected}
              />
            </div>
            {pendingGalleryImages.length > 0 ? (
              <LocationImagesGrid
                images={pendingGalleryImages}
                isLocked={isSubmitting || isPreparingImages}
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
                disabled={isSubmitting || isPreparingImages}
                label={getGalleryUploadLabel(
                  isPreparingImages,
                  processedImagesCount,
                  totalImagesToProcess,
                )}
                onFilesSelected={handleGalleryImagesSelected}
              />
            </div>
            {combinedEditGalleryImages.length > 0 ? (
              <LocationImagesGrid
                images={combinedEditGalleryImages}
                isLocked={isSubmitting || isPreparingImages}
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

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => navigate(routePaths.locations)}
            disabled={isSubmitting || isPreparingImages}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || isPreparingImages}>
            {isSubmitting
              ? mode === 'edit'
                ? 'Guardando cambios...'
                : 'Guardando...'
              : isPreparingImages
                ? `Procesando imagenes ${processedImagesCount} de ${totalImagesToProcess}...`
              : mode === 'edit'
                ? 'Guardar cambios'
                : 'Guardar locación'}
          </Button>
        </div>
      </form>
    </>
  )
}

export default LocationForm
