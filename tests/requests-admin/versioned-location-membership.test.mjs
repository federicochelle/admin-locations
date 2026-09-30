import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const root = process.cwd()
const LOCATION_IDS = {
  A: '11111111-1111-4111-8111-111111111111',
  B: '22222222-2222-4222-8222-222222222222',
  C: '33333333-3333-4333-8333-333333333333',
  D: '44444444-4444-4444-8444-444444444444',
  E: '55555555-5555-4555-8555-555555555555',
  F: '66666666-6666-4666-8666-666666666666',
  G: '77777777-7777-4777-8777-777777777777',
}
const ALL_LOCATION_IDS = Object.values(LOCATION_IDS)

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

async function loadAdminRequestsService(supabase) {
  const context = vm.createContext({ Error, console })
  const mocks = new Map([
    [path.join(root, 'src/lib/supabase'), { getSupabaseClient: () => supabase }],
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

    const filename = key.endsWith('.ts') ? key : `${key}.ts`
    const source = await fs.readFile(filename, 'utf8')
    const output = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
    }).outputText
    const mod = new vm.SourceTextModule(output, { context, identifier: filename })
    cache.set(key, mod)
    await mod.link((child, ref) => load(child, ref.identifier))
    return mod
  }

  const mod = await load(path.join(root, 'src/features/requests-admin/admin-location-requests.service'), root)
  await mod.evaluate()
  return mod.namespace
}

function createSupabaseStub({
  currentLocations = [],
  projectLocationRows = [],
  requestProjects = null,
  requestProject,
  statuses = [],
  versions = [],
} = {}) {
  const requests = []

  function matchesFilter(row, filter) {
    const [column, value] = filter.args

    if (filter.method === 'eq') {
      return row[column] === value
    }

    if (filter.method === 'neq') {
      return row[column] !== value
    }

    if (filter.method === 'in') {
      return filter.args[1].includes(row[column])
    }

    return true
  }

  function rowsForTable(table) {
    switch (table) {
      case 'request_projects':
        return requestProjects ?? (requestProject ? [requestProject] : [])
      case 'profiles':
        return []
      case 'request_project_versions':
        return versions
      case 'request_project_locations':
        return projectLocationRows
      case 'locations':
        return currentLocations
      case 'request_project_version_location_statuses':
        return statuses
      case 'reservations':
        return []
      default:
        throw new Error(`Unexpected table ${table}`)
    }
  }

  function makeBuilder(table) {
    const call = { table, filters: [], method: 'select', orderBy: null, payload: null }
    const builder = new Proxy({}, {
      get(_, key) {
        if (key === 'then') {
          return (resolve, reject) => {
            requests.push(call)
            Promise.resolve(resultForCall(call)).then(resolve, reject)
          }
        }

        return (...args) => {
          if (key === 'select') {
            call.method = 'select'
            call.selectArgs = args
            return builder
          }

          if (key === 'eq' || key === 'neq' || key === 'in') {
            call.filters.push({ method: key, args })
            return builder
          }

          if (key === 'order') {
            call.orderBy = args
            return builder
          }

          if (key === 'maybeSingle' || key === 'single') {
            call.singleMode = key
            return builder
          }

          if (key === 'update') {
            call.method = 'update'
            call.payload = args[0]
            return builder
          }

          return builder
        }
      },
    })

    return builder
  }

  function resultForCall(call) {
    let rows = rowsForTable(call.table).filter((row) =>
      call.filters.every((filter) => matchesFilter(row, filter)),
    )

    if (call.table === 'request_project_versions' && call.orderBy?.[0] === 'version_number') {
      rows = rows.slice().sort((left, right) => {
        const direction = call.orderBy[1]?.ascending === false ? -1 : 1
        return direction * ((left.version_number ?? 0) - (right.version_number ?? 0))
      })
    }

    if (call.singleMode) {
      return { data: rows[0] ?? null, error: null }
    }

    return { data: rows, error: null }
  }

  return {
    requests,
    supabase: {
      from(table) {
        return makeBuilder(table)
      },
      rpc(fn, args) {
        const call = { fn, args, method: 'rpc' }
        requests.push(call)

        if (fn !== 'list_admin_request_projects') {
          return { data: null, error: { message: `Unexpected rpc ${fn}` } }
        }

        let rows = rowsForTable('request_projects')
          .filter((row) => row.status !== 'draft')

        if (args?.p_status) {
          rows = rows.filter((row) => row.status === args.p_status)
        }

        rows = [...rows].sort((left, right) => {
          const leftArrivalAt = left.submitted_at ?? left.created_at ?? ''
          const rightArrivalAt = right.submitted_at ?? right.created_at ?? ''
          const arrivalComparison = rightArrivalAt.localeCompare(leftArrivalAt)

          if (arrivalComparison !== 0) {
            return arrivalComparison
          }

          const createdAtComparison = (right.created_at ?? '').localeCompare(left.created_at ?? '')

          if (createdAtComparison !== 0) {
            return createdAtComparison
          }

          return right.id.localeCompare(left.id)
        })

        const offset = Math.max(args?.p_offset ?? 0, 0)
        const limit = args?.p_limit == null ? rows.length : Math.max(args.p_limit, 1)

        return {
          data: rows.slice(offset, offset + limit),
          error: null,
        }
      },
    },
  }
}

