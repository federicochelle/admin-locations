import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

const edgeSourcePath = 'supabase/functions/location-image-delete/index.ts'
const migrationPath = 'supabase/migrations/20260923123000_add_delete_location_image_reconcile_cover_rpc.sql'

test('delete_location_image_and_reconcile_cover exposes the expected signature and locked location flow', async () => {
  const migration = await fs.readFile(migrationPath, 'utf8')

  assert.match(migration, /create or replace function public\.delete_location_image_and_reconcile_cover\(/)
  assert.match(migration, /p_location_id uuid/)
  assert.match(migration, /p_image_id uuid/)
  assert.match(migration, /returns table \([\s\S]*deleted_image_id uuid[\s\S]*promoted_image_id uuid[\s\S]*cover_image_id uuid[\s\S]*reconciled_cover boolean/)
  assert.match(migration, /from public\.locations l[\s\S]*where l\.id = p_location_id[\s\S]*for update/)
})

test('delete_location_image_and_reconcile_cover validates location, image, and ownership before deleting', async () => {
  const migration = await fs.readFile(migrationPath, 'utf8')

  assert.match(migration, /raise exception 'Location % does not exist\.'/)
  assert.match(migration, /raise exception 'Image % does not exist\.'/)
  assert.match(migration, /if v_image_location_id <> p_location_id then[\s\S]*does not belong/)
  assert.match(migration, /delete from public\.location_images li[\s\S]*where li\.id = p_image_id[\s\S]*and li\.location_id = p_location_id/)
})

test('delete_location_image_and_reconcile_cover leaves normal image deletes without cover side effects', async () => {
  const migration = await fs.readFile(migrationPath, 'utf8')

  assert.match(migration, /v_reconciled_cover := v_image_is_cover = true or v_current_cover_image_id = p_image_id/)
  assert.match(migration, /if v_reconciled_cover then[\s\S]*update public\.locations l[\s\S]*else[\s\S]*v_next_cover_image_id := null/)
})

test('delete_location_image_and_reconcile_cover promotes the next cover by deterministic order', async () => {
  const migration = await fs.readFile(migrationPath, 'utf8')

  assert.match(migration, /order by[\s\S]*li\.sort_order asc nulls last,[\s\S]*li\.created_at asc,[\s\S]*li\.id asc/)
  assert.match(migration, /set is_cover = li\.id = v_next_cover_image_id/)
  assert.match(migration, /set cover_image_id = v_next_cover_image_id/)
})

test('delete_location_image_and_reconcile_cover clears cover_image_id when deleting the only image', async () => {
  const migration = await fs.readFile(migrationPath, 'utf8')

  assert.match(migration, /if v_next_cover_image_id is null then[\s\S]*set cover_image_id = null/)
})

test('delete_location_image_and_reconcile_cover reconciles stale cover_image_id even when is_cover is false', async () => {
  const migration = await fs.readFile(migrationPath, 'utf8')

  assert.match(migration, /v_reconciled_cover := v_image_is_cover = true or v_current_cover_image_id = p_image_id/)
})

test('delete_location_image_and_reconcile_cover is service-role only', async () => {
  const migration = await fs.readFile(migrationPath, 'utf8')

  assert.match(migration, /security definer/)
  assert.match(migration, /revoke all on function public\.delete_location_image_and_reconcile_cover\(uuid, uuid\) from public/)
  assert.match(migration, /grant execute on function public\.delete_location_image_and_reconcile_cover\(uuid, uuid\) to service_role/)
  assert.doesNotMatch(migration, /to authenticated/)
})

test('location-image-delete deletes metadata through RPC before attempting Cloudflare cleanup', async () => {
  const source = await fs.readFile(edgeSourcePath, 'utf8')
  const rpcIndex = source.indexOf(".rpc('delete_location_image_and_reconcile_cover'")
  const cloudflareIndex = source.indexOf('await deleteCloudflareImage')

  assert.notEqual(rpcIndex, -1)
  assert.notEqual(cloudflareIndex, -1)
  assert.equal(rpcIndex < cloudflareIndex, true)
  assert.doesNotMatch(source, /\.from\('location_images'\)[\s\S]*\.delete\(/)
})

test('location-image-delete treats Cloudflare cleanup failure as best-effort after DB success', async () => {
  const source = await fs.readFile(edgeSourcePath, 'utf8')

  assert.match(source, /try \{[\s\S]*await deleteCloudflareImage\(typedImageRow\.storage_key\)[\s\S]*\} catch \(error\) \{[\s\S]*cloudflare_orphan_possible/)
  assert.match(source, /return jsonResponse\([\s\S]*\{ success: true \}/)
})
