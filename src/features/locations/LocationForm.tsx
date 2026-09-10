import { readImageFileDimensions } from '../images/decode-image'
import { useUnsavedCriticalState } from '../../app/useUnsavedCriticalState'
import { annotateAdminError, createAdminCorrelationId, reportAdminError, suppressAdminErrorReport, type AdminErrorContext } from '../../lib/admin-error-reporting'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { routePaths } from '../../app/router/route-paths'
import useAuth from '../auth/useAuth'
import { getGoogleMapsApiKey } from '../../lib/env'
import {
  formatOwnerPhoneForInput,
  toE164OwnerPhone,
} from '../../lib/phone'
import { createOwner } from '../owners/owners.service'
import {
  createLocation,
  updateLocation,
} from './locations.service'
import LocationCategoryQuickCreateModal from './LocationCategoryQuickCreateModal'
import {
  type LocationImageUploaderHandle,
} from './LocationImageUploader'
import LocationOwnerQuickCreateModal from './LocationOwnerQuickCreateModal'
import LocationValidationModal from './LocationValidationModal'
import {
  deleteLocationImage,
  downloadLocationImageSource,
  replaceLocationImage,
  uploadLocationImageAsset,
  uploadLocationImage,
} from './location-images.service'
import type {
  LocationSaveProgressState,
  LocationSaveStageKey,
  LocationSaveStageStatus,
} from './LocationSaveProgressModal'
import LocationZoneQuickCreateModal from './LocationZoneQuickCreateModal'
import DescriptionEditor from './components/location-analysis/DescriptionEditor'
import LocationAnalysisPanel from './components/location-analysis/LocationAnalysisPanel'
import { resolvePublicLocationCoordinates } from './location-public-coordinates'
import type { LocationFormValues } from './locations.types'
import type {
  PendingLocationImageFile,
  PendingLocationImageStatus,
} from './location-images.types'
import type { ParsedGooglePlaceAddress } from './location-address-parser'
import {
  applyBlurStrokesToImage,
  type BlurStroke,
} from './location-face-blur'
import {
  createPendingLocationImagePlaceholder,
  preparePendingLocationImage,
} from './location-image-selection'
import { useLocationImages } from './useLocationImages'
import { buildPayload } from './application/build-location-payload'
import {
  defaultInitialValues,
  normalizeDepartmentName,
  normalizeInlineOwnerValue,
  slugifyTitle,
} from './application/location-form.helpers'
import {
  handleSelectedLocationImageFiles,
} from './application/location-image-selection'
import {
  buildSubmitObservation,
  buildSubmitPayloadValues,
  getLocationWriteObservationPatch,
  getInlineOwnerDraft,
  getSubmitErrorMessage,
} from './application/location-submit-helpers'
import { deriveLocationImageState } from './application/location-image-selectors'
import { buildLocationImageUploadPlan } from './application/location-image-upload-plan'
import {
  getDefaultFieldErrors,
  getValidationMessages,
  hasFieldErrors,
  validateRequiredFields,
  type LocationFormFieldErrors,
} from './application/validate-location-form'
import {
  buildSaveProgressState,
  markLocationSaveProgressSuccess,
  setLocationSaveProgressError,
  updateLocationSaveStageStatus,
} from './application/location-save-progress'
import LocationAdvancedFields from './components/form/LocationAdvancedFields'
import LocationAddressFields from './components/form/LocationAddressFields'
import LocationBasicFields from './components/form/LocationBasicFields'
import LocationCategoryZoneFields, {
  LocationZoneHiddenFields,
} from './components/form/LocationCategoryZoneFields'
import LocationCoverField from './components/form/LocationCoverField'
import LocationFormActions from './components/form/LocationFormActions'
import LocationGalleryField from './components/form/LocationGalleryField'
import LocationImageFeedback from './components/form/LocationImageFeedback'
import LocationImageModals from './components/form/LocationImageModals'
import LocationOwnerFields from './components/form/LocationOwnerFields'
import LocationSaveProgressView from './components/form/LocationSaveProgressView'
import {
  LocationGoogleProvider,
  SectionCard,
} from './components/form/LocationFormShell'
import { inputClassName } from './components/form/location-form-field-styles'
import { useLocationAnalysis } from './hooks/useLocationAnalysis'
import {
  type ImageSelectionTarget,
  useLocationDropbox,
} from './hooks/useLocationDropbox'
import { useLocationFormOptions } from './hooks/useLocationFormOptions'
import { useLocationQuickCreate } from './hooks/useLocationQuickCreate'

