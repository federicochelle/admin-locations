import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { harness, locationId } from '../observability/harness.mjs'

function functionsFetchError() {
  const error = new Error('Failed to send a request to the Edge Function')
  error.name = 'FunctionsFetchError'

  return error
}

function functionsHttpError(status = 403) {
  const error = new Error('Forbidden')
  error.name = 'FunctionsHttpError'
  error.context = new Response(JSON.stringify({ error: 'Forbidden' }), { status })

  return error
}

async function loadLocationsService(options) {
  const h = await harness(options)
  const service = await h.module('src/features/locations/locations.service')

  return { h, service }
}

test('deleteLocation returns the deleted id on normal Edge success', async () => {
  const { h, service } = await loadLocationsService({
    invoke: async (name, options) => {
      assert.equal(name, 'location-delete')
      assert.deepEqual(JSON.parse(JSON.stringify(options.body)), { locationId })

      return {
        data: {
          success: true,
          deletedLocationId: locationId,
          deletedImagesCount: 2,
        },
        error: null,
      }
    },
  })

  assert.equal(await service.deleteLocation(locationId), locationId)
  assert.equal(h.requests.filter((request) => request.name === 'location-delete').length, 1)
  assert.equal(h.requests.some((request) => request.table === 'locations'), false)
})

test('deleteLocation treats alreadyDeleted Edge success as idempotent success', async () => {
  const { h, service } = await loadLocationsService({
    invoke: async () => ({
      data: {
        success: true,
        alreadyDeleted: true,
        deletedLocationId: locationId,
        deletedImagesCount: 0,
      },
      error: null,
    }),
  })

  assert.equal(await service.deleteLocation(locationId), locationId)
  assert.equal(h.requests.filter((request) => request.name === 'location-delete').length, 1)
  assert.equal(h.requests.some((request) => request.table === 'locations'), false)
})

test('deleteLocation reconciles FunctionsFetchError as success when the location no longer exists', async () => {
  const { h, service } = await loadLocationsService({
    invoke: async () => ({
      data: null,
      error: functionsFetchError(),
    }),
    query: (call) => {
      if (call.table === 'locations') {
        return { data: null, error: null }
      }

      return { data: [], error: null }
    },
  })

  assert.equal(await service.deleteLocation(locationId), locationId)
  assert.equal(h.requests.filter((request) => request.name === 'location-delete').length, 1)
  assert.equal(h.requests.filter((request) => request.table === 'locations').length, 1)
})

test('deleteLocation surfaces a friendly retry error when transport fails and the location still exists', async () => {
  const { h, service } = await loadLocationsService({
    invoke: async () => ({
      data: null,
      error: functionsFetchError(),
    }),
    query: (call) => {
      if (call.table === 'locations') {
        return { data: { id: locationId }, error: null }
      }

      return { data: [], error: null }
    },
  })

  await assert.rejects(
    service.deleteLocation(locationId),
    /No pudimos confirmar la eliminación\. Intentá nuevamente\./,
  )
  assert.equal(h.requests.filter((request) => request.name === 'location-delete').length, 1)
  assert.equal(h.requests.filter((request) => request.table === 'locations').length, 1)
})

test('deleteLocation does not reconcile auth or permission Edge errors as success', async () => {
  const { h, service } = await loadLocationsService({
    invoke: async () => ({
      data: null,
      error: functionsHttpError(403),
    }),
    query: () => {
      throw new Error('Unexpected reconciliation query')
    },
  })

  await assert.rejects(service.deleteLocation(locationId))
  assert.equal(h.requests.filter((request) => request.name === 'location-delete').length, 1)
  assert.equal(h.requests.some((request) => request.table === 'locations'), false)
})

test('location-delete Edge Function declares an idempotent already-deleted success path', async () => {
  const source = await fs.readFile('supabase/functions/location-delete/index.ts', 'utf8')

  assert.equal(source.includes("from('../_shared/locations.ts')"), false)
  assert.match(source, /maybeSingle\(\)/)
  assert.match(source, /alreadyDeleted:\s*true/)
  assert.match(source, /deletedImagesCount:\s*0/)
})
