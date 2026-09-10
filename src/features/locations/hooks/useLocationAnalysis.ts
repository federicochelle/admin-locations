import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { createAdminCorrelationId, type AdminErrorContext } from '../../../lib/admin-error-reporting'
import { locationAnalysisService } from '../../location-analysis/location-analysis.service'
import type {
  LocationAnalysisImageInput,
  LocationAnalysisInput,
  LocationAnalysisResult,
} from '../../location-analysis/location-analysis.types'
import type {
  LocationFeatureOption,
  LocationFormOptions,
  LocationFormValues,
  LocationTagOption,
} from '../locations.types'
import type {
  LocationImageRecord,
  PendingLocationImageFile,
} from '../location-images.types'

export type LocationAnalysisState = {
  analysisError: string | null
  analysisLoading: boolean
  analysisResult: LocationAnalysisResult | null
  suggestedFeatures: string[]
  suggestedTags: string[]
  suggestedDescription: string | null
}

const defaultAnalysisState: LocationAnalysisState = {
  analysisError: null,
  analysisLoading: false,
  analysisResult: null,
  suggestedFeatures: [],
  suggestedTags: [],
  suggestedDescription: null,
}

type UseLocationAnalysisInput = {
  hasAnalyzablePendingImages: boolean
  hasAnalyzablePersistedImages: boolean
  isReadOnly: boolean
  locationCode: string | null
  locationId?: string
  mode: 'create' | 'edit' | 'view'
  options: LocationFormOptions | null
  pendingImages: PendingLocationImageFile[]
  reportLocationFailure: (
    error: unknown,
    context: Partial<AdminErrorContext>,
  ) => void
  selectedCategoryName: string
  selectedDepartmentName: string | null
  selectedFeatures: LocationFeatureOption[]
  selectedTags: LocationTagOption[]
  selectedZoneName: string
  setValues: Dispatch<SetStateAction<LocationFormValues>>
  values: LocationFormValues
  visiblePersistedImages: LocationImageRecord[]
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

export function useLocationAnalysis({
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
  selectedDepartmentName,
  selectedFeatures,
  selectedTags,
  selectedZoneName,
  setValues,
  values,
  visiblePersistedImages,
}: UseLocationAnalysisInput) {
  const [analysisState, setAnalysisState] =
    useState<LocationAnalysisState>(defaultAnalysisState)

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

    let transientPendingAnalysisImages: LocationAnalysisImageInput[]
    const correlationId = createAdminCorrelationId()
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
      reportLocationFailure(error, { operation: 'location.analysis', stage: 'analysis', correlationId })
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
      departmentName: selectedDepartmentName,
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
      reportLocationFailure(error, { operation: 'location.analysis', stage: 'analysis', correlationId })
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

  return {
    analysisState,
    handleAnalyzeLocation,
    handleApplyAnalysisChanges,
    isAnalysisDisabled:
      isReadOnly ||
      isSubmittingLikeAnalysisDisabled({
        hasAnalyzablePendingImages,
        hasAnalyzablePersistedImages,
        mode,
      }),
    resetAnalysisState,
    suggestedFeatureNames,
    suggestedTagNames,
  }
}

function isSubmittingLikeAnalysisDisabled({
  hasAnalyzablePendingImages,
  hasAnalyzablePersistedImages,
  mode,
}: {
  hasAnalyzablePendingImages: boolean
  hasAnalyzablePersistedImages: boolean
  mode: 'create' | 'edit' | 'view'
}) {
  return mode === 'edit'
    ? !hasAnalyzablePersistedImages
    : !hasAnalyzablePendingImages
}
