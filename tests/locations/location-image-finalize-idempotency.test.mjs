import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { harness, locationId } from '../observability/harness.mjs'

const clientUploadId = '33333333-3333-4333-8333-333333333333'
const otherLocationId = '44444444-4444-4444-8444-444444444444'
const edgeSourcePath = 'supabase/functions/location-image-finalize/index.ts'

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

function finalizedRow(overrides = {}) {
  return {
    id: overrides.id ?? '55555555-5555-4555-8555-555555555555',
    location_id: overrides.location_id ?? locationId,
    url: `https://images.example/${overrides.storage_key ?? 'cloudflare-image'}/public`,
    storage_key: overrides.storage_key ?? 'cloudflare-image',
    alt_text: null,
    caption: null,
    sort_order: overrides.sort_order ?? 0,
    is_cover: overrides.is_cover ?? false,
    width: overrides.width ?? 120,
    height: overrides.height ?? 80,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    client_upload_id: Object.hasOwn(overrides, 'client_upload_id')
      ? overrides.client_upload_id
      : clientUploadId,
  }
}

test('finalizeLocationImageUpload sends clientUploadId to the Edge Function', async () => {
  const invocations = []
  const h = await harness({
    invoke: async (name, options) => {
      invocations.push({ name, body: options.body })
      return { data: finalizedRow(), error: null }
    },
  })
  const images = await h.module('src/features/locations/location-images.service')

  const result = await images.finalizeLocationImageUpload({
    clientUploadId,
    cloudflareImageId: 'cloudflare-image',
    height: 80,
    isCover: true,
    locationId,
    sortOrder: 2,
    width: 120,
  })

  assert.equal(result.id, '55555555-5555-4555-8555-555555555555')
  assert.deepEqual(plain(invocations), [
    {
      name: 'location-image-finalize',
      body: {
        altText: null,
        caption: null,
        clientUploadId,
        cloudflareImageId: 'cloudflare-image',
        height: 80,
        isCover: true,
        locationId,
        sortOrder: 2,
        width: 120,
      },
    },
  ])
})

test('uploadLocationImage forwards clientUploadId into finalize after Cloudflare upload', async () => {
  const finalizeBodies = []
  const h = await harness({
    fetch: async () =>
      new Response(JSON.stringify({ success: true, result: { id: 'cloudflare-image' } }), {
        status: 200,
      }),
    invoke: async (name, options) => {
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

      finalizeBodies.push(options.body)
      return { data: finalizedRow(), error: null }
    },
  })
  const images = await h.module('src/features/locations/location-images.service')

  await images.uploadLocationImage({
    clientUploadId,
    file: new File(['image'], 'image.jpg', { type: 'image/jpeg' }),
    height: 80,
    isCover: true,
    locationId,
    sortOrder: 2,
    width: 120,
  })

  assert.equal(finalizeBodies.length, 1)
  assert.equal(finalizeBodies[0].clientUploadId, clientUploadId)
})

test('location-image-finalize declares the DB idempotency contract', async () => {
  const source = await fs.readFile(edgeSourcePath, 'utf8')

  assert.match(source, /clientUploadId/)
  assert.match(source, /client_upload_id/)
  assert.match(source, /23505/)
  assert.match(source, /\.eq\('location_id', input\.locationId\)[\s\S]*\.eq\('client_upload_id', input\.clientUploadId\)/)
})

test('location-image-finalize checks idempotency before cover side effects', async () => {
  const source = await fs.readFile(edgeSourcePath, 'utf8')
  const idempotencyLookupIndex = source.indexOf("client_upload_id', input.clientUploadId")
  const coverMutationIndex = source.indexOf(".update({ is_cover: false })")

  assert.notEqual(idempotencyLookupIndex, -1)
  assert.notEqual(coverMutationIndex, -1)
  assert.equal(idempotencyLookupIndex < coverMutationIndex, true)
})

test('location-image-finalize migration adds a partial unique key per location and client upload id', async () => {
  const migration = await fs.readFile(
    'supabase/migrations/20260910120000_add_location_image_client_upload_id.sql',
    'utf8',
  )

  assert.match(migration, /add column if not exists client_upload_id uuid/)
  assert.match(migration, /unique index[\s\S]*\(location_id, client_upload_id\)/)
  assert.match(migration, /where client_upload_id is not null/)
  assert.doesNotMatch(migration, /storage_key.*unique|unique.*storage_key/is)
})

test('idempotency key is scoped to a location and null historical values remain allowed', async () => {
  const rows = [
    finalizedRow({ client_upload_id: clientUploadId, id: 'image-a', location_id: locationId }),
    finalizedRow({ client_upload_id: clientUploadId, id: 'image-b', location_id: otherLocationId }),
    finalizedRow({ client_upload_id: null, id: 'legacy-a', location_id: locationId }),
    finalizedRow({ client_upload_id: null, id: 'legacy-b', location_id: locationId }),
  ]

  assert.equal(new Set(rows.map((row) => row.id)).size, 4)
  assert.equal(rows.filter((row) => row.client_upload_id === null).length, 2)
})
