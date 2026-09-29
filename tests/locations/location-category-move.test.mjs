import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { harness, locationId } from '../observability/harness.mjs'

const migrationPath =
  'supabase/migrations/20260929133000_add_move_location_to_category_rpc.sql'

const nextCategoryId = '44444444-4444-4444-8444-444444444444'

function updatePayload(overrides = {}) {
  return {
    title: ' Casa editada ',
    slug: 'casa-editada',
    description: null,
    category_id: nextCategoryId,
    department_id: null,
    zone_id: null,
    owner_id: null,
    status: 'published',
    published: true,
    premium: false,
    featured: false,
    visibility_level: 'public',
    address_private: null,
    address_public: null,
    google_place_id: null,
    formatted_address: null,
    google_department_name: null,
    google_zone_name: null,
    address_components: null,
    lat: null,
    lng: null,
    approx_lat: null,
    approx_lng: null,
    show_exact_location: false,
    map_visibility: 'public',
    selectedFeatureIds: [],
    selectedTagIds: [],
    ...overrides,
  }
}

async function migrationSql() {
  return readFile(migrationPath, 'utf8')
}

function moveFunctionBody(sql) {
  return sql.slice(
    sql.indexOf('create or replace function public.move_location_to_category('),
    sql.indexOf('revoke all on function public.move_location_to_category'),
  )
}