export type LocationFormMode = 'create' | 'edit' | 'view'

type LocationFormProps = {
  mode?: LocationFormMode
  initialValues?: LocationFormValues
  locationId?: string
  locationCode?: string | null
  onCreateSuccess?: () => Promise<void>
  onEditSuccess?: () => Promise<void>
  primaryCardActions?: React.ReactNode
  showImagesSection?: boolean
  showAdvancedSection?: boolean
}

const IMAGE_PREPARATION_CONCURRENCY = 3

type ManualBlurTarget =
  | {
      imageId: string
      kind: 'pending'
    }
  | {
      editorImage: PendingLocationImageFile
      expectedStorageKey: string
      imageId: string
      kind: 'persisted'
    }

const IMAGE_UPLOAD_CONCURRENCY = 3
const IMAGE_UPLOAD_TIMEOUT_MS = 90_000
const IMAGE_UPLOAD_TIMEOUT_ERROR_MESSAGE =
  'La subida tardó demasiado y fue cancelada. Intenta nuevamente.'

const SAVE_SUCCESS_DELAY_MS = 1000
function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
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

function getNextPendingImageOriginalIndex(
  currentImages: PendingLocationImageFile[],
) {
  const highestOriginalIndex = currentImages.reduce(
    (maxIndex, image) => Math.max(maxIndex, image.originalIndex),
    -1,
  )

  return highestOriginalIndex + 1
}

function revokePreviewUrl(previewUrl: string) {
  if (!previewUrl.startsWith('blob:')) {
    return
  }

  URL.revokeObjectURL(previewUrl)
}

function getImageFileExtension(contentType: string) {
  switch (contentType) {
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/avif':
      return 'avif'
    default:
      return 'jpg'
  }
}

