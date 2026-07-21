export const PUBLIC_LOCATION_RADIUS_METERS = 700

const EARTH_RADIUS_METERS = 6_378_137
const MIN_OFFSET_METERS = 400
const MAX_OFFSET_METERS = 700
const COORDINATE_EPSILON = 1e-9

export type PublicLocationCoordinates = {
  lat: number
  lng: number
  radius: number
}

type PublicLocationCoordinatesResolverParams = {
  lat: number | null
  lng: number | null
  currentPublicLat?: number | null
  currentPublicLng?: number | null
  previousLat?: number | null
  previousLng?: number | null
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isValidLatitude(value: number | null | undefined) {
  return isFiniteNumber(value) && value >= -90 && value <= 90
}

export function isValidLongitude(value: number | null | undefined) {
  return isFiniteNumber(value) && value >= -180 && value <= 180
}

export function isValidCoordinatePair(
  lat: number | null | undefined,
  lng: number | null | undefined,
) {
  return isValidLatitude(lat) && isValidLongitude(lng)
}

function areCoordinatesEqual(
  first: number | null | undefined,
  second: number | null | undefined,
) {
  if (!isFiniteNumber(first) || !isFiniteNumber(second)) {
    return first == null && second == null
  }

  return Math.abs(first - second) <= COORDINATE_EPSILON
}

function getRandomOffsetDistanceMeters() {
  return (
    MIN_OFFSET_METERS +
    Math.random() * (MAX_OFFSET_METERS - MIN_OFFSET_METERS)
  )
}

export function generateOffsetCoordinates(
  lat: number | null,
  lng: number | null,
): PublicLocationCoordinates | null {
  if (!isValidCoordinatePair(lat, lng)) {
    return null
  }

  const originLat = lat as number
  const originLng = lng as number

  const angleRadians = Math.random() * Math.PI * 2
  const distanceMeters = getRandomOffsetDistanceMeters()
  const northOffsetMeters = Math.cos(angleRadians) * distanceMeters
  const eastOffsetMeters = Math.sin(angleRadians) * distanceMeters
  const latitudeRadians = (originLat * Math.PI) / 180
  const deltaLatDegrees = (northOffsetMeters / EARTH_RADIUS_METERS) * (180 / Math.PI)
  const cosineLatitude = Math.cos(latitudeRadians)

  if (Math.abs(cosineLatitude) < Number.EPSILON) {
    return null
  }

  const deltaLngDegrees =
    (eastOffsetMeters / (EARTH_RADIUS_METERS * cosineLatitude)) * (180 / Math.PI)
  const nextLat = originLat + deltaLatDegrees
  const nextLng = originLng + deltaLngDegrees

  if (!isValidCoordinatePair(nextLat, nextLng)) {
    return null
  }

  return {
    lat: nextLat,
    lng: nextLng,
    radius: PUBLIC_LOCATION_RADIUS_METERS,
  }
}

export function resolvePublicLocationCoordinates({
  lat,
  lng,
  currentPublicLat = null,
  currentPublicLng = null,
  previousLat = null,
  previousLng = null,
}: PublicLocationCoordinatesResolverParams): PublicLocationCoordinates | null {
  if (!isValidCoordinatePair(lat, lng)) {
    return null
  }

  const originLat = lat as number
  const originLng = lng as number

  const coordinatesChanged =
    !areCoordinatesEqual(originLat, previousLat) ||
    !areCoordinatesEqual(originLng, previousLng)
  const hasValidCurrentPublicCoordinates = isValidCoordinatePair(
    currentPublicLat,
    currentPublicLng,
  )

  if (!coordinatesChanged && hasValidCurrentPublicCoordinates) {
    return {
      lat: currentPublicLat as number,
      lng: currentPublicLng as number,
      radius: PUBLIC_LOCATION_RADIUS_METERS,
    }
  }

  return generateOffsetCoordinates(originLat, originLng)
}
