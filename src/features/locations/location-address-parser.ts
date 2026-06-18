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

const ZONE_COMPONENT_PRIORITY = [
  'sublocality',
  'sublocality_level_1',
  'neighborhood',
  'locality',
] as const

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
    ? getComponentNameByType(
        normalizedAddressComponents,
        'administrative_area_level_1',
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
