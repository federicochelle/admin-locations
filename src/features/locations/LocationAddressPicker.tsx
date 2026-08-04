import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  APILoadingStatus,
  useApiLoadingStatus,
  useMapsLibrary,
} from '@vis.gl/react-google-maps'
import {
  isGoogleMapsUrl,
  parseGoogleMapsUrlReference,
  parseGooglePlaceResult,
  type GoogleMapsCoordinates,
  type ParsedGooglePlaceAddress,
} from './location-address-parser'
import { getSupabaseClient } from '../../lib/supabase'

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
  Place: GooglePlaceConstructorLike
}

type GooglePlacePredictionLike = {
  toPlace: () => {
    fetchFields: (options: { fields: string[] }) => Promise<unknown>
  }
}

type GooglePlaceFetchableLike = GooglePlaceWithAuditFields & {
  fetchFields: (options: { fields: string[] }) => Promise<unknown>
}

type GooglePlaceConstructorLike = {
  new (options: { id?: string | null }): GooglePlaceFetchableLike
  searchByText?: (options: {
    textQuery: string
    fields: string[]
    language?: string
    locationBias?: {
      center: {
        lat: number
        lng: number
      }
      radius: number
    }
    region?: string
  }) => Promise<{ places?: GooglePlaceFetchableLike[] | null }>
}

type GooglePlacePredictionSelectEventLike = Event & {
  placePrediction?: GooglePlacePredictionLike
}

type GooglePlaceAddressComponentLike = {
  long_name?: string | null
  short_name?: string | null
  longText?: string | null
  shortText?: string | null
  types?: string[] | null
}

type GooglePlaceGeometryLocationLike = {
  lat?: (() => number) | number | null
  lng?: (() => number) | number | null
} | null

type GooglePlaceViewportBoundLike = {
  lat?: (() => number) | number | null
  lng?: (() => number) | number | null
} | null

type GooglePlaceViewportLike = {
  getNorthEast?: () => GooglePlaceViewportBoundLike
  getSouthWest?: () => GooglePlaceViewportBoundLike
  northeast?: GooglePlaceViewportBoundLike
  southwest?: GooglePlaceViewportBoundLike
} | null

type GooglePlaceWithAuditFields = {
  addressComponents?: GooglePlaceAddressComponentLike[] | null
  formattedAddress?: string | null
  location?: GooglePlaceGeometryLocationLike
  viewport?: GooglePlaceViewportLike
  id?: string | null
  plusCode?: unknown
  types?: string[] | null
  displayName?: unknown
  shortFormattedAddress?: string | null
  adrFormatAddress?: string | null
  postalAddress?: unknown
  googleMapsURI?: string | null
  googleMapsLinks?: unknown
  businessStatus?: string | null
  primaryType?: string | null
  primaryTypeDisplayName?: unknown
  nationalPhoneNumber?: string | null
  internationalPhoneNumber?: string | null
  websiteURI?: string | null
  utcOffsetMinutes?: number | null
  regularOpeningHours?: unknown
} & Record<string, unknown>

export type LocationAddressPickerProps = {
  formattedAddress?: string | null
  value: string
  disabled?: boolean
  error?: string | null
  children?: ReactNode
  onPlaceSelected: (place: ParsedGooglePlaceAddress) => void
}

const GOOGLE_MAPS_URL_ERROR_MESSAGE =
  'No pudimos obtener la ubicación desde ese enlace.'
const GOOGLE_PLACE_FIELDS = [
  'addressComponents',
  'adrFormatAddress',
  'businessStatus',
  'displayName',
  'formattedAddress',
  'googleMapsLinks',
  'googleMapsURI',
  'id',
  'internationalPhoneNumber',
  'location',
  'nationalPhoneNumber',
  'plusCode',
  'postalAddress',
  'primaryType',
  'primaryTypeDisplayName',
  'regularOpeningHours',
  'shortFormattedAddress',
  'types',
  'utcOffsetMinutes',
  'viewport',
  'websiteURI',
] as const

