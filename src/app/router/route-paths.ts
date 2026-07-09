export const routePaths = {
  login: '/login',
  dashboard: '/dashboard',
  locations: '/locations',
  locationNew: '/locations/new',
  locationDetailPattern: '/locations/:id',
  locationEditPattern: '/locations/:id/edit',
  owners: '/owners',
  ownerNew: '/owners/new',
  ownerEditPattern: '/owners/:id/edit',
  categories: '/categories',
  categoryNew: '/categories/new',
  categoryEditPattern: '/categories/:id/edit',
  activity: '/activity',
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