function requestProject(activeVersionId = 'v3') {
  return {
    id: 'request-1',
    user_id: 'user-1',
    title: 'El emporio del hogar',
    production_company: 'Productora',
    message: null,
    status: 'pending',
    created_at: '2026-09-01T00:00:00Z',
    submitted_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    admin_active_version_id: activeVersionId,
  }
}

function version(id, versionNumber, locationIds, extraLocations = {}) {
  return {
    id,
    request_project_id: 'request-1',
    version_number: versionNumber,
    created_at: `2026-09-0${versionNumber}T00:00:00Z`,
    snapshot_payload: {
      locations: locationIds.map((locationId) => ({
        locationId,
        locationCode: extraLocations[locationId]?.locationCode ?? `SNAP-${locationId}`,
        title: extraLocations[locationId]?.title ?? `Snapshot ${locationId}`,
      })),
    },
    official_pdf_bucket: 'request-project-pdfs',
    official_pdf_path: `request-projects/request-1/v${versionNumber}/official.pdf`,
  }
}

function projectLocation(locationId) {
  return {
    id: `rpl-${locationId}`,
    request_project_id: 'request-1',
    location_id: locationId,
    status: 'pending',
    location_code_snapshot: `LEGACY-${locationId}`,
    location_title_snapshot: `Legacy ${locationId}`,
    reservations: [],
  }
}

function currentLocation(locationId, overrides = {}) {
  return {
    id: locationId,
    title: `Current ${locationId}`,
    location_code: `CURRENT-${locationId}`,
    location_images: [],
    categories: null,
    departments: null,
    zones: null,
    owners: null,
    ...overrides,
  }
}

async function getRequestLocationsForVersion(activeVersionId, options = {}) {
  const versions = [
    version('v3', 3, ALL_LOCATION_IDS),
    version('v2', 2, ALL_LOCATION_IDS.slice(0, 5)),
    version('v1', 1, ALL_LOCATION_IDS.slice(0, 3), options.extraSnapshotLocations),
  ]
  const { requests, supabase } = createSupabaseStub({
    currentLocations: ALL_LOCATION_IDS
      .filter((locationId) => !options.deletedLocationIds?.includes(locationId))
      .map((locationId) => currentLocation(locationId, options.currentLocationOverrides?.[locationId])),
    projectLocationRows: ALL_LOCATION_IDS.map(projectLocation),
    requestProject: requestProject(activeVersionId),
    statuses: options.statuses ?? [],
    versions,
  })
  const service = await loadAdminRequestsService(supabase)
  const request = await service.getAdminLocationRequestById('request-1')

  return { request, requests }
}

test('admin request detail uses V1 snapshot membership instead of all project locations', async () => {
  const { request, requests } = await getRequestLocationsForVersion('v1')

  assert.deepEqual(request.locations.map((location) => location.id), ALL_LOCATION_IDS.slice(0, 3))
  const locationsSelect = requests.find((call) => call.table === 'locations')
  assert.deepEqual(plain(locationsSelect.filters.find((filter) => filter.method === 'in').args), ['id', ALL_LOCATION_IDS.slice(0, 3)])
})

test('admin request detail uses V2 snapshot membership', async () => {
  const { request } = await getRequestLocationsForVersion('v2')

  assert.deepEqual(request.locations.map((location) => location.id), ALL_LOCATION_IDS.slice(0, 5))
})

test('admin request detail uses V3 snapshot membership', async () => {
  const { request } = await getRequestLocationsForVersion('v3')

  assert.deepEqual(request.locations.map((location) => location.id), ALL_LOCATION_IDS)
})

