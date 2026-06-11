import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { getLocationEditPath, routePaths } from '../../app/router/route-paths'
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
import { useLocationImages } from './useLocationImages'

export type LocationFormMode = 'create' | 'edit'

type LocationFormProps = {
  mode?: LocationFormMode
  initialValues?: LocationFormValues
  locationId?: string
  showImagesSection?: boolean
  showAdvancedSection?: boolean
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
    show_exact_location: values.show_exact_location,
    map_visibility: values.map_visibility,
    selectedFeatureIds: values.selectedFeatureIds,
  }
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

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function formatFeatureGroup(group: string | null) {
  return group && group.trim().length > 0 ? group : 'General'
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
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      {title || description ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? (
              <h3 className="text-base font-semibold text-slate-950">{title}</h3>
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

function CollapsibleSection({
  children,
  defaultOpen = false,
  title,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
  title: string
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4"
    >
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
        <span>{title}</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
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
  const [values, setValues] = useState<LocationFormValues>(initialValues)
  const [options, setOptions] = useState<LocationFormOptions | null>(null)
  const [isOptionsLoading, setIsOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveProgress, setSaveProgress] = useState<LocationSaveProgressState | null>(
    null,
  )
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [categoryCreateName, setCategoryCreateName] = useState('')
  const [categoryCreateError, setCategoryCreateError] = useState<string | null>(null)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false)
  const [zoneCreateName, setZoneCreateName] = useState('')
  const [zoneCreateError, setZoneCreateError] = useState<string | null>(null)
  const [isCreatingZone, setIsCreatingZone] = useState(false)
  const [zoneDepartmentPrompt, setZoneDepartmentPrompt] = useState<string | null>(null)
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
  const pendingImagesRef = useRef<PendingLocationImageFile[]>([])
  const [pendingDeletedPersistedImageIds, setPendingDeletedPersistedImageIds] =
    useState<string[]>([])
  const [editDeleteErrorMessage, setEditDeleteErrorMessage] = useState<string | null>(
    null,
  )
  const locationImages = useLocationImages(
    mode === 'edit' ? locationId ?? null : null,
  )

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
  const filteredZones =
    options?.zones.filter((zone) => zone.department_id === values.department_id) ?? []

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
      })
      const nextOptions = await getLocationFormOptions()

      setOptions(nextOptions)
      setValues((currentValues) => ({
        ...currentValues,
        category_id: createdCategoryId,
      }))
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
      })
      const nextOptions = await getLocationFormOptions()

      setOptions(nextOptions)
      setValues((currentValues) => ({
        ...currentValues,
        zone_id: createdZoneId,
      }))
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
      )
      const nextOptions = await getLocationFormOptions()

      setOptions(nextOptions)
      setValues((currentValues) => ({
        ...currentValues,
        owner_id: createdOwnerId,
      }))
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

  function handleFeatureToggle(featureId: string, checked: boolean) {
    setValues((currentValues) => ({
      ...currentValues,
      selectedFeatureIds: checked
        ? [...currentValues.selectedFeatureIds, featureId]
        : currentValues.selectedFeatureIds.filter(
            (selectedId) => selectedId !== featureId,
          ),
    }))
  }

  function buildPendingImages(
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

    selectedFiles.forEach((file, index) => {
      if (!file) {
        return
      }

      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        nextErrors.push(
          `${file.name}: formato no permitido. Usá JPG, PNG, WEBP o AVIF.`,
        )
        return
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        nextErrors.push(
          `${file.name}: supera el máximo de 10MB por archivo.`,
        )
        return
      }

      nextImages.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        isCover: isCoverSelection && index === 0,
        status: 'pending',
      })
    })

    return {
      errors: nextErrors,
      images: nextImages,
    }
  }

  function handleCoverImageSelected(files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    const { errors, images } = buildPendingImages(files, true)
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
  }

  function handleGalleryImagesSelected(files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    const { errors, images } = buildPendingImages(files, false)
    setImageValidationErrors(errors)
    setEditDeleteErrorMessage(null)

    if (images.length === 0) {
      return
    }

    setPendingImages((currentImages) => [...currentImages, ...images])
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

        await updateLocation(locationId, payload)
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
        const createdLocationId = await createLocation(payload)
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

  const featuresByGroup = options.features.reduce<
    Record<string, LocationFormOptions['features']>
  >((groups, feature) => {
    const groupName = formatFeatureGroup(feature.group)

    if (!groups[groupName]) {
      groups[groupName] = []
    }

    groups[groupName].push(feature)

    return groups
  }, {})

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

      <form className="space-y-8" onSubmit={handleSubmit}>
        {submitError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        ) : null}

      <SectionCard>
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
            <div className="space-y-5">
              <div>
                <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-950">
                  Codigo: XXXX-XXXX
                </span>
              </div>

              <div>
                <FieldLabel htmlFor="title" required>
                  Título
                </FieldLabel>
                <input
                  id="title"
                  name="title"
                  className={inputClassName()}
                  value={values.title}
                  onChange={handleTextChange}
                  required
                />
              </div>

              <div>
                <FieldLabel htmlFor="category_id">Categoría</FieldLabel>
                <div className="flex items-start gap-3">
                  <select
                    id="category_id"
                    name="category_id"
                    className={inputClassName()}
                    value={values.category_id}
                    onChange={handleTextChange}
                  >
                    <option value="">Seleccionar categoría</option>
                    {options.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                <button
                  type="button"
                  aria-label="Crear categoría"
                  disabled={isSubmitting || isCreatingCategory}
                  onClick={handleOpenCategoryModal}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0f1723] text-xl font-semibold text-white shadow-sm transition hover:border-[#B8924A] hover:bg-[#162131] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(184,146,74,0.20)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  +
                </button>
                </div>
              </div>
            </div>

            {showImagesSection && mode === 'create' ? (
              <div className="min-w-0 xl:pl-6 2xl:pl-8">
                <LocationImagesGrid
                  images={pendingCoverImage ? [pendingCoverImage] : []}
                  emptyCoverAction={
                    <LocationImageUploader
                      disabled={isSubmitting}
                      helperText="Selecciona una sola imagen para portada."
                      label="Subir portada"
                      multiple={false}
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
              </div>
            ) : null}

            {showImagesSection && mode === 'edit' ? (
              <div className="min-w-0 xl:pl-6 2xl:pl-8">
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
                        disabled={isSubmitting}
                        helperText="Selecciona una sola imagen para portada."
                        label="Subir portada"
                        multiple={false}
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
              </div>
            ) : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <FieldLabel htmlFor="owner_id">Dueño</FieldLabel>
              <div className="flex items-start gap-3">
                <select
                  id="owner_id"
                  name="owner_id"
                  className={inputClassName()}
                  value={values.owner_id}
                  onChange={handleTextChange}
                >
                  <option value="">Seleccionar dueño</option>
                  {options.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.full_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label="Crear dueño"
                  disabled={isSubmitting || isCreatingOwner}
                  onClick={handleOpenOwnerModal}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0f1723] text-xl font-semibold text-white shadow-sm transition hover:border-[#B8924A] hover:bg-[#162131] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(184,146,74,0.20)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="address_private">Dirección</FieldLabel>
              <input
                id="address_private"
                name="address_private"
                className={inputClassName()}
                value={values.address_private}
                onChange={handleTextChange}
              />
            </div>

            <div>
              <FieldLabel htmlFor="department_id">Departamento</FieldLabel>
              <select
                id="department_id"
                name="department_id"
                className={inputClassName()}
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
                <select
                  id="zone_id"
                  name="zone_id"
                  className={[
                    inputClassName(),
                    !values.department_id
                      ? 'border-slate-400 bg-slate-300 text-slate-600'
                      : '',
                  ].join(' ')}
                  value={values.zone_id}
                  onChange={handleTextChange}
                  disabled={!values.department_id}
                >
                  <option value="">
                    {values.department_id
                      ? 'Seleccionar zona'
                      : 'Seleccioná un departamento primero'}
                  </option>
                  {filteredZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label="Crear zona"
                  disabled={isSubmitting || isCreatingZone}
                  onClick={handleOpenZoneModal}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0f1723] text-xl font-semibold text-white shadow-sm transition hover:border-[#B8924A] hover:bg-[#162131] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(184,146,74,0.20)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  +
                </button>
              </div>
              {zoneDepartmentPrompt ? (
                <p className="mt-2 text-sm text-amber-700">{zoneDepartmentPrompt}</p>
              ) : null}
            </div>

            <div className="lg:col-span-2">
              <FieldLabel htmlFor="description">Descripción</FieldLabel>
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
        </div>
      </SectionCard>

      {showAdvancedSection ? (
        <CollapsibleSection title="Configuración avanzada">
          <div className="grid gap-5 lg:grid-cols-3">
            <div>
              <FieldLabel htmlFor="status">Estado</FieldLabel>
              <select
                id="status"
                name="status"
                className={inputClassName()}
                value={values.status}
                onChange={handleTextChange}
              >
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </select>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                name="premium"
                checked={values.premium}
                onChange={handleCheckboxChange}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
              />
              Premium
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                name="featured"
                checked={values.featured}
                onChange={handleCheckboxChange}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
              />
              Destacada
            </label>
          </div>
        </CollapsibleSection>
      ) : null}

      <div className="hidden">
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
        <SectionCard
          title="Galería de imágenes"
          actions={
            <LocationImageUploader
              disabled={isSubmitting}
              label="Subir imágenes"
              onFilesSelected={handleGalleryImagesSelected}
            />
          }
        >
          <div className="space-y-4">
            {pendingGalleryImages.length > 0 ? (
              <LocationImagesGrid
                images={pendingGalleryImages}
                isLocked={isSubmitting}
                onRemove={handleRemovePendingImage}
                showCount={false}
                showCover={false}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                Todavía no cargaste imágenes de galería.
              </div>
            )}

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
        </SectionCard>
      ) : null}

      {showImagesSection && mode === 'edit' ? (
        <SectionCard
          title="Galería de imágenes"
          actions={
            <LocationImageUploader
              disabled={isSubmitting}
              label="Subir imágenes"
              onFilesSelected={handleGalleryImagesSelected}
            />
          }
        >
          <div className="space-y-4">
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
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                Esta locación todavía no tiene imágenes de galería.
              </div>
            ) : null}

            {imageValidationErrors.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <ul className="space-y-1">
                  {imageValidationErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {editDeleteErrorMessage ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editDeleteErrorMessage}
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <CollapsibleSection title="Características (opcional)">
        {options.features.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
            No hay features activas disponibles para asociar.
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(featuresByGroup).map(([groupName, features]) => (
              <div key={groupName} className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {groupName}
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {features.map((feature) => {
                    const isChecked = values.selectedFeatureIds.includes(
                      feature.id,
                    )

                    return (
                      <label
                        key={feature.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(event) =>
                            handleFeatureToggle(feature.id, event.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                        />
                        <span>{feature.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => navigate(routePaths.locations)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'edit'
                ? 'Guardando cambios...'
                : 'Guardando...'
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
