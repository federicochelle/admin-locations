import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { correlationId, harness, locationId } from './harness.mjs'

const headerName = 'x-admin-correlation-id'

test('admin correlation helper returns only the optional header', async () => {
  const h = await harness()
  const correlation = await h.module('src/lib/admin-correlation')

  assert.equal(Object.keys(correlation.getAdminCorrelationHeaders()).length, 0)
  assert.equal(
    correlation.getAdminCorrelationHeaders(correlationId)[headerName],
    correlationId,
  )
})

test('image upload sends the same correlation header to Edge Functions but not Cloudflare', async () => {
  const cloudflareFetches = []
  const h = await harness({
    fetch: async (url, init = {}) => {
      cloudflareFetches.push({ headers: init.headers, url })
      return new Response(JSON.stringify({ success: true, result: { id: 'cloudflare-image' } }), {
        status: 200,
      })
    },
    invoke: async (name) => {
      if (name === 'location-image-upload-url') {
        return {
          data: {
            cloudflare: null,
            imageId: 'cloudflare-image',
            uploadURL: 'https://upload.example/direct',
          },
          error: null,
        }
      }

      return {
        data: {
          id: '55555555-5555-4555-8555-555555555555',
          location_id: locationId,
          url: 'https://images.example/cloudflare-image/public',
          storage_key: 'cloudflare-image',
          alt_text: null,
          caption: null,
          sort_order: 0,
          is_cover: false,
          width: 120,
          height: 80,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          client_upload_id: '33333333-3333-4333-8333-333333333333',
        },
        error: null,
      }
    },
  })
  const images = await h.module('src/features/locations/location-images.service')

  await images.uploadLocationImage({
    clientUploadId: '33333333-3333-4333-8333-333333333333',
    correlationId,
    file: new File(['image'], 'image.jpg', { type: 'image/jpeg' }),
    height: 80,
    locationId,
    width: 120,
  })

  const edgeRequests = h.requests.filter((request) => request.name?.startsWith('location-image-'))
  assert.equal(edgeRequests.length, 2)
  assert.equal(edgeRequests[0].options.headers[headerName], correlationId)
  assert.equal(edgeRequests[1].options.headers[headerName], correlationId)
  assert.equal(cloudflareFetches.length, 1)
  assert.equal(cloudflareFetches[0].headers?.[headerName], undefined)
})

test('detect sensitive content sends correlation header with FormData', async () => {
  const h = await harness({
    actualSensitiveContent: true,
    invoke: async (_name, options) => {
      assert.equal(options.headers[headerName], correlationId)
      assert.equal(options.body.constructor.name, 'FormData')
      return { data: { summary: { faces: 0 }, faces: [] }, error: null }
    },
  })
  const sensitive = await h.module('src/features/locations/location-sensitive-content.service')

  await sensitive.detectLocationImageSensitiveContent(
    new File(['image'], 'image.jpg', { type: 'image/jpeg' }),
    undefined,
    correlationId,
  )
})

test('delete location sends correlation header and keeps reconciliation compatible', async () => {
  const fetchError = new Error('Failed to send a request to the Edge Function')
  fetchError.name = 'FunctionsFetchError'
  const h = await harness({
    invoke: async () => ({ data: null, error: fetchError }),
    query: (call) => call.table === 'locations'
      ? { data: null, error: null }
      : { data: [], error: null },
  })
  const locations = await h.module('src/features/locations/locations.service')

  assert.equal(await locations.deleteLocation(locationId, { correlationId }), locationId)
  const deleteRequest = h.requests.find((request) => request.name === 'location-delete')
  assert.equal(deleteRequest.options.headers[headerName], correlationId)
  assert.equal(h.requests.filter((request) => request.table === 'locations').length, 1)
})

test('useLocations delete reporting and Edge invoke share the same correlation ID', async () => {
  const h = await harness({
    invoke: async () => ({ data: null, error: new Error('Edge failed') }),
  })
  const hooks = await h.module('src/features/locations/useLocations')

  await hooks.useLocations().remove(locationId, correlationId)

  const deleteRequest = h.requests.find((request) => request.name === 'location-delete')
  assert.equal(deleteRequest.options.headers[headerName], correlationId)
  assert.equal(h.events[0].scope.contexts.admin_operation.correlation_id, correlationId)
})

test('Edge shared CORS and correlation helper are optional and UUID-gated', async () => {
  const source = await fs.readFile('supabase/functions/_shared/http.ts', 'utf8')

  assert.match(source, /x-admin-correlation-id/)
  assert.match(source, /Access-Control-Allow-Headers[\s\S]*ADMIN_CORRELATION_ID_HEADER/)
  assert.match(source, /export function getAdminCorrelationId\(request: Request\)/)
  assert.match(source, /UUID_PATTERN\.test\(correlationId\)/)
  assert.match(source, /: undefined/)
})

test('audited Edge Functions read, log and return safe correlation IDs', async () => {
  for (const [path, event] of [
    ['supabase/functions/location-image-upload-url/index.ts', 'location-image-upload-url.error'],
    ['supabase/functions/location-image-finalize/index.ts', 'location-image-finalize.error'],
    ['supabase/functions/location-delete/index.ts', 'location-delete.error'],
    ['supabase/functions/location-image-detect-sensitive-content/index.ts', 'location-image-detect-sensitive-content.error'],
  ]) {
    const source = await fs.readFile(path, 'utf8')

    assert.match(source, /getAdminCorrelationId\(request\)/, path)
    assert.match(source, new RegExp(`event:\\s*'${event}'`), path)
    assert.match(source, /correlationId/, path)
    assert.match(source, /errorResponse\(error, origin, correlationId\)/, path)
    assert.equal(/console\.error\([\s\S]*(Authorization|uploadURL|request\.body|formData|fileBytes)/.test(source), false, path)
  }
})
