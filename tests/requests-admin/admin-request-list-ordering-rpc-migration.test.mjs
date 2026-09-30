import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const migrationPath = path.join(
  root,
  'supabase/migrations/20260930103000_order_admin_request_projects_by_arrival_at.sql',
)

test('admin request list RPC orders by arrival timestamp before pagination', async () => {
  const sql = await fs.readFile(migrationPath, 'utf8')

  assert.match(sql, /create or replace function public\.list_admin_request_projects\(/i)
  assert.match(
    sql,
    /coalesce\(request_project\.submitted_at,\s*request_project\.created_at\) desc nulls last/i,
  )
  assert.match(sql, /request_project\.created_at desc nulls last/i)
  assert.match(sql, /request_project\.id desc/i)
  assert.match(sql, /limit case when p_limit is null then null else greatest\(p_limit, 1\) end/i)
  assert.match(sql, /offset greatest\(coalesce\(p_offset, 0\), 0\)/i)
  assert.doesNotMatch(sql, /updated_at/i)
})