test('move category migration exposes an RPC and keeps category renumbering in SQL', async () => {
  const sql = await migrationSql()

  assert.match(sql, /create or replace function public\.move_location_to_category\(/)
  assert.match(sql, /create or replace function public\.apply_location_category_order\(/)
  assert.match(sql, /grant execute on function public\.move_location_to_category\(uuid, uuid\) to authenticated;/)
  assert.match(sql, /public\.get_location_code_prefix\(v_old_category_id\)/)
  assert.match(sql, /public\.get_location_code_prefix\(v_new_category_id\)/)
  assert.match(sql, /pg_advisory_xact_lock\(v_lock_key\)/)
  assert.match(sql, /order by lock_key/)
  assert.match(sql, /for update;/)
})

test('move category migration takes advisory locks before row locks', async () => {
  const sql = await migrationSql()
  const body = moveFunctionBody(sql)
  const firstForUpdateIndex = body.indexOf('for update;')
  const advisoryLockIndex = body.indexOf('pg_advisory_xact_lock(v_lock_key)')
  const unlockedReadIndex = body.indexOf('select l.category_id')

  assert.notEqual(unlockedReadIndex, -1)
  assert.notEqual(advisoryLockIndex, -1)
  assert.notEqual(firstForUpdateIndex, -1)
  assert.equal(unlockedReadIndex < advisoryLockIndex, true)
  assert.equal(advisoryLockIndex < firstForUpdateIndex, true)
})

test('move category migration aborts when the observed old category changes before row lock', async () => {
  const sql = await migrationSql()
  const body = moveFunctionBody(sql)

  assert.match(body, /v_locked_old_category_id uuid;/)
  assert.match(body, /if v_locked_old_category_id is distinct from v_old_category_id then/)
  assert.match(body, /La categoria de la locacion cambio concurrentemente\. Intentá guardar nuevamente\./)
  assert.match(body, /using errcode = '40001';/)
})

test('move category migration keeps the helper inaccessible from API roles', async () => {
  const sql = await migrationSql()

  assert.match(sql, /revoke all on function public\.apply_location_category_order\(uuid, uuid\[\], text\) from public;/)
  assert.match(sql, /revoke all on function public\.apply_location_category_order\(uuid, uuid\[\], text\) from anon;/)
  assert.match(sql, /revoke all on function public\.apply_location_category_order\(uuid, uuid\[\], text\) from authenticated;/)
})

test('move category migration keeps only the public RPCs executable by authenticated', async () => {
  const sql = await migrationSql()

  assert.match(sql, /if not public\.is_admin\(\) then[\s\S]*?Solo los administradores pueden actualizar el orden de locaciones\./)
  assert.match(sql, /if not public\.is_admin\(\) then[\s\S]*?Solo los administradores pueden cambiar la categoria de una locacion\./)
  assert.match(sql, /grant execute on function public\.update_category_location_display_order\(uuid, uuid\[\]\) to authenticated;/)
  assert.match(sql, /grant execute on function public\.move_location_to_category\(uuid, uuid\) to authenticated;/)
})

test('move category helper rejects null and duplicate UUIDs before updates', async () => {
  const sql = await migrationSql()
  const helperBody = sql.slice(
    sql.indexOf('create or replace function public.apply_location_category_order('),
    sql.indexOf('revoke all on function public.apply_location_category_order'),
  )

  assert.match(helperBody, /count\(distinct input_locations\.location_id\)/)
  assert.match(helperBody, /El orden de locaciones contiene IDs duplicados\./)
  assert.match(helperBody, /where input_locations\.location_id is null/)
  assert.match(helperBody, /El orden de locaciones contiene IDs invalidos\./)
  assert.equal(
    helperBody.indexOf('El orden de locaciones contiene IDs duplicados.') <
      helperBody.indexOf('update public.locations as locations'),
    true,
  )
  assert.equal(
    helperBody.indexOf('El orden de locaciones contiene IDs invalidos.') <
      helperBody.indexOf('update public.locations as locations'),
    true,
  )
})

test('move category migration uses temporary codes before final compact codes', async () => {
  const sql = await migrationSql()

  assert.match(sql, /set location_code = '__REORDER__:' \|\| txid_current\(\)::text \|\| ':' \|\| locations\.id::text/)
  assert.match(sql, /display_order = ordered_locations\.next_display_order,\s+location_code = ordered_locations\.next_location_code/)
  assert.match(sql, /when input_locations\.ordinality < 1000 then lpad\(input_locations\.ordinality::text, 3, '0'\)/)
})

test('move category migration defines no-op, category to null, and null to category paths', async () => {
  const sql = await migrationSql()

  assert.match(sql, /if v_old_category_id is not distinct from v_new_category_id then/)
  assert.match(sql, /if p_category_id is null then/)
  assert.match(sql, /where l\.category_id is null/)
  assert.match(sql, /where l\.category_id = v_new_category_id/)
})

test('updateLocation delegates category changes to move_location_to_category RPC', async () => {
  const calls = []
  const h = await harness({
    query: async (call) => {
      calls.push(call)

      if (call.table === 'locations' && call.method === 'select') {
        if (calls.filter((entry) => entry.table === 'locations' && entry.method === 'select').length === 1) {
          return { data: [], error: null }
        }

        return {
          data: {
            category_id: '33333333-3333-4333-8333-333333333333',
            location_code: 'CASA-002',
          },
          error: null,
        }
      }

      if (call.table === 'locations' && call.method === 'update') {
        assert.equal(Object.hasOwn(call.payload, 'category_id'), false)
        assert.equal(Object.hasOwn(call.payload, 'location_code'), false)
        assert.equal(call.payload.title, 'Casa editada')

        return {
          data: {
            id: locationId,
            location_code: 'CASA-002',
          },
          error: null,
        }
      }

      if (call.table === 'location_features' || call.table === 'location_tags') {
        return { data: null, error: null }
      }

      throw new Error(`Unexpected query: ${call.table}.${call.method}`)
    },
    rpc: async (call) => {
      calls.push(call)
      assert.equal(call.fn, 'move_location_to_category')
      assert.deepEqual(JSON.parse(JSON.stringify(call.args)), {
        p_location_id: locationId,
        p_category_id: nextCategoryId,
      })

      return {
        data: [{
          location_id: locationId,
          category_id: nextCategoryId,
          display_order: 3,
          location_code: 'CHACRA-003',
        }],
        error: null,
      }
    },
  })
  const service = await h.module('src/features/locations/locations.service')

  const updatedLocationId = await service.updateLocation(locationId, updatePayload())

  assert.equal(updatedLocationId, locationId)
  assert.equal(
    calls.some((call) => call.fn === 'move_location_to_category'),
    true,
  )
})