test('admin request detail can read explicit historical versions without updating request project', async () => {
  const versions = [
    version('v3', 3, ALL_LOCATION_IDS),
    version('v2', 2, ALL_LOCATION_IDS.slice(0, 5)),
    version('v1', 1, ALL_LOCATION_IDS.slice(0, 3)),
  ]
  const { requests, supabase } = createSupabaseStub({
    currentLocations: ALL_LOCATION_IDS.map(currentLocation),
    projectLocationRows: ALL_LOCATION_IDS.map(projectLocation),
    requestProject: {
      ...requestProject('v3'),
      status: 'confirmed',
    },
    statuses: [
      { request_project_version_id: 'v2', location_id: LOCATION_IDS.A, status: 'cancelled' },
      { request_project_version_id: 'v3', location_id: LOCATION_IDS.A, status: 'confirmed' },
    ],
    versions,
  })
  const service = await loadAdminRequestsService(supabase)

  const v1Request = await service.getAdminLocationRequestById('request-1', { versionId: 'v1' })
  const v3Request = await service.getAdminLocationRequestById('request-1', { versionId: 'v3' })
  const v2Request = await service.getAdminLocationRequestById('request-1', { versionId: 'v2' })

  assert.equal(v1Request.status, 'confirmed')
  assert.deepEqual(v1Request.locations.map((location) => location.id), ALL_LOCATION_IDS.slice(0, 3))
  assert.deepEqual(v3Request.locations.map((location) => location.id), ALL_LOCATION_IDS)
  assert.deepEqual(v2Request.locations.map((location) => location.id), ALL_LOCATION_IDS.slice(0, 5))
  assert.equal(v2Request.activeVersionId, 'v2')
  assert.equal(v2Request.officialPdf?.path, 'request-projects/request-1/v2/official.pdf')
  assert.equal(v2Request.locations[0].requestProjectLocationStatus, 'cancelled')
  assert.equal(v3Request.locations[0].requestProjectLocationStatus, 'confirmed')
  assert.equal(
    requests.some((call) => call.table === 'request_projects' && call.method === 'update'),
    false,
  )
})

test('admin request detail initial load without explicit version keeps persisted active version behavior', async () => {
  const { requests, supabase } = createSupabaseStub({
    currentLocations: ALL_LOCATION_IDS.map(currentLocation),
    projectLocationRows: ALL_LOCATION_IDS.map(projectLocation),
    requestProject: requestProject(null),
    versions: [
      version('v3', 3, ALL_LOCATION_IDS),
      version('v2', 2, ALL_LOCATION_IDS.slice(0, 5)),
    ],
  })
  const service = await loadAdminRequestsService(supabase)
  const request = await service.getAdminLocationRequestById('request-1')

  assert.equal(request.activeVersionId, 'v3')
  assert.equal(
    requests.some((call) =>
      call.table === 'request_projects' &&
      call.method === 'update' &&
      call.payload?.admin_active_version_id === 'v3',
    ),
    true,
  )
})

test('admin request detail rejects an explicit version from another request', async () => {
  const { supabase } = createSupabaseStub({
    currentLocations: ALL_LOCATION_IDS.map(currentLocation),
    projectLocationRows: ALL_LOCATION_IDS.map(projectLocation),
    requestProject: requestProject('v1'),
    versions: [
      version('v1', 1, ALL_LOCATION_IDS.slice(0, 3)),
      {
        ...version('foreign-version', 1, ALL_LOCATION_IDS.slice(0, 2)),
        request_project_id: 'other-request',
      },
    ],
  })
  const service = await loadAdminRequestsService(supabase)

  await assert.rejects(
    () => service.getAdminLocationRequestById('request-1', { versionId: 'foreign-version' }),
    /La versión seleccionada no pertenece a esta solicitud\./,
  )
})

