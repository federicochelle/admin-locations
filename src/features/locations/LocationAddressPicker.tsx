import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  APILoadingStatus,
  useApiLoadingStatus,
  useMapsLibrary,
} from '@vis.gl/react-google-maps'
import {
  parseGooglePlaceResult,
  type ParsedGooglePlaceAddress,
} from './location-address-parser'

type GooglePlacesAutocompleteLike = {
  value: string
  disabled: boolean
  placeholder: string | null
  requestedLanguage: string | null
  requestedRegion: string | null
  includedRegionCodes: string[] | null
  className: string
  addEventListener: (
    eventName: 'gmp-select' | 'input',
    handler: (event: Event) => void,
  ) => void
  removeEventListener: (
    eventName: 'gmp-select' | 'input',
    handler: (event: Event) => void,
  ) => void
}

type GooglePlacesLibraryLike = {
  PlaceAutocompleteElement: new () => GooglePlacesAutocompleteLike
}

type GooglePlacePredictionLike = {
  toPlace: () => {
    fetchFields: (options: { fields: string[] }) => Promise<unknown>
  }
}

type GooglePlacePredictionSelectEventLike = Event & {
  placePrediction?: GooglePlacePredictionLike
}

export type LocationAddressPickerProps = {
  formattedAddress?: string | null
  value: string
  disabled?: boolean
  error?: string | null
  children?: ReactNode
  onPlaceSelected: (place: ParsedGooglePlaceAddress) => void
}

function inputClassName(error: string | null) {
  return [
    'w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200',
    error
      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
      : 'border-slate-300',
  ].join(' ')
}

function LocationAddressPickerInput({
  children,
  formattedAddress = null,
  disabled = false,
  error = null,
  onPlaceSelected,
  value,
}: LocationAddressPickerProps) {
  const placesLibrary = useMapsLibrary('places')
  const apiLoadingStatus = useApiLoadingStatus()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const autocompleteElementRef = useRef<GooglePlacesAutocompleteLike | null>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!placesLibrary || !container || autocompleteElementRef.current) {
      return
    }

    const autocompleteElement = new (
      placesLibrary as GooglePlacesLibraryLike
    ).PlaceAutocompleteElement()
    autocompleteElementRef.current = autocompleteElement
    container.innerHTML = ''
    container.appendChild(autocompleteElement as unknown as Node)

    const handlePlaceSelect = async (event: Event) => {
      const placePrediction =
        (event as GooglePlacePredictionSelectEventLike).placePrediction ?? null

      if (!placePrediction) {
        return
      }

      const place = placePrediction.toPlace()
      await place.fetchFields({
        fields: ['addressComponents', 'formattedAddress', 'id', 'location'],
      })

      const parsedPlace = parseGooglePlaceResult(
        place as Parameters<typeof parseGooglePlaceResult>[0],
      )

      onPlaceSelected(parsedPlace)
    }
    autocompleteElement.addEventListener('gmp-select', handlePlaceSelect)

    return () => {
      autocompleteElement.removeEventListener('gmp-select', handlePlaceSelect)
      autocompleteElementRef.current = null
      if (container.contains(autocompleteElement as unknown as Node)) {
        container.removeChild(autocompleteElement as unknown as Node)
      }
    }
  }, [apiLoadingStatus, onPlaceSelected, placesLibrary])

  useEffect(() => {
    const autocompleteElement = autocompleteElementRef.current

    if (!autocompleteElement) {
      return
    }

    autocompleteElement.value = value
    autocompleteElement.disabled = disabled
    autocompleteElement.placeholder = 'Buscar dirección...'
    autocompleteElement.requestedLanguage = 'es'
    autocompleteElement.requestedRegion = 'uy'
    autocompleteElement.includedRegionCodes = ['uy']
    autocompleteElement.className = inputClassName(error)
  }, [disabled, error, value])

  const helperMessage = useMemo(() => {
    if (
      apiLoadingStatus === APILoadingStatus.FAILED ||
      apiLoadingStatus === APILoadingStatus.AUTH_FAILURE
    ) {
      return 'No se pudo cargar Google Places. Verifica la conexion o la configuracion de Google Maps para cargar una ubicacion.'
    }

    if (apiLoadingStatus === APILoadingStatus.LOADING) {
      return 'Cargando sugerencias de Google Places...'
    }

    return null
  }, [apiLoadingStatus])

  return (
    <div className="space-y-2">
      <div
        id="google-location-search"
        ref={containerRef}
        className="relative z-30"
      />
      {helperMessage ? (
        <p className="text-sm text-slate-600">{helperMessage}</p>
      ) : null}
      {formattedAddress ? (
        <p className="text-sm text-slate-600">
          Direccion seleccionada: {formattedAddress}
        </p>
      ) : null}
      {children}
    </div>
  )
}

function LocationAddressPicker(props: LocationAddressPickerProps) {
  return <LocationAddressPickerInput {...props} />
}

export default LocationAddressPicker
