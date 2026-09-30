import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const migrationPath = path.join(
  root,
  'supabase/migrations/20260930100000_allow_confirmed_request_project_status_updates.sql',
)

function withoutIgnoredColumns(row) {
  const { status: _status, updated_at: _updatedAt, ...protectedColumns } = row
  return protectedColumns
}

function hasSameProtectedColumns(oldRow, newRow) {
  return JSON.stringify(withoutIgnoredColumns(newRow)) === JSON.stringify(withoutIgnoredColumns(oldRow))
}

function allowsUpdateLikeMigration(oldRow, newRow) {
  if (oldRow.status === 'closed') {
    return false
  }

  if (oldRow.status === 'confirmed') {
    return (
      newRow.status !== oldRow.status &&
      ['pending', 'discarded'].includes(newRow.status) &&
      hasSameProtectedColumns(oldRow, newRow)
    )
  }

  return true
}

test('request project immutable guard allows only confirmed status updates', async () => {
  const sql = await fs.readFile(migrationPath, 'utf8')

  assert.match(sql, /create or replace function public\.guard_request_project_immutable_update\(\)/i)
  assert.match(sql, /old\.status = 'confirmed'/i)
  assert.match(sql, /new\.status is distinct from old\.status/i)
  assert.match(sql, /new\.status in \('pending', 'discarded'\)/i)
  assert.match(sql, /to_jsonb\(new\) - array\['status', 'updated_at'\]/i)
  assert.match(sql, /to_jsonb\(old\) - array\['status', 'updated_at'\]/i)
  assert.doesNotMatch(sql, /admin_active_version_id[^,\n]*\]/i)
})

test('request project immutable guard keeps closed projects fully immutable', async () => {
  const sql = await fs.readFile(migrationPath, 'utf8')

  const closedBlock = sql.match(/if old\.status = 'closed' then[\s\S]*?end if;/i)?.[0] ?? ''

  assert.match(closedBlock, /raise exception 'request project is immutable in status %', old\.status/i)
  assert.doesNotMatch(closedBlock, /return new/i)
  assert.match(sql, /using errcode = '25006'/i)
})

test('request project immutable guard behavior keeps confirmed content immutable', () => {
  const confirmed = {
    id: 'request-1',
    title: 'El emporio del hogar',
    message: 'Mensaje original',
    status: 'confirmed',
    submitted_at: '2026-09-29T14:00:00.000Z',
    updated_at: '2026-09-29T14:00:00.000Z',
    admin_active_version_id: 'version-1',
  }

  assert.equal(
    allowsUpdateLikeMigration(confirmed, {
      ...confirmed,
      status: 'pending',
      updated_at: '2026-09-30T12:00:00.000Z',
    }),
    true,
  )
  assert.equal(
    allowsUpdateLikeMigration(confirmed, {
      ...confirmed,
      status: 'discarded',
      updated_at: '2026-09-30T12:00:00.000Z',
    }),
    true,
  )
  assert.equal(allowsUpdateLikeMigration(confirmed, { ...confirmed, title: 'Otro titulo' }), false)
  assert.equal(allowsUpdateLikeMigration(confirmed, { ...confirmed, message: 'Otro mensaje' }), false)
  assert.equal(
    allowsUpdateLikeMigration(confirmed, {
      ...confirmed,
      submitted_at: '2026-09-30T12:00:00.000Z',
    }),
    false,
  )
  assert.equal(
    allowsUpdateLikeMigration(confirmed, {
      ...confirmed,
      admin_active_version_id: 'version-2',
    }),
    false,
  )
})

test('request project immutable guard keeps non-confirmed statuses behavior unchanged', () => {
  const pending = {
    id: 'request-1',
    title: 'Solicitud',
    message: 'Mensaje',
    status: 'pending',
    updated_at: '2026-09-29T14:00:00.000Z',
  }
  const discarded = { ...pending, status: 'discarded' }
  const closed = { ...pending, status: 'closed' }

  assert.equal(allowsUpdateLikeMigration(pending, { ...pending, status: 'confirmed' }), true)
  assert.equal(allowsUpdateLikeMigration(discarded, { ...discarded, status: 'pending' }), true)
  assert.equal(allowsUpdateLikeMigration(closed, { ...closed, status: 'pending' }), false)
})
