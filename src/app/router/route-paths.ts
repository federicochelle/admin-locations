export const routePaths = {
  login: '/login',
  dashboard: '/dashboard',
  locations: '/locations',
  locationNew: '/locations/new',
  locationDetailPattern: '/locations/:id',
  locationEditPattern: '/locations/:id/edit',
  owners: '/owners',
  ownerNew: '/owners/new',
  ownerDetailPattern: '/owners/:id',
  ownerEditPattern: '/owners/:id/edit',
  categories: '/categories',
  categoryNew: '/categories/new',
  categoryEditPattern: '/categories/:id/edit',
  activity: '/activity',
  reservations: '/reservations',
  reservationDayPattern: '/reservations/day/:date',
  reservationDetailPattern: '/reservations/:reservationId',
  requests: '/requests',
  requestDetailPattern: '/requests/:id',
  proposals: '/proposals',
  proposalDetailPattern: '/proposals/:id',
  features: '/features',
  featureNew: '/features/new',
  featureEditPattern: '/features/:id/edit',
  settings: '/settings',
} as const

export function getLocationDetailPath(id: string) {
  return `/locations/${id}`
}

export function getLocationEditPath(id: string) {
  return `/locations/${id}/edit`
}

export function getOwnerEditPath(id: string) {
  return `/owners/${id}/edit`
}

export function getOwnerDetailPath(id: string) {
  return `/owners/${id}`
}

export function getCategoryEditPath(id: string) {
  return `/categories/${id}/edit`
}

export function getFeatureEditPath(id: string) {
  return `/features/${id}/edit`
}

export function getProposalDetailPath(id: string) {
  return `/proposals/${id}`
}

export function getRequestDetailPath(id: string) {
  return `/requests/${id}`
}

export function getReservationDayPath(date: string) {
  return `/reservations/day/${date}`
}

export function getReservationDetailPath(reservationId: string) {
  return `/reservations/${reservationId}`
}