function LocationForm({
  mode = 'create',
  initialValues = defaultInitialValues,
  locationId,
  locationCode = null,
  onCreateSuccess,
  onEditSuccess,
  primaryCardActions,
  showImagesSection = mode === 'create',
  showAdvancedSection = mode === 'edit',
}: LocationFormProps) {
  const isReadOnly = mode === 'view'
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [values, setValues] = useState<LocationFormValues>(initialValues)
  const {
    isOptionsLoading,
    loadFormOptions,
    options,
    optionsError,
    refreshOptions,
  } = useLocationFormOptions()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const createdLocationIdRef = useRef<string | null>(null)
  const submitLockRef = useRef(false)
  const [saveProgress, setSaveProgress] = useState<LocationSaveProgressState | null>(
    null,
  )
  const [isCategoryComboboxOpen, setIsCategoryComboboxOpen] = useState(false)
  const [categorySearchTerm, setCategorySearchTerm] = useState('')
  const [isZoneComboboxOpen, setIsZoneComboboxOpen] = useState(false)
  const [zoneSearchTerm, setZoneSearchTerm] = useState('')
  const [isOwnerComboboxOpen, setIsOwnerComboboxOpen] = useState(false)
  const [ownerSearchTerm, setOwnerSearchTerm] = useState('')
  const [ownerPhoneInput, setOwnerPhoneInput] = useState('')
  const [isImageSourceModalOpen, setIsImageSourceModalOpen] = useState(false)
  const [imageSelectionTarget, setImageSelectionTarget] =
    useState<ImageSelectionTarget | null>(null)
  const [pendingImages, setPendingImages] = useState<PendingLocationImageFile[]>(
    [],
  )
  const [imageValidationErrors, setImageValidationErrors] = useState<string[]>(
    [],
  )
  const [fieldErrors, setFieldErrors] = useState<LocationFormFieldErrors>(
    getDefaultFieldErrors(),
  )
  const [validationModalMessages, setValidationModalMessages] = useState<string[]>([])
  const [isPreparingImages, setIsPreparingImages] = useState(false)
  const [processedImagesCount, setProcessedImagesCount] = useState(0)
  const [totalImagesToProcess, setTotalImagesToProcess] = useState(0)
  const [manualBlurTarget, setManualBlurTarget] = useState<ManualBlurTarget | null>(null)
  const [imageErrorsById, setImageErrorsById] = useState<Record<string, string | undefined>>({})
  const [manualBlurErrorMessage, setManualBlurErrorMessage] = useState<string | null>(null)
  const [isApplyingManualBlur, setIsApplyingManualBlur] = useState(false)
  const [manualBlurLoadingImageId, setManualBlurLoadingImageId] = useState<string | null>(null)
  const pendingImagesRef = useRef<PendingLocationImageFile[]>([])
  const [pendingDeletedPersistedImageIds, setPendingDeletedPersistedImageIds] =
    useState<string[]>([])
  const [editDeleteErrorMessage, setEditDeleteErrorMessage] = useState<string | null>(
    null,
  )
  const categoryComboboxRef = useRef<HTMLDivElement | null>(null)
  const coverImageUploaderRef = useRef<LocationImageUploaderHandle | null>(null)
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
  const {
    handleSelectDropboxSource: runSelectDropboxSource,
    isDropboxImporting,
  } = useLocationDropbox({
    handleSelectedImageFiles,
    imageSelectionTarget,
    isImageSourceModalOpen,
    isMountedRef,
    isReadOnly,
    setEditDeleteErrorMessage,
    setImageSelectionTarget,
    setImageValidationErrors,
    setIsImageSourceModalOpen,
  })

  function reportLocationFailure(error: unknown, context: Partial<AdminErrorContext>) {
    reportAdminError(error, { operation: mode === 'edit' ? 'location.update' : 'location.create', resourceId: locationId, userFacing: true, ...context })
  }

  useEffect(() => {
    pendingImagesRef.current = pendingImages
  }, [pendingImages])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      pendingImagesRef.current.forEach((image) => {
        revokePreviewUrl(image.previewUrl)
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

  const {
    combinedEditGalleryImages,
    hasAnalyzablePendingImages,
    hasAnalyzablePersistedImages,
    hasProcessingPendingImages,
    pendingCoverImage,
    pendingGalleryImages,
    persistedCoverImage,
    persistedGalleryImages,
    visiblePersistedImages,
  } = deriveLocationImageState({
    mode,
    pendingDeletedPersistedImageIds,
    pendingImages,
    persistedImages: locationImages.images,
  })
  const selectedDepartment =
    options?.departments.find((department) => department.id === values.department_id) ??
    null
  const {
    categoryCreateError,
    categoryCreateLocationCodePrefix,
    categoryCreateName,
    handleCategoryCreateChange,
    handleCategoryCreateLocationCodePrefixChange,
    handleCategoryQuickCreateSubmit,
    handleCloseCategoryModal,
    handleCloseOwnerModal,
    handleCloseZoneModal,
    handleOpenCategoryModal,
    handleOpenZoneModal,
    handleOwnerCreateChange,
    handleOwnerQuickCreateSubmit,
    handleZoneCreateChange,
    handleZoneQuickCreateSubmit,
    isCategoryModalOpen,
    isCreatingCategory,
    isCreatingOwner,
    isCreatingZone,
    isOwnerModalOpen,
    isZoneModalOpen,
    ownerCreateError,
    ownerCreateValues,
    setZoneDepartmentPrompt,
    zoneCreateError,
    zoneCreateName,
    zoneDepartmentPrompt,
  } = useLocationQuickCreate({
    isReadOnly,
    profileId: profile?.id ?? null,
    refreshOptions,
    reportLocationFailure,
    selectedDepartment,
    setCategorySearchTerm,
    setOwnerPhoneInput,
    setOwnerSearchTerm,
    setValues,
    setZoneSearchTerm,
    valuesDepartmentId: values.department_id,
  })
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
  const protection = useUnsavedCriticalState(values, {
    enabled: !isReadOnly,
    pending: isSubmitting || isPreparingImages || isDropboxImporting || isApplyingManualBlur ||
      isCreatingOwner || isCreatingCategory || isCreatingZone ||
      pendingImages.some(image => image.status !== 'done') || pendingDeletedPersistedImageIds.length > 0 ||
      (!values.owner_id && Boolean(ownerInputValue.trim() || ownerPhoneValue.trim())) ||
      (isOwnerModalOpen && Object.values(ownerCreateValues).some(value => value.trim().length > 0)) ||
      (isCategoryModalOpen && Boolean(categoryCreateName.trim())) ||
      (isZoneModalOpen && Boolean(zoneCreateName.trim())),
  })
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
  const {
    analysisState,
    handleAnalyzeLocation: runAnalyzeLocation,
    handleApplyAnalysisChanges: runApplyAnalysisChanges,
    resetAnalysisState: runResetAnalysisState,
    suggestedFeatureNames,
    suggestedTagNames,
  } = useLocationAnalysis({
    hasAnalyzablePendingImages,
    hasAnalyzablePersistedImages,
    isReadOnly,
    locationCode,
    locationId,
    mode,
    options,
    pendingImages,
    reportLocationFailure,
    selectedCategoryName,
    selectedDepartmentName: selectedDepartment?.name?.trim() || null,
    selectedFeatures,
    selectedTags,
    selectedZoneName,
    setValues,
    values,
    visiblePersistedImages,
  })

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
      setOwnerPhoneInput('')
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

  function handleSelectDropboxSource() {
    runSelectDropboxSource()
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
    updateSaveProgress((currentState) =>
      updateLocationSaveStageStatus(currentState, key, status),
    )
  }

  function setSaveProgressError(
    key: LocationSaveStageKey,
    message: string,
  ) {
    updateSaveProgress((currentState) =>
      setLocationSaveProgressError(currentState, key, message),
    )
  }

  function markSaveProgressSuccess() {
    updateSaveProgress(markLocationSaveProgressSuccess)
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

  function resetAnalysisState() {
    runResetAnalysisState()
  }

  async function handleAnalyzeLocation() {
    await runAnalyzeLocation()
  }

  function handleApplyAnalysisChanges() {
    runApplyAnalysisChanges()
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
    await handleSelectedLocationImageFiles({
      createCorrelationId: createAdminCorrelationId,
      createPlaceholder: createPendingLocationImagePlaceholder,
      files,
      getNextOriginalIndex: getNextPendingImageOriginalIndex,
      imagePreparationConcurrency: IMAGE_PREPARATION_CONCURRENCY,
      isMountedRef,
      isReadOnly,
      pendingImagesRef,
      prepareImage: preparePendingLocationImage,
      removedPendingImageIdsRef,
      reportLocationFailure,
      revokePreviewUrl,
      setEditDeleteErrorMessage,
      setImageSelectionTarget,
      setImageValidationErrors,
      setIsPreparingImages,
      setPendingImages,
      setProcessedImagesCount,
      setTotalImagesToProcess,
      target,
    })
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

  function handleOpenManualBlur(imageId: string) {
    if (isReadOnly || manualBlurLoadingImageId !== null) {
      return
    }

    setManualBlurErrorMessage(null)
    setManualBlurTarget({
      imageId,
      kind: 'pending',
    })
  }

  async function handleOpenPersistedManualBlur(imageId: string) {
    if (
      isReadOnly ||
      mode !== 'edit' ||
      !locationId ||
      manualBlurLoadingImageId !== null
    ) {
      return
    }

    const persistedImage = visiblePersistedImages.find((image) => image.id === imageId)

    if (!persistedImage) {
      setImageErrorsById(current => ({ ...current, [imageId]: 'No pudimos encontrar la imagen a editar.' }))
      return
    }

    setImageErrorsById(current => ({ ...current, [imageId]: undefined }))
    setManualBlurErrorMessage(null)
    setManualBlurLoadingImageId(imageId)

    const correlationId = createAdminCorrelationId()
    try {
      const source = await downloadLocationImageSource({
        imageId,
        locationId,
      })
      const file = new File(
        [source.blob],
        `location-${imageId}.${getImageFileExtension(source.contentType)}`,
        {
          lastModified: Date.now(),
          type: source.contentType,
        },
      )
      const dimensions = await readImageFileDimensions(file)

      if (!isMountedRef.current) {
        return
      }

      setManualBlurTarget({
        editorImage: {
          errorMessage: null,
          file,
          height: dimensions.height,
          id: imageId,
          isCover: persistedImage.is_cover,
          originalIndex: persistedImage.sort_order,
          previewUrl: URL.createObjectURL(file),
          selectionTarget: persistedImage.is_cover ? 'cover' : 'gallery',
          status: 'pending',
          width: dimensions.width,
        },
        expectedStorageKey: persistedImage.storage_key,
        imageId,
        kind: 'persisted',
      })
    } catch (error) {
      reportLocationFailure(error, { operation: 'location.image.replace', resourceType: 'image', stage: 'images.source', correlationId, provider: 'browser', outcome: 'unknown' })
      if (isMountedRef.current) {
        setImageErrorsById(current => ({
          ...current,
          [imageId]: error instanceof Error ? error.message : 'No pudimos preparar la imagen para blur manual.',
        }))
      }
    } finally {
      if (isMountedRef.current) {
        setManualBlurLoadingImageId(null)
      }
    }
  }

  function handleCloseManualBlurModal() {
    if (isApplyingManualBlur) {
      return
    }

    if (manualBlurTarget?.kind === 'persisted') {
      revokePreviewUrl(manualBlurTarget.editorImage.previewUrl)
    }

    setManualBlurTarget(null)
    setManualBlurErrorMessage(null)
  }

  function renderImageFeedback() {
    if (imageValidationErrors.length === 0) {
      return null
    }

    return <LocationImageFeedback errors={imageValidationErrors} />
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

  async function handleApplyManualBlur(
    imageId: string,
    strokes: BlurStroke[],
  ) {
    const target = manualBlurTarget

    if (!target || target.imageId !== imageId) {
      setManualBlurErrorMessage('No pudimos encontrar la imagen a editar.')
      return
    }

    const image =
      target.kind === 'pending'
        ? pendingImagesRef.current.find((pendingImage) => pendingImage.id === imageId)
        : target.editorImage

    if (!image) {
      setManualBlurErrorMessage('No pudimos encontrar la imagen a editar.')
      return
    }

    const correlationId = createAdminCorrelationId()
    try {
      setIsApplyingManualBlur(true)
      setManualBlurErrorMessage(null)

      const blurredFile = await applyBlurStrokesToImage(image.file, strokes)

      if (target.kind === 'persisted') {
        if (!locationId) {
          throw new Error('No pudimos determinar la locación de esta imagen.')
        }

        const uploadedAsset = await uploadLocationImageAsset({
          file: blurredFile,
          locationId,
        })

        await replaceLocationImage({
          expectedStorageKey: target.expectedStorageKey,
          height: image.height,
          imageId,
          locationId,
          newCloudflareImageId: uploadedAsset.cloudflareImageId,
          width: image.width,
        })

        try {
          await locationImages.refresh({ operation: 'location.image.replace', correlationId, outcome: 'partial' })
        } catch (refreshError) {
          reportLocationFailure(refreshError, { operation: 'location.image.replace', resourceType: 'image', stage: 'images.refresh', provider: 'supabase', correlationId, outcome: 'partial' })
          console.error('No pudimos refrescar las imágenes de la locación.', refreshError)
        }

        revokePreviewUrl(target.editorImage.previewUrl)
        setManualBlurTarget(null)
        return
      }

      const nextPreviewUrl = URL.createObjectURL(blurredFile)

      setPendingImages((currentImages) =>
        currentImages.map((pendingImage) => {
          if (pendingImage.id !== imageId) {
            return pendingImage
          }

          revokePreviewUrl(pendingImage.previewUrl)

          return {
            ...pendingImage,
            errorMessage: null,
            file: blurredFile,
            previewUrl: nextPreviewUrl,
            status: 'pending',
          }
        }),
      )

      setManualBlurTarget(null)
    } catch (error) {
      reportLocationFailure(error, { operation: 'location.image.replace', resourceType: 'image', stage: 'images.blur', correlationId, provider: 'browser', outcome: 'unknown' })
      setManualBlurErrorMessage(
        error instanceof Error
          ? error.message
          : 'No pudimos aplicar el blur manual a esta imagen.',
      )
    } finally {
      setIsApplyingManualBlur(false)
    }
  }

  async function runPendingImageDeletes(nextLocationId: string, observation: AdminErrorContext) {
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
        throw annotateAdminError(error, { ...observation, stage: 'images.delete', outcome: 'partial' }, message)
      }

      updateSaveProgress((currentState) => ({
        ...currentState,
        deletingDone: index + 1,
      }))
    }

    updateStageStatus('deleteImages', 'done')
  }

  async function runPendingImageUploads(nextLocationId: string, observation: AdminErrorContext) {
    if (pendingImages.length === 0) {
      updateStageStatus('uploadImages', 'skipped')
      return null
    }

    let hasImageErrors = false
    const uploadPlan = buildLocationImageUploadPlan({
      mode,
      pendingImages,
      visiblePersistedImages,
    })
    const { uploads } = uploadPlan

    if (uploadPlan.invalidPendingImages.length > 0) {
      throw new Error('Hay imágenes que no se pudieron procesar. Quitalas o volvé a cargarlas antes de guardar.')
    }

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
      } catch (error) {
        hasImageErrors = true
        reportLocationFailure(error, { ...observation, resourceType: 'image', resourceId: nextLocationId, stage: 'images.upload', outcome: 'partial', extraSafeContext: { ...observation.extraSafeContext, image_count: uploads.length, image_index: image.originalIndex, image_mime: image.file.type, image_bytes: image.file.size, image_dimensions: { width: image.width, height: image.height }, timeout_ms: IMAGE_UPLOAD_TIMEOUT_MS } })

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
          : 'La locacion fue creada, pero algunas imagenes no se pudieron subir. Revisalas y volve a intentar.'

      setSaveProgressError('uploadImages', message)
      return message
    }

    updateStageStatus('uploadImages', 'done')
    return null
  }

  async function syncVisibleGallery(observation: AdminErrorContext) {
    const shouldSyncGallery =
      mode === 'edit' &&
      (pendingDeletedPersistedImageIds.length > 0 || pendingImages.length > 0)

    if (!shouldSyncGallery) {
      updateStageStatus('syncGallery', 'skipped')
      return
    }

    updateStageStatus('syncGallery', 'active')
    await locationImages.refresh({ ...observation, stage: 'images.refresh', provider: 'supabase' })
    if (locationImages.hasRefreshError()) {
      throw suppressAdminErrorReport(new Error('Los cambios se guardaron, pero no pudimos actualizar la galería. Volvé a intentar.'))
    }
    updateStageStatus('syncGallery', 'done')
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isReadOnly) {
      return
    }

    if (submitLockRef.current) {
      return
    }
    submitLockRef.current = true

    const observation = buildSubmitObservation({ correlationId: createAdminCorrelationId(), locationId, mode })
    let resolvedOwnerId = values.owner_id || null
    let createdOwnerName: string | null = null

    try {
      observation.stage = 'validation'
      const nextFieldErrors = validateRequiredFields(values, {
        ownerName: ownerInputValue,
        ownerPhone: ownerPhoneValue,
      })

      setFieldErrors(nextFieldErrors)

      if (hasFieldErrors(nextFieldErrors)) {
        setSubmitError(null)
        setValidationModalMessages(getValidationMessages(nextFieldErrors))
        return
      }

      observation.stage = 'payload'
      protection.markIncomplete()
      setIsSubmitting(true)
      setSubmitError(null)
      setValidationModalMessages([])
      setEditDeleteErrorMessage(null)
      openSaveProgress()
      updateStageStatus('location', 'active')

      if (!resolvedOwnerId) {
        const inlineOwnerDraft = getInlineOwnerDraft({
          ownerName: ownerInputValue,
          ownerPhone: ownerPhoneValue,
        })

        if (inlineOwnerDraft.shouldCreate) {
          observation.stage = 'owner.inline'
          observation.provider = 'supabase'
          resolvedOwnerId = await createOwner(
            buildInlineOwnerCreatePayload({
              full_name: inlineOwnerDraft.full_name,
              phone: inlineOwnerDraft.phone,
            }),
            {
              actorProfileId: profile?.id ?? null,
              correlationId: observation.correlationId,
            },
          )
          observation.outcome = 'partial'
          observation.extraSafeContext = { confirmed_stages: ['owner.inline'] }
          createdOwnerName = inlineOwnerDraft.full_name
          setValues((currentValues) => ({
            ...currentValues,
            owner_id: resolvedOwnerId ?? '',
          }))
          setOwnerSearchTerm(inlineOwnerDraft.full_name)
          setOwnerPhoneInput(inlineOwnerDraft.phone)
        }
      }

      observation.stage = 'payload'
      const payload = buildPayload(
        buildSubmitPayloadValues(values, resolvedOwnerId),
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
          correlationId: observation.correlationId,
        })
        Object.assign(observation, getLocationWriteObservationPatch({ locationId, mode }))
        updateStageStatus('location', 'done')

        await runPendingImageDeletes(locationId, observation)
        setPendingDeletedPersistedImageIds([])
        const uploadErrorMessage = await runPendingImageUploads(locationId, observation)
        await syncVisibleGallery(observation)

        setPendingImages((currentImages) => {
          currentImages.forEach((image) => {
            if (image.status === 'done') {
              revokePreviewUrl(image.previewUrl)
            }
          })

          return currentImages.filter((image) => image.status !== 'done')
        })

        if (uploadErrorMessage) {
          throw suppressAdminErrorReport(new Error(uploadErrorMessage))
        }

        protection.markSaved()
        updateStageStatus('completed', 'done')
        markSaveProgressSuccess()
        await wait(SAVE_SUCCESS_DELAY_MS)
        setSaveProgress(null)
        if (onEditSuccess) {
          await onEditSuccess()
          return
        }

        navigate(routePaths.locations)
      } else {
        // Retain a partially created location so retries do not create duplicates.
        const existingCreatedLocationId = createdLocationIdRef.current
        const createdLocationId = existingCreatedLocationId ?? await createLocation(payload, {
          actorProfileId: profile?.id ?? null,
          correlationId: observation.correlationId,
          onLocationCreated: (confirmedLocationId) => {
            createdLocationIdRef.current = confirmedLocationId
          },
        })
        if (existingCreatedLocationId) {
          await updateLocation(createdLocationId, payload, {
            actorProfileId: profile?.id ?? null,
            correlationId: observation.correlationId,
          })
        }
        createdLocationIdRef.current = createdLocationId
        Object.assign(observation, getLocationWriteObservationPatch({ locationId: createdLocationId, mode }))
        updateStageStatus('location', 'done')

        await runPendingImageDeletes(createdLocationId, observation)
        setPendingDeletedPersistedImageIds([])

        const uploadErrorMessage = await runPendingImageUploads(createdLocationId, observation)

        setPendingImages((currentImages) => {
          currentImages.forEach((image) => {
            if (image.status === 'done') {
              revokePreviewUrl(image.previewUrl)
            }
          })

          return currentImages.filter((image) => image.status !== 'done')
        })

        if (uploadErrorMessage) {
          throw suppressAdminErrorReport(new Error(uploadErrorMessage))
        }

        await syncVisibleGallery(observation)

        protection.markSaved()
        updateStageStatus('completed', 'done')
        markSaveProgressSuccess()
        await wait(SAVE_SUCCESS_DELAY_MS)
        setSaveProgress(null)
        if (onCreateSuccess) {
          await onCreateSuccess()
          return
        }

        navigate(routePaths.locations)
      }
    } catch (error) {
      reportLocationFailure(error, observation)
      const message = getSubmitErrorMessage({
        createdOwnerName,
        error,
        mode,
      })

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
    } finally {
      submitLockRef.current = false
      setSaveProgress(null)
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
      <LocationSaveProgressView
        isReadOnly={isReadOnly}
        progress={saveProgress}
      />
      {!isReadOnly ? (
        <LocationValidationModal
          isOpen={validationModalMessages.length > 0}
          messages={validationModalMessages}
          onClose={() => setValidationModalMessages([])}
        />
      ) : null}
      <LocationImageModals
        imageSelectionTarget={imageSelectionTarget}
        isApplyingManualBlur={isApplyingManualBlur}
        isDropboxImporting={isDropboxImporting}
        isImageSourceModalOpen={isImageSourceModalOpen}
        isReadOnly={isReadOnly}
        manualBlurErrorMessage={manualBlurErrorMessage}
        manualBlurTarget={manualBlurTarget}
        onApplyManualBlur={handleApplyManualBlur}
        onChooseDevice={handleSelectDeviceSource}
        onChooseDropbox={() => void handleSelectDropboxSource()}
        onCloseImageSourceModal={handleCloseImageSourceModal}
        onCloseManualBlurModal={handleCloseManualBlurModal}
        pendingImages={pendingImages}
      />
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
          locationCodePrefix={categoryCreateLocationCodePrefix}
          name={categoryCreateName}
          onChange={handleCategoryCreateChange}
          onLocationCodePrefixChange={handleCategoryCreateLocationCodePrefixChange}
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
              <LocationBasicFields
                fieldErrors={fieldErrors}
                isReadOnly={isReadOnly}
                mode={mode}
                onTextChange={handleTextChange}
                primaryCardActions={primaryCardActions}
                values={values}
              />

              <LocationCategoryZoneFields
                categoryComboboxRef={categoryComboboxRef}
                categoryInputValue={categoryInputValue}
                fieldErrors={fieldErrors}
                filteredCategories={filteredCategories}
                isCategoryComboboxOpen={isCategoryComboboxOpen}
                isCreatingCategory={isCreatingCategory}
                isReadOnly={isReadOnly}
                isSubmitting={isSubmitting}
                onCategoryDropdownToggle={handleCategoryDropdownToggle}
                onCategorySearchChange={handleCategorySearchChange}
                onCategorySelect={handleCategorySelect}
                onOpenCategoryModal={handleOpenCategoryModal}
                selectedCategoryName={selectedCategoryName}
                setIsCategoryComboboxOpen={setIsCategoryComboboxOpen}
                values={values}
              />

              <LocationOwnerFields
                fieldErrors={fieldErrors}
                filteredOwners={filteredOwners}
                isOwnerComboboxOpen={isOwnerComboboxOpen}
                isReadOnly={isReadOnly}
                onOwnerDropdownToggle={handleOwnerDropdownToggle}
                onOwnerPhoneChange={handleOwnerPhoneChange}
                onOwnerSearchChange={handleOwnerSearchChange}
                onOwnerSelect={handleOwnerSelect}
                ownerComboboxRef={ownerComboboxRef}
                ownerInputValue={ownerInputValue}
                ownerPhoneValue={ownerPhoneValue}
                setIsOwnerComboboxOpen={setIsOwnerComboboxOpen}
                values={values}
              />

              <LocationAddressFields
                fieldErrors={fieldErrors}
                googleMapsApiKey={googleMapsApiKey}
                isReadOnly={isReadOnly}
                isSubmitting={isSubmitting}
                onGooglePlaceSelected={handleGooglePlaceSelected}
                onTextChange={handleTextChange}
                resolvedViewAddress={resolvedViewAddress}
                values={values}
              />
            </div>

            <LocationCoverField
              coverImageUploaderRef={coverImageUploaderRef}
              googleMapsApiKey={googleMapsApiKey}
              imageErrorsById={imageErrorsById}
              isDropboxImporting={isDropboxImporting}
              isPreparingImages={isPreparingImages}
              isSubmitting={isSubmitting}
              manualBlurLoadingImageId={manualBlurLoadingImageId}
              mode={mode}
              onCoverImageSelected={handleCoverImageSelected}
              onDeletePersistedImage={handleDeletePersistedImage}
              onManualBlur={handleOpenManualBlur}
              onOpenImageSourceModal={handleOpenImageSourceModal}
              onOpenPersistedManualBlur={handleOpenPersistedManualBlur}
              onRemovePendingImage={handleRemovePendingImage}
              onSetCoverImage={handleSetCoverImage}
              pendingCoverImage={pendingCoverImage}
              persistedCoverImage={persistedCoverImage}
              renderImageFeedback={renderImageFeedback}
              showImagesSection={showImagesSection}
              values={values}
            />
          </div>

          <LocationZoneHiddenFields
            filteredZoneOptions={filteredZoneOptions}
            isCreatingZone={isCreatingZone}
            isSubmitting={isSubmitting}
            isZoneComboboxOpen={isZoneComboboxOpen}
            onOpenZoneModal={handleOpenZoneModal}
            onTextChange={handleTextChange}
            onZoneDropdownToggle={handleZoneDropdownToggle}
            onZoneSearchChange={handleZoneSearchChange}
            onZoneSelect={handleZoneSelect}
            options={options}
            setIsZoneComboboxOpen={setIsZoneComboboxOpen}
            values={values}
            zoneComboboxRef={zoneComboboxRef}
            zoneDepartmentPrompt={zoneDepartmentPrompt}
            zoneInputValue={zoneInputValue}
          />

          <div className="space-y-8 border-t border-slate-200 pt-6">
            <h3 className="text-2xl font-semibold text-slate-950">Características</h3>
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
          </div>

          <LocationGalleryField
            combinedEditGalleryImages={combinedEditGalleryImages}
            editDeleteErrorMessage={editDeleteErrorMessage}
            galleryImageUploaderRef={galleryImageUploaderRef}
            imageErrorsById={imageErrorsById}
            isDropboxImporting={isDropboxImporting}
            isPreparingImages={isPreparingImages}
            isSubmitting={isSubmitting}
            manualBlurLoadingImageId={manualBlurLoadingImageId}
            mode={mode}
            onDeletePersistedImage={handleDeletePersistedImage}
            onGalleryImagesSelected={handleGalleryImagesSelected}
            onManualBlur={handleOpenManualBlur}
            onOpenImageSourceModal={handleOpenImageSourceModal}
            onOpenPersistedManualBlur={handleOpenPersistedManualBlur}
            onRemovePendingImage={handleRemovePendingImage}
            pendingGalleryImages={pendingGalleryImages}
            persistedGalleryImages={persistedGalleryImages}
            processedImagesCount={processedImagesCount}
            showImagesSection={showImagesSection}
            totalImagesToProcess={totalImagesToProcess}
          />

        </div>
        </LocationGoogleProvider>
      </SectionCard>

      <LocationAdvancedFields
        onCheckboxChange={handleCheckboxChange}
        onTextChange={handleTextChange}
        showAdvancedSection={showAdvancedSection}
        values={values}
      />

        <LocationFormActions
          hasProcessingPendingImages={hasProcessingPendingImages}
          isDropboxImporting={isDropboxImporting}
          isReadOnly={isReadOnly}
          isSubmitting={isSubmitting}
          mode={mode}
          onCancel={() => navigate(routePaths.locations)}
          processedImagesCount={processedImagesCount}
          totalImagesToProcess={totalImagesToProcess}
        />
      </form>
    </>
  )
}

export default LocationForm
