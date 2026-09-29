import assert from 'node:assert/strict'
import test from 'node:test'
import { harness } from '../observability/harness.mjs'

async function loadOrderHelpers() {
  const h = await harness()
  return h.module('src/features/categories/category-location-order')
}

function ids(locations) {
  return locations.map((location) => location.id)
}

function displayOrders(locations) {
  return locations.map((location) => location.displayOrder)
}

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

function orderedLocations() {
  return [
    { id: 'location-1', displayOrder: 1 },
    { id: 'location-2', displayOrder: 2 },
    { id: 'location-3', displayOrder: 3 },
    { id: 'location-4', displayOrder: 4 },
    { id: 'location-5', displayOrder: 5 },
  ]
}

test('moveCategoryLocationToDisplayOrder moves position 5 to 2 and shifts the middle rows', async () => {
  const { moveCategoryLocationToDisplayOrder } = await loadOrderHelpers()

  const nextLocations = moveCategoryLocationToDisplayOrder(
    orderedLocations(),
    'location-5',
    2,
  )

  assert.deepEqual(plain(ids(nextLocations)), [
    'location-1',
    'location-5',
    'location-2',
    'location-3',
    'location-4',
  ])
})

test('moveCategoryLocationToDisplayOrder moves position 25 to 2 and preserves all ids', async () => {
  const { moveCategoryLocationToDisplayOrder } = await loadOrderHelpers()
  const locations = Array.from({ length: 25 }, (_, index) => ({
    id: `location-${index + 1}`,
    displayOrder: index + 1,
  }))

  const nextLocations = moveCategoryLocationToDisplayOrder(
    locations,
    'location-25',
    2,
  )

  assert.deepEqual(plain(ids(nextLocations).slice(0, 5)), [
    'location-1',
    'location-25',
    'location-2',
    'location-3',
    'location-4',
  ])
  assert.equal(new Set(ids(nextLocations)).size, 25)
  assert.deepEqual(plain(displayOrders(nextLocations)), Array.from(
    { length: 25 },
    (_, index) => index + 1,
  ))
})

test('moveCategoryLocationToDisplayOrder moves position 2 to 5 and shifts the middle rows', async () => {
  const { moveCategoryLocationToDisplayOrder } = await loadOrderHelpers()

  const nextLocations = moveCategoryLocationToDisplayOrder(
    orderedLocations(),
    'location-2',
    5,
  )

  assert.deepEqual(plain(ids(nextLocations)), [
    'location-1',
    'location-3',
    'location-4',
    'location-5',
    'location-2',
  ])
})

test('moveCategoryLocationToDisplayOrder keeps the same order when position does not change', async () => {
  const { moveCategoryLocationToDisplayOrder } = await loadOrderHelpers()

  const nextLocations = moveCategoryLocationToDisplayOrder(
    orderedLocations(),
    'location-3',
    3,
  )

  assert.deepEqual(plain(ids(nextLocations)), ids(orderedLocations()))
})

test('moveCategoryLocationToDisplayOrder does not generate duplicate display orders', async () => {
  const { moveCategoryLocationToDisplayOrder } = await loadOrderHelpers()

  const nextLocations = moveCategoryLocationToDisplayOrder(
    orderedLocations(),
    'location-5',
    2,
  )
  const uniqueDisplayOrders = new Set(displayOrders(nextLocations))

  assert.equal(uniqueDisplayOrders.size, nextLocations.length)
})

test('moveCategoryLocationToDisplayOrder always returns a 1..N sequence', async () => {
  const { moveCategoryLocationToDisplayOrder } = await loadOrderHelpers()

  const nextLocations = moveCategoryLocationToDisplayOrder(
    orderedLocations(),
    'location-5',
    2,
  )

  assert.deepEqual(plain(displayOrders(nextLocations)), [1, 2, 3, 4, 5])
})

test('getCategoryLocationOrderIds uses the full local order, not a filtered visible subset', async () => {
  const { getCategoryLocationOrderIds } = await loadOrderHelpers()
  const fullLocations = orderedLocations()
  const visibleFilteredRows = fullLocations.filter((location) =>
    ['location-1', 'location-5'].includes(location.id),
  )

  assert.deepEqual(ids(visibleFilteredRows), ['location-1', 'location-5'])
  assert.deepEqual(plain(getCategoryLocationOrderIds(fullLocations)), [
    'location-1',
    'location-2',
    'location-3',
    'location-4',
    'location-5',
  ])
})

test('persist error can preserve the local reordered state for a later manual retry', async () => {
  const { moveCategoryLocationToDisplayOrder, getCategoryLocationOrderIds } =
    await loadOrderHelpers()
  const localLocations = moveCategoryLocationToDisplayOrder(
    orderedLocations(),
    'location-5',
    2,
  )

  await assert.rejects(
    async () => {
      throw new Error('No pudimos guardar el orden.')
    },
    /No pudimos guardar el orden/,
  )

  assert.deepEqual(plain(getCategoryLocationOrderIds(localLocations)), [
    'location-1',
    'location-5',
    'location-2',
    'location-3',
    'location-4',
  ])
})
