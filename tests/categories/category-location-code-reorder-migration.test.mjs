import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath =
  'supabase/migrations/20260929130000_renumber_location_codes_on_category_reorder.sql'

async function migrationSql() {
  return readFile(migrationPath, 'utf8')
}

function formatLocationCode(prefix, displayOrder) {
  return `${prefix}-${displayOrder < 1000 ? String(displayOrder).padStart(3, '0') : String(displayOrder)}`
}

test('reorder migration keeps the existing RPC contract', async () => {
  const sql = await migrationSql()

  assert.match(sql, /create or replace function public\.update_category_location_display_order\(/)
  assert.match(sql, /p_category_id uuid/)
  assert.match(sql, /p_location_ids uuid\[\]/)
  assert.match(sql, /returns table \(\s*location_id uuid,\s*display_order integer\s*\)/)
  assert.match(sql, /grant execute on function public\.update_category_location_display_order\(uuid, uuid\[\]\) to authenticated;/)
})

test('reorder migration uses the same prefix lookup and advisory lock as allocate_location_code', async () => {
  const sql = await migrationSql()

  assert.match(sql, /v_prefix := public\.get_location_code_prefix\(p_category_id\);/)
  assert.match(sql, /perform pg_advisory_xact_lock\(hashtextextended\(v_prefix, 0\)\);/)
})

test('reorder migration locks the category rows before renumbering', async () => {
  const sql = await migrationSql()

  assert.match(sql, /from public\.locations l\s+where l\.category_id = p_category_id\s+order by l\.id\s+for update;/)
})

test('reorder migration preserves existing validation failures', async () => {
  const sql = await migrationSql()

  assert.match(sql, /Solo los administradores pueden actualizar el orden de locaciones\./)
  assert.match(sql, /La categoria es obligatoria\./)
  assert.match(sql, /El orden de locaciones es obligatorio\./)
  assert.match(sql, /El orden de locaciones contiene IDs duplicados\./)
  assert.match(sql, /El orden de locaciones contiene IDs invalidos\./)
  assert.match(sql, /El orden debe incluir todas las locaciones de la categoria\./)
  assert.match(sql, /Todas las locaciones del orden deben pertenecer a la categoria indicada\./)
})

test('reorder migration frees final codes through a transaction-unique temporary phase', async () => {
  const sql = await migrationSql()

  assert.match(sql, /set location_code = '__REORDER__:' \|\| txid_current\(\)::text \|\| ':' \|\| locations\.id::text/)
  assert.match(sql, /set\s+display_order = ordered_locations\.next_display_order,\s+location_code = ordered_locations\.next_location_code/)
})

test('reorder migration formats final codes like the allocator', async () => {
  const sql = await migrationSql()

  assert.match(sql, /v_prefix \|\| '-' \|\| case\s+when input_locations\.ordinality < 1000 then lpad\(input_locations\.ordinality::text, 3, '0'\)\s+else input_locations\.ordinality::text\s+end as next_location_code/)
  assert.equal(formatLocationCode('CASA', 1), 'CASA-001')
  assert.equal(formatLocationCode('CASA', 9), 'CASA-009')
  assert.equal(formatLocationCode('CASA', 10), 'CASA-010')
  assert.equal(formatLocationCode('CASA', 99), 'CASA-099')
  assert.equal(formatLocationCode('CASA', 100), 'CASA-100')
  assert.equal(formatLocationCode('CASA', 1000), 'CASA-1000')
})