async function fetchGooglePlaceFields(place: GooglePlaceFetchableLike) {
  await place.fetchFields({
    fields: [...GOOGLE_PLACE_FIELDS],
  })
}

function getPlaceCoordinates(place: GooglePlaceFetchableLike) {
  const lat = getCoordinateValue(place.location?.lat)
  const lng = getCoordinateValue(place.location?.lng)

  if (lat == null || lng == null) {
    return null
  }

  return { lat, lng }
}

function getCoordinateDistanceScore(
  left: GoogleMapsCoordinates,
  right: GoogleMapsCoordinates,
) {
  const latDistance = left.lat - right.lat
  const lngDistance = left.lng - right.lng

  return Math.sqrt(latDistance ** 2 + lngDistance ** 2)
}

function selectBestTextSearchResult(input: {
  fallbackCoordinates: GoogleMapsCoordinates | null
  places: GooglePlaceFetchableLike[]
}) {
  const { fallbackCoordinates, places } = input

  if (places.length === 0) {
    return null
  }

  if (!fallbackCoordinates) {
    return places[0] ?? null
  }

  const rankedPlaces = places
    .map((place) => ({
      distance:
        getPlaceCoordinates(place) == null
          ? Number.POSITIVE_INFINITY
          : getCoordinateDistanceScore(
              getPlaceCoordinates(place) as GoogleMapsCoordinates,
              fallbackCoordinates,
            ),
      place,
    }))
    .sort((left, right) => left.distance - right.distance)

  return rankedPlaces[0]?.place ?? places[0] ?? null
}

function buildSearchByTextRequest(input: {
  fallbackCoordinates: GoogleMapsCoordinates | null
  textQuery: string
}) {
  const { fallbackCoordinates, textQuery } = input

  return {
    textQuery,
    fields: [...GOOGLE_PLACE_FIELDS],
    language: 'es',
    region: 'uy',
    locationBias: fallbackCoordinates
      ? {
          center: fallbackCoordinates,
          radius: 5_000,
        }
      : undefined,
  }
}

async function resolveGoogleMapsShortUrlViaBackend(url: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke<{
    resolvedUrl?: string | null
    url?: string | null
  }>('resolve-google-maps-url', {
    body: {
      url,
    },
  })

  if (error) {
    throw error
  }

  const resolvedUrl = data?.resolvedUrl?.trim() || data?.url?.trim() || null

  return resolvedUrl
}

async function resolveGoogleMapsUrlToParsedPlace(
  inputValue: string,
  placesLibrary: GooglePlacesLibraryLike,
) {
  let reference = parseGoogleMapsUrlReference(inputValue)

  if (!reference) {
    throw new Error('INVALID_GOOGLE_MAPS_URL')
  }

  if (reference.kind === 'short-url') {
    // Short links require following a redirect chain. We keep that resolution isolated
    // behind a backend function instead of attempting a cross-origin client fetch.
    const resolvedUrl = await resolveGoogleMapsShortUrlViaBackend(reference.url)

    if (!resolvedUrl) {
      throw new Error('UNRESOLVED_GOOGLE_MAPS_SHORT_URL')
    }

    reference = parseGoogleMapsUrlReference(resolvedUrl)

    if (!reference || reference.kind === 'short-url') {
      throw new Error('UNRESOLVED_GOOGLE_MAPS_SHORT_URL')
    }
  }

  let place: GooglePlaceFetchableLike | null = null

  if (reference.kind === 'place-id') {
    place = new placesLibrary.Place({
      id: reference.placeId,
    })

    await fetchGooglePlaceFields(place)
  }

  if (reference.kind === 'text-query') {
    if (typeof placesLibrary.Place.searchByText !== 'function') {
      throw new Error('GOOGLE_TEXT_SEARCH_UNAVAILABLE')
    }

    const searchArguments = buildSearchByTextRequest({
      textQuery: reference.textQuery,
      fallbackCoordinates: reference.fallbackCoordinates,
    })

    const result = await placesLibrary.Place.searchByText(searchArguments)
    const places = result.places ?? []

    place = selectBestTextSearchResult({
      fallbackCoordinates: reference.fallbackCoordinates,
      places,
    })

    if (!place) {
      throw new Error('GOOGLE_TEXT_SEARCH_EMPTY')
    }
  }

  if (!place) {
    throw new Error('GOOGLE_MAPS_URL_UNSUPPORTED')
  }

  return parseGooglePlaceResult(
    place as Parameters<typeof parseGooglePlaceResult>[0],
  )
}

