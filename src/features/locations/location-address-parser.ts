type GooglePlaceAddressComponent = {
  long_name?: string | null
  short_name?: string | null
  longText?: string | null
  shortText?: string | null
  types?: string[] | null
}

type GooglePlaceGeometryLocation =
  | {
      lat?: (() => number) | number | null
      lng?: (() => number) | number | null
    }
  | null

type GooglePlaceResultLike = {
  place_id?: string | null
  id?: string | null
  formatted_address?: string | null
  formattedAddress?: string | null
  address_components?: GooglePlaceAddressComponent[] | null
  addressComponents?: GooglePlaceAddressComponent[] | null
  geometry?: {
    location?: GooglePlaceGeometryLocation
  } | null
  location?: GooglePlaceGeometryLocation
}

export type ParsedGooglePlaceAddress = {
  google_place_id: string | null
  formatted_address: string | null
  google_department_name: string | null
  google_zone_name: string | null
  address_components: GooglePlaceAddressComponent[] | null
  lat: number | null
  lng: number | null
}

export type ParsedGoogleMapsUrlReference =
  | {
      kind: 'short-url'
      url: string
    }
  | {
      kind: 'place-id'
      url: string
      placeId: string
      textQuery: string | null
      fallbackCoordinates: GoogleMapsCoordinates | null
    }
  | {
      kind: 'text-query'
      url: string
      textQuery: string
      fallbackCoordinates: GoogleMapsCoordinates | null
    }

export type GoogleMapsCoordinates = {
  lat: number
  lng: number
}

const ZONE_COMPONENT_PRIORITY = [
  'sublocality',
  'sublocality_level_1',
  'neighborhood',
  'locality',
] as const

const GOOGLE_MAPS_SHORT_HOST = 'maps.app.goo.gl'
const GOOGLE_MAPS_LONG_HOSTS = new Set(['google.com', 'www.google.com', 'maps.google.com'])

function normalizeUrlHostname(hostname: string) {
  return hostname.trim().toLocaleLowerCase().replace(/\.+$/, '')
}

function decodeGoogleMapsText(value: string) {
  if (!value) {
    return null
  }

  try {
    const decodedValue = decodeURIComponent(value.replace(/\+/g, ' ')).trim()
    return decodedValue.length > 0 ? decodedValue : null
  } catch {
    const normalizedValue = value.replace(/\+/g, ' ').trim()
    return normalizedValue.length > 0 ? normalizedValue : null
  }
}

function extractGoogleMapsTextQuery(url: URL) {
  const queryLikeValues = [
    url.searchParams.get('q'),
    url.searchParams.get('query'),
    url.searchParams.get('destination'),
  ]

  for (const value of queryLikeValues) {
    const decodedValue = decodeGoogleMapsText(value ?? '')

    if (decodedValue) {
      return decodedValue
    }
  }

  const pathSegments = url.pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
  const placeSegmentIndex = pathSegments.findIndex((segment) => segment === 'place')

  if (placeSegmentIndex >= 0 && pathSegments[placeSegmentIndex + 1]) {
    return decodeGoogleMapsText(pathSegments[placeSegmentIndex + 1] ?? '')
  }

  const searchSegmentIndex = pathSegments.findIndex((segment) => segment === 'search')

  if (searchSegmentIndex >= 0 && pathSegments[searchSegmentIndex + 1]) {
    return decodeGoogleMapsText(pathSegments[searchSegmentIndex + 1] ?? '')
  }

  return null
}

function parseGoogleMapsCoordinate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsedValue = Number.parseFloat(value)

  return Number.isFinite(parsedValue) ? parsedValue : null
}

function extractGoogleMapsFallbackCoordinates(rawUrl: string) {
  const exactMatch = rawUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)

  if (exactMatch) {
    const lat = parseGoogleMapsCoordinate(exactMatch[1])
    const lng = parseGoogleMapsCoordinate(exactMatch[2])

    if (lat != null && lng != null) {
      return { lat, lng }
    }
  }

  return null
}

