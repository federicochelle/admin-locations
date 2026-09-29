import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { harness, locationId } from '../observability/harness.mjs'

const clientUploadId = '33333333-3333-4333-8333-333333333333'
const otherLocationId = '44444444-4444-4444-8444-444444444444'
const edgeSourcePath = 'supabase/functions/location-image-finalize/index.ts'
const finalizeMigrationPath = 'supabase/migrations/20260923120000_add_finalize_location_image_rpc.sql'

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

test('location-image-finalize delegates metadata writes to the transactional RPC', async () => {
  const source = await fs.readFile(edgeSourcePath, 'utf8')

  assert.match(source, /\.rpc\('finalize_location_image'/)
  assert.match(source, /p_client_upload_id: input\.clientUploadId/)
  assert.match(source, /p_is_cover: isCover/)
  assert.match(source, /p_location_id: input\.locationId/)
  assert.match(source, /p_storage_key: input\.cloudflareImageId/)
  assert.match(source, /p_url: buildCloudflarePublicUrl\(input\.cloudflareImageId\)/)
  assert.doesNotMatch(source, /\.update\(\{ is_cover: false \}\)/)
  assert.doesNotMatch(source, /\.from\('location_images'\)[\s\S]*\.insert\(/)
})

test('finalize_location_image RPC exposes the expected insert signature', async () => {
  const migration = await fs.readFile(finalizeMigrationPath, 'utf8')

  assert.match(migration, /create or replace function public\.finalize_location_image\(/)
  assert.match(migration, /p_location_id uuid/)
  assert.match(migration, /p_client_upload_id uuid/)
  assert.match(migration, /p_url text/)
  assert.match(migration, /p_storage_key text/)
  assert.match(migration, /p_alt_text text/)
  assert.match(migration, /p_caption text/)
  assert.match(migration, /p_sort_order integer/)
  assert.match(migration, /p_is_cover boolean/)
  assert.match(migration, /p_width integer/)
  assert.match(migration, /p_height integer/)
  assert.match(migration, /returns table \([\s\S]*client_upload_id uuid[\s\S]*is_cover boolean[\s\S]*updated_at timestamptz/)
})

test('finalize_location_image inserts the same image metadata as the Edge Function used to insert', async () => {
  const migration = await fs.readFile(finalizeMigrationPath, 'utf8')

  assert.match(migration, /insert into public\.location_images \([\s\S]*alt_text,[\s\S]*caption,[\s\S]*client_upload_id,[\s\S]*height,[\s\S]*is_cover,[\s\S]*location_id,[\s\S]*sort_order,[\s\S]*storage_key,[\s\S]*url,[\s\S]*width[\s\S]*\)/)
  assert.match(migration, /values \([\s\S]*p_alt_text,[\s\S]*p_caption,[\s\S]*p_client_upload_id,[\s\S]*p_height,[\s\S]*p_is_cover,[\s\S]*p_location_id,[\s\S]*p_sort_order,[\s\S]*p_storage_key,[\s\S]*p_url,[\s\S]*p_width[\s\S]*\)/)
})

test('finalize_location_image checks idempotency before cover side effects', async () => {
  const migration = await fs.readFile(finalizeMigrationPath, 'utf8')
  const idempotencyLookupIndex = migration.indexOf('and li.client_upload_id = p_client_upload_id')
  const coverMutationIndex = migration.indexOf('set is_cover = false')

  assert.notEqual(idempotencyLookupIndex, -1)
  assert.notEqual(coverMutationIndex, -1)
  assert.equal(idempotencyLookupIndex < coverMutationIndex, true)
})

test('finalize_location_image leaves non-cover writes as plain inserts', async () => {
  const migration = await fs.readFile(finalizeMigrationPath, 'utf8')

  assert.match(migration, /if p_is_cover = true then[\s\S]*set is_cover = false[\s\S]*end if;/)
  assert.match(migration, /where p_is_cover = true[\s\S]*set cover_image_id = created_image\.id|set cover_image_id = created_image\.id[\s\S]*where p_is_cover = true/)
})

test('finalize_location_image synchronizes cover rows and locations.cover_image_id together', async () => {
  const migration = await fs.readFile(finalizeMigrationPath, 'utf8')

  assert.match(migration, /if p_is_cover = true then[\s\S]*for update[\s\S]*update public\.location_images li[\s\S]*set is_cover = false/)
  assert.match(migration, /insert into public\.location_images[\s\S]*p_is_cover[\s\S]*returning[\s\S]*created_image/)
  assert.match(migration, /update public\.locations l[\s\S]*set cover_image_id = created_image\.id[\s\S]*where p_is_cover = true/)
})

test('finalize_location_image rolls back cover clearing when insert hits idempotency race', async () => {
  const migration = await fs.readFile(finalizeMigrationPath, 'utf8')

  assert.match(migration, /begin[\s\S]*if p_is_cover = true then[\s\S]*set is_cover = false[\s\S]*insert into public\.location_images[\s\S]*exception[\s\S]*when unique_violation then/)
  assert.match(migration, /when unique_violation then[\s\S]*where li\.location_id = p_location_id[\s\S]*and li\.client_upload_id = p_client_upload_id/)
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