test('admin request detail hook selects versions without persisting active version', async () => {
  const source = await fs.readFile(
    path.join(root, 'src/features/requests-admin/useAdminRequestDetail.ts'),
    'utf8',
  )

  assert.doesNotMatch(source, /setAdminLocationRequestActiveVersion/)
  assert.match(source, /getAdminLocationRequestById\(requestId,\s*\{\s*versionId/)
})

test('admin request hooks translate immutable confirmed and closed errors', async () => {
  const detailHookSource = await fs.readFile(
    path.join(root, 'src/features/requests-admin/useAdminRequestDetail.ts'),
    'utf8',
  )
  const listHookSource = await fs.readFile(
    path.join(root, 'src/features/requests-admin/useAdminLocationRequests.ts'),
    'utf8',
  )

  for (const source of [detailHookSource, listHookSource]) {
    assert.match(source, /request project is immutable in status confirmed/)
    assert.match(source, /Esta solicitud ya fue confirmada y no se puede modificar\./)
    assert.match(source, /request project is immutable in status closed/)
    assert.match(source, /Esta solicitud ya fue cerrada y no se puede modificar\./)
  }
})

test('current location code enriches historical snapshot membership by UUID', async () => {
  const { request } = await getRequestLocationsForVersion('v1', {
    currentLocationOverrides: {
      [LOCATION_IDS.A]: { location_code: 'CASA-014' },
    },
    extraSnapshotLocations: {
      [LOCATION_IDS.A]: { locationCode: 'CASA-009' },
    },
  })

  assert.equal(request.locations[0].id, LOCATION_IDS.A)
  assert.equal(request.locations[0].locationCode, 'CASA-014')
})

test('deleted current location remains visible from snapshot fallback', async () => {
  const { request } = await getRequestLocationsForVersion('v1', {
    deletedLocationIds: [LOCATION_IDS.B],
    extraSnapshotLocations: {
      [LOCATION_IDS.B]: { locationCode: 'CASA-009', title: 'Casa historica' },
    },
  })

  assert.deepEqual(request.locations.map((location) => location.id), ALL_LOCATION_IDS.slice(0, 3))
  assert.equal(request.locations[1].title, 'Casa historica')
  assert.equal(request.locations[1].locationCode, 'CASA-009')
})

test('invalid snapshot payload falls back to legacy request project locations', async () => {
  const { request } = await getRequestLocationsForVersion('v1', {
    extraSnapshotLocations: {},
  })
  const brokenVersion = {
    id: 'broken',
    request_project_id: 'request-1',
    version_number: 4,
    snapshot_payload: { locations: 'not-an-array' },
  }
  const { supabase } = createSupabaseStub({
    currentLocations: ALL_LOCATION_IDS.map(currentLocation),
    projectLocationRows: ALL_LOCATION_IDS.map(projectLocation),
    requestProject: requestProject('broken'),
    versions: [brokenVersion, version('v1', 1, [LOCATION_IDS.A])],
  })
  const service = await loadAdminRequestsService(supabase)
  const fallbackRequest = await service.getAdminLocationRequestById('request-1')

  assert.equal(request.locations.length, 3)
  assert.deepEqual(fallbackRequest.locations.map((location) => location.id), ALL_LOCATION_IDS)
})

test('snapshot locations without valid UUID identity falls back to legacy request project locations', async () => {
  const invalidIdentityVersion = {
    id: 'invalid-identities',
    request_project_id: 'request-1',
    version_number: 1,
    snapshot_payload: {
      locations: [
        { location_code: 'CASA-001', title: 'Code is not identity' },
        { locationId: 'CASA-002', title: 'Invalid UUID' },
      ],
    },
  }
  const { supabase } = createSupabaseStub({
    currentLocations: ALL_LOCATION_IDS.map(currentLocation),
    projectLocationRows: ALL_LOCATION_IDS.map(projectLocation),
    requestProject: requestProject('invalid-identities'),
    versions: [invalidIdentityVersion],
  })
  const service = await loadAdminRequestsService(supabase)
  const request = await service.getAdminLocationRequestById('request-1')

  assert.deepEqual(request.locations.map((location) => location.id), ALL_LOCATION_IDS)
})

test('valid empty snapshot locations renders zero rows instead of falling back to legacy locations', async () => {
  const allIds = ALL_LOCATION_IDS.slice(0, 3)
  const { supabase } = createSupabaseStub({
    currentLocations: allIds.map(currentLocation),
    projectLocationRows: allIds.map(projectLocation),
    requestProject: requestProject('empty'),
    versions: [
      {
        id: 'empty',
        request_project_id: 'request-1',
        version_number: 1,
        snapshot_payload: { locations: [] },
      },
    ],
  })
  const service = await loadAdminRequestsService(supabase)
  const request = await service.getAdminLocationRequestById('request-1')

  assert.deepEqual(plain(request.locations), [])
})

test('version statuses are applied only to snapshot members', async () => {
  const { request, requests } = await getRequestLocationsForVersion('v1', {
    statuses: [
      { request_project_version_id: 'v1', location_id: LOCATION_IDS.A, status: 'confirmed' },
      { request_project_version_id: 'v1', location_id: LOCATION_IDS.D, status: 'cancelled' },
    ],
  })

  assert.deepEqual(
    request.locations.map((location) => [location.id, location.requestProjectLocationStatus]),
    [[LOCATION_IDS.A, 'confirmed'], [LOCATION_IDS.B, 'pending'], [LOCATION_IDS.C, 'pending']],
  )
  const statusSelect = requests.find((call) => call.table === 'request_project_version_location_statuses')
  assert.deepEqual(plain(statusSelect.filters.find((filter) => filter.method === 'in').args), ['location_id', ALL_LOCATION_IDS.slice(0, 3)])
})

test('historical snapshot row without request project location id is not linked to reservations', async () => {
  const { supabase } = createSupabaseStub({
    currentLocations: [currentLocation(LOCATION_IDS.A)],
    projectLocationRows: [],
    requestProject: requestProject('v1'),
    versions: [version('v1', 1, [LOCATION_IDS.A])],
  })
  const service = await loadAdminRequestsService(supabase)
  const request = await service.getAdminLocationRequestById('request-1')

  assert.equal(request.locations[0].id, LOCATION_IDS.A)
  assert.equal(request.locations[0].requestProjectLocationId, null)
})

test('request included locations table disables confirmed option for historical rows without requestProjectLocationId', async () => {
  const source = await fs.readFile(
    path.join(root, 'src/features/requests-admin/RequestIncludedLocationsTable.tsx'),
    'utf8',
  )

  assert.match(source, /option\.value === 'confirmed' && !location\.requestProjectLocationId/)
  assert.match(source, /Esta locación histórica no tiene una fila operativa/)
})

test('admin request list submittedAt falls back from submitted_at to created_at', async () => {
  const requestProjects = [
    {
      ...requestProject('v1'),
      id: 'request-submitted',
      created_at: '2026-09-01T10:00:00Z',
      submitted_at: '2026-09-02T11:30:00Z',
    },
    {
      ...requestProject('v1'),
      id: 'request-created',
      created_at: '2026-09-03T12:45:00Z',
      submitted_at: null,
    },
    {
      ...requestProject('v1'),
      id: 'request-empty',
      created_at: null,
      submitted_at: null,
    },
  ]
  const { supabase } = createSupabaseStub({
    requestProjects,
  })
  const service = await loadAdminRequestsService(supabase)
  const result = await service.getAdminLocationRequestsPage({
    page: 1,
    pageSize: 10,
    status: 'all',
  })

  assert.deepEqual(
    plain(result.items.map((request) => [request.id, request.submittedAt])),
    [
      ['request-created', '2026-09-03T12:45:00Z'],
      ['request-submitted', '2026-09-02T11:30:00Z'],
      ['request-empty', null],
    ],
  )
})

test('admin request list orders by arrival date and ignores updated_at', async () => {
  const requestProjects = [
    {
      ...requestProject('v1'),
      id: 'request-25',
      created_at: '2026-09-25T09:00:00Z',
      submitted_at: '2026-09-25T09:00:00Z',
      updated_at: '2026-10-10T09:00:00Z',
    },
    {
      ...requestProject('v1'),
      id: 'request-30',
      created_at: '2026-09-30T09:00:00Z',
      submitted_at: '2026-09-30T09:00:00Z',
      updated_at: '2026-09-30T09:00:00Z',
    },
    {
      ...requestProject('v1'),
      id: 'request-21',
      created_at: '2026-09-21T09:00:00Z',
      submitted_at: null,
      updated_at: '2026-12-01T09:00:00Z',
    },
  ]
  const { supabase } = createSupabaseStub({
    requestProjects,
  })
  const service = await loadAdminRequestsService(supabase)
  const result = await service.getAdminLocationRequestsPage({
    page: 1,
    pageSize: 10,
    status: 'all',
  })

  assert.deepEqual(plain(result.items.map((request) => request.id)), [
    'request-30',
    'request-25',
    'request-21',
  ])
})

test('admin request list date formatters use Uruguay timezone explicitly', async () => {
  const source = await fs.readFile(
    path.join(root, 'src/features/requests-admin/LocationRequestsAdminTable.tsx'),
    'utf8',
  )

  assert.equal(
    source.match(/timeZone:\s*'America\/Montevideo'/g)?.length,
    2,
  )
})
