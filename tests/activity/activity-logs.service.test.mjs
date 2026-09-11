import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const root = process.cwd()
const excludedActorId = '689dd1d5-4db1-4a40-9a95-0871b529984f'
const otherActorId = '11111111-1111-4111-8111-111111111111'

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

function createSupabaseStub({ activityRows = [], profileRows = [] } = {}) {
  const requests = []

  function makeBuilder(table) {
    const call = {
      table,
      filters: [],
      method: 'select',
      orderBy: null,
      payload: null,
      range: null,
      selectArgs: null,
    }
    const builder = new Proxy({}, {
      get(_, key) {
        if (key === 'then') {
          return (resolve, reject) => {
            requests.push(call)
            Promise.resolve(getResult(call)).then(resolve, reject)
          }
        }

        return (...args) => {
          if (key === 'insert') {
            call.method = 'insert'
            call.payload = args[0]
            return builder
          }

          if (key === 'select') {
            call.method = 'select'
            call.selectArgs = args
            return builder
          }

          if (key === 'eq' || key === 'not' || key === 'ilike' || key === 'or') {
            call.filters.push({ method: key, args })
            return builder
          }

          if (key === 'order') {
            call.orderBy = args
            return builder
          }

          if (key === 'limit') {
            call.limit = args[0]
            return builder
          }

          if (key === 'range') {
            call.range = args
            return builder
          }

          return builder
        }
      },
    })

    return builder
  }

  function getResult(call) {
    if (call.method === 'insert') {
      return { data: null, error: null }
    }

    if (call.table === 'profiles') {
      return { data: profileRows, error: null }
    }

    const visibleOnly = call.filters.some((filter) =>
      filter.method === 'eq' &&
      filter.args[0] === 'visible' &&
      filter.args[1] === true,
    )
    let rows = activityRows
    if (visibleOnly) {
      rows = rows.filter((row) => row.visible === true)
    }

    if (call.range) {
      rows = rows.slice(call.range[0], call.range[1] + 1)
    }

    return {
      count: visibleOnly ? activityRows.filter((row) => row.visible === true).length : activityRows.length,
      data: rows,
      error: null,
    }
  }

  return {
    requests,
    supabase: {
      from(table) {
        return makeBuilder(table)
      },
    },
  }
}

async function loadActivityLogsService(supabase) {
  const context = vm.createContext({
    Error,
    console,
  })
  const mocks = new Map([
    [path.join(root, 'src/lib/supabase'), { getSupabaseClient: () => supabase }],
    [path.join(root, 'src/lib/admin-error-reporting'), { normalizeAdminError: error => error instanceof Error ? error : new Error(error?.message ?? 'Unexpected error') }],
  ])
  const cache = new Map()

  async function load(specifier, referencing) {
    const key = specifier.startsWith('.') ? path.resolve(path.dirname(referencing), specifier) : specifier
    if (cache.has(key)) return cache.get(key)

    const mocked = mocks.get(key)
    if (mocked) {
      const mod = new vm.SyntheticModule(Object.keys(mocked), function () {
        for (const [name, value] of Object.entries(mocked)) this.setExport(name, value)
      }, { context, identifier: key })
      cache.set(key, mod)
      return mod
    }

    const filename = key.endsWith('.ts') ? key : key + '.ts'
    const source = await fs.readFile(filename, 'utf8')
    const output = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
    }).outputText
    const mod = new vm.SourceTextModule(output, { context, identifier: filename })
    cache.set(key, mod)
    await mod.link((child, ref) => load(child, ref.identifier))
    return mod
  }

  const mod = await load(path.join(root, 'src/features/activity/activity-logs.service'), root)
  await mod.evaluate()
  return mod.namespace
}

function row(id, overrides = {}) {
  return {
    id,
    action: 'created',
    entity_type: 'location',
    entity_id: '22222222-2222-4222-8222-222222222222',
    entity_name: `Location ${id}`,
    created_at: `2026-09-10T12:0${id}:00Z`,
    profiles: { full_name: `User ${id}` },
    visible: true,
    ...overrides,
  }
}

test('createActivityLog skips the excluded developer actor without inserting', async () => {
  const { requests, supabase } = createSupabaseStub()
  const service = await loadActivityLogsService(supabase)

  await service.createActivityLog({
    actorProfileId: excludedActorId,
    action: 'created',
    entityType: 'location',
    entityId: '22222222-2222-4222-8222-222222222222',
    entityName: 'Excluded location',
  })

  assert.deepEqual(requests, [])
})

test('createActivityLog inserts normally for any other actor', async () => {
  const { requests, supabase } = createSupabaseStub()
  const service = await loadActivityLogsService(supabase)

  await service.createActivityLog({
    actorProfileId: otherActorId,
    action: 'updated',
    entityType: 'owner',
    entityId: '22222222-2222-4222-8222-222222222222',
    entityName: 'Owner',
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].table, 'activity_logs')
  assert.equal(requests[0].method, 'insert')
  assert.deepEqual(plain(requests[0].payload), {
    actor_profile_id: otherActorId,
    action: 'updated',
    entity_type: 'owner',
    entity_id: '22222222-2222-4222-8222-222222222222',
    entity_name: 'Owner',
  })
})

test('getActivityLogs reads only visible activity logs', async () => {
  const { requests, supabase } = createSupabaseStub({
    activityRows: [
      row('1'),
      row('2', { visible: false }),
    ],
  })
  const service = await loadActivityLogsService(supabase)

  const logs = await service.getActivityLogs({ limit: 5 })

  assert.deepEqual(logs.map((log) => log.id), ['1'])
  const activityRequest = requests.find((request) => request.table === 'activity_logs')
  assert(activityRequest.filters.some((filter) =>
    filter.method === 'eq' &&
    filter.args[0] === 'visible' &&
    filter.args[1] === true,
  ))
})

test('getActivityLogsPage counts and paginates only visible activity logs', async () => {
  const { requests, supabase } = createSupabaseStub({
    activityRows: [
      row('1'),
      row('2', { visible: false }),
      row('3'),
    ],
  })
  const service = await loadActivityLogsService(supabase)

  const result = await service.getActivityLogsPage({
    page: 1,
    pageSize: 1,
    searchTerm: '',
  })

  assert.deepEqual(result.items.map((log) => log.id), ['1'])
  assert.equal(result.totalCount, 2)
  const activityRequest = requests.find((request) => request.table === 'activity_logs')
  assert(activityRequest.filters.some((filter) =>
    filter.method === 'eq' &&
    filter.args[0] === 'visible' &&
    filter.args[1] === true,
  ))
  assert.deepEqual(activityRequest.range, [0, 0])
})