function inputClassName(error: string | null) {
  return [
    'w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200',
    error
      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
      : 'border-slate-300',
  ].join(' ')
}

function getCoordinateValue(
  coordinate: (() => number) | number | null | undefined,
) {
  if (typeof coordinate === 'function') {
    return coordinate()
  }

  return typeof coordinate === 'number' ? coordinate : null
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
  const resolutionRequestIdRef = useRef(0)
  const [linkErrorMessage, setLinkErrorMessage] = useState<string | null>(null)
  const [isProcessingLink, setIsProcessingLink] = useState(false)

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
      await fetchGooglePlaceFields(
        place as Parameters<typeof fetchGooglePlaceFields>[0],
      )

      const parsedPlace = parseGooglePlaceResult(
        place as Parameters<typeof parseGooglePlaceResult>[0],
      )

      onPlaceSelected(parsedPlace)
    }
    const handleInput = () => {
      const nextValue = autocompleteElement.value
      const currentRequestId = resolutionRequestIdRef.current + 1
      resolutionRequestIdRef.current = currentRequestId
      setLinkErrorMessage(null)

      if (isGoogleMapsUrl(nextValue)) {
        setIsProcessingLink(true)

        void resolveGoogleMapsUrlToParsedPlace(
          nextValue,
          placesLibrary as GooglePlacesLibraryLike,
        )
          .then((parsedPlace) => {
            if (resolutionRequestIdRef.current !== currentRequestId) {
              return
            }

            setIsProcessingLink(false)
            setLinkErrorMessage(null)
            onPlaceSelected(parsedPlace)
          })
          .catch(() => {
            if (resolutionRequestIdRef.current !== currentRequestId) {
              return
            }

            setIsProcessingLink(false)
            setLinkErrorMessage(GOOGLE_MAPS_URL_ERROR_MESSAGE)
            autocompleteElement.value = value
          })

        return
      }

      setIsProcessingLink(false)
    }
    autocompleteElement.addEventListener('gmp-select', handlePlaceSelect)
    autocompleteElement.addEventListener('input', handleInput)

    return () => {
      autocompleteElement.removeEventListener('gmp-select', handlePlaceSelect)
      autocompleteElement.removeEventListener('input', handleInput)
      autocompleteElementRef.current = null
      if (container.contains(autocompleteElement as unknown as Node)) {
        container.removeChild(autocompleteElement as unknown as Node)
      }
    }
  }, [apiLoadingStatus, onPlaceSelected, placesLibrary, value])

  useEffect(() => {
    const autocompleteElement = autocompleteElementRef.current

    if (!autocompleteElement) {
      return
    }

    autocompleteElement.value = value
    autocompleteElement.disabled = disabled || isProcessingLink
    autocompleteElement.placeholder =
      'Buscar dirección o pegar enlace de Google Maps'
    autocompleteElement.requestedLanguage = 'es'
    autocompleteElement.requestedRegion = 'uy'
    autocompleteElement.includedRegionCodes = ['uy']
    autocompleteElement.className = inputClassName(error)
  }, [disabled, error, isProcessingLink, value])

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
      {isProcessingLink ? (
        <p className="text-sm text-slate-600">Procesando enlace...</p>
      ) : null}
      {linkErrorMessage ? (
        <p className="text-sm text-red-700">{linkErrorMessage}</p>
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