export function isGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value.trim())
    const normalizedHostname = normalizeUrlHostname(url.hostname)

    if (normalizedHostname === GOOGLE_MAPS_SHORT_HOST) {
      return true
    }

    if (!GOOGLE_MAPS_LONG_HOSTS.has(normalizedHostname)) {
      return false
    }

    return normalizedHostname === 'maps.google.com' || url.pathname.startsWith('/maps')
  } catch {
    return false
  }
}

export function parseGoogleMapsUrlReference(
  value: string,
): ParsedGoogleMapsUrlReference | null {
  let url: URL
  const trimmedValue = value.trim()

  try {
    url = new URL(trimmedValue)
  } catch {
    return null
  }

  const normalizedHostname = normalizeUrlHostname(url.hostname)

  if (normalizedHostname === GOOGLE_MAPS_SHORT_HOST) {
    return {
      kind: 'short-url',
      url: url.toString(),
    }
  }

  if (!isGoogleMapsUrl(url.toString())) {
    return null
  }

  const placeId =
    url.searchParams.get('query_place_id')?.trim() ||
    url.searchParams.get('place_id')?.trim() ||
    null
  const textQuery = extractGoogleMapsTextQuery(url)
  const fallbackCoordinates = extractGoogleMapsFallbackCoordinates(trimmedValue)

  if (placeId) {
    return {
      kind: 'place-id',
      url: url.toString(),
      placeId,
      textQuery,
      fallbackCoordinates,
    }
  }

  if (textQuery) {
    return {
      kind: 'text-query',
      url: url.toString(),
      textQuery,
      fallbackCoordinates,
    }
  }

  return null
}

function normalizeDepartmentName(value: string | null | undefined) {
  const trimmedValue = value?.trim()

  if (!trimmedValue) {
    return null
  }

  const normalizedValue = trimmedValue.replace(/^departamento de\s+/i, '').trim()

  return normalizedValue.length > 0 ? normalizedValue : null
}

function getComponentNameByType(
  components: GooglePlaceAddressComponent[],
  type: string,
) {
  const component = components.find((entry) => entry.types?.includes(type))
  const longName = component?.long_name?.trim() ?? component?.longText?.trim()

  return longName ? longName : null
}

function getCoordinate(
  coordinate: (() => number) | number | null | undefined,
) {
  if (typeof coordinate === 'function') {
    return coordinate()
  }

  return typeof coordinate === 'number' ? coordinate : null
}

export function parseGooglePlaceResult(
  place: GooglePlaceResultLike,
): ParsedGooglePlaceAddress {
  const addressComponents =
    place.address_components ?? place.addressComponents ?? null
  const normalizedAddressComponents = addressComponents
    ? addressComponents.map((component) => ({
        long_name: component.long_name ?? component.longText ?? null,
        short_name: component.short_name ?? component.shortText ?? null,
        types: component.types ?? null,
      }))
    : null
  const geometryLocation = place.geometry?.location ?? place.location ?? null
  const lat = getCoordinate(geometryLocation?.lat)
  const lng = getCoordinate(geometryLocation?.lng)
  const departmentName = normalizedAddressComponents
    ? normalizeDepartmentName(
        getComponentNameByType(
          normalizedAddressComponents,
          'administrative_area_level_1',
        ),
      )
    : null
  const zoneName = normalizedAddressComponents
    ? ZONE_COMPONENT_PRIORITY.reduce<string | null>((currentValue, type) => {
        if (currentValue) {
          return currentValue
        }

        return getComponentNameByType(normalizedAddressComponents, type)
      }, null)
    : null

  return {
    google_place_id: place.place_id?.trim() || place.id?.trim() || null,
    formatted_address:
      place.formatted_address?.trim() ||
      place.formattedAddress?.trim() ||
      null,
    google_department_name: departmentName,
    google_zone_name: zoneName,
    address_components: normalizedAddressComponents,
    lat,
    lng,
  }
}
