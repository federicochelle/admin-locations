export type OrderedCategoryLocation = {
  id: string
  displayOrder?: number | null
}

function sortByDisplayOrder<T extends OrderedCategoryLocation>(locations: T[]) {
  return [...locations].sort((left, right) => {
    const leftOrder =
      typeof left.displayOrder === 'number' ? left.displayOrder : Number.MAX_SAFE_INTEGER
    const rightOrder =
      typeof right.displayOrder === 'number' ? right.displayOrder : Number.MAX_SAFE_INTEGER

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return left.id.localeCompare(right.id)
  })
}

export function renumberCategoryLocations<T extends OrderedCategoryLocation>(
  locations: T[],
): Array<T & { displayOrder: number }> {
  return locations.map((location, index) => ({
    ...location,
    displayOrder: index + 1,
  }))
}

export function moveCategoryLocationToDisplayOrder<T extends OrderedCategoryLocation>(
  locations: T[],
  locationId: string,
  nextDisplayOrder: number,
): Array<T & { displayOrder: number }> {
  const orderedLocations = renumberCategoryLocations(sortByDisplayOrder(locations))
  const currentIndex = orderedLocations.findIndex((location) => location.id === locationId)

  if (currentIndex === -1) {
    return orderedLocations
  }

  const clampedNextIndex = Math.min(
    Math.max(Math.trunc(nextDisplayOrder), 1),
    orderedLocations.length,
  ) - 1

  if (currentIndex === clampedNextIndex) {
    return orderedLocations
  }

  const [movedLocation] = orderedLocations.splice(currentIndex, 1)
  orderedLocations.splice(clampedNextIndex, 0, movedLocation)

  return renumberCategoryLocations(orderedLocations)
}

export function getCategoryLocationOrderIds(locations: OrderedCategoryLocation[]) {
  return sortByDisplayOrder(locations).map((location) => location.id)
}

export function hasCategoryLocationOrderChanges(
  currentLocations: OrderedCategoryLocation[],
  savedLocationIds: string[],
) {
  const currentLocationIds = getCategoryLocationOrderIds(currentLocations)

  if (currentLocationIds.length !== savedLocationIds.length) {
    return true
  }

  return currentLocationIds.some((locationId, index) => locationId !== savedLocationIds[index])
}
