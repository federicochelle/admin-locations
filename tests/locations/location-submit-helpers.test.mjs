import assert from 'node:assert/strict'
import test from 'node:test'
import { harness } from '../observability/harness.mjs'

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

async function loadSubmitHelpers() {
  const h = await harness()
  return h.module('src/features/locations/application/location-submit-helpers')
}

function locationValues(overrides = {}) {
  return {
    title: 'Casa',
    slug: 'casa',
    description: '',
    category_id: 'category-1',
    department_id: 'department-1',
    zone_id: 'zone-1',
    owner_id: 'owner-original',
    status: 'draft',
    published: false,
    premium: false,
    featured: false,
    visibility_level: 'public',
    address_private: 'Direccion privada',
    address_public: '',
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

test('getSubmitErrorMessage returns create and edit Error messages unchanged when no owner was created', async () => {
  const { getSubmitErrorMessage } = await loadSubmitHelpers()

  assert.equal(
    getSubmitErrorMessage({
      createdOwnerName: null,
      error: new Error('Fallo real de create.'),
      mode: 'create',
    }),
    'Fallo real de create.',
  )
  assert.equal(
    getSubmitErrorMessage({
      createdOwnerName: null,
      error: new Error('Fallo real de edit.'),
      mode: 'edit',
    }),
    'Fallo real de edit.',
  )
})

test('buildSubmitObservation builds the initial create and edit observation data', async () => {
  const { buildSubmitObservation } = await loadSubmitHelpers()

  assert.deepEqual(
    plain(
      buildSubmitObservation({
        correlationId: 'correlation-create',
        locationId: undefined,
        mode: 'create',
      }),
    ),
    {
      operation: 'location.create',
      stage: 'payload',
      correlationId: 'correlation-create',
      userFacing: true,
      outcome: 'failed',
    },
  )
  assert.deepEqual(
    plain(
      buildSubmitObservation({
        correlationId: 'correlation-edit',
        locationId: 'location-1',
        mode: 'edit',
      }),
    ),
    {
      operation: 'location.update',
      stage: 'payload',
      resourceId: 'location-1',
      correlationId: 'correlation-edit',
      userFacing: true,
      outcome: 'failed',
    },
  )
})

test('getLocationWriteObservationPatch returns confirmed write checkpoints for create and edit', async () => {
  const { getLocationWriteObservationPatch } = await loadSubmitHelpers()

  assert.deepEqual(
    plain(
      getLocationWriteObservationPatch({
        locationId: 'created-location',
        mode: 'create',
      }),
    ),
    {
      resourceId: 'created-location',
      outcome: 'partial',
      extraSafeContext: {
        confirmed_stages: [
          'location.insert',
          'relations.features',
          'relations.tags',
        ],
      },
    },
  )
  assert.deepEqual(
    plain(
      getLocationWriteObservationPatch({
        locationId: 'edited-location',
        mode: 'edit',
      }),
    ),
    {
      resourceId: 'edited-location',
      outcome: 'partial',
      extraSafeContext: {
        confirmed_stages: [
          'location.update',
          'relations.features',
          'relations.tags',
        ],
      },
    },
  )
})

test('getSubmitErrorMessage returns default create and edit messages for non Error failures', async () => {
  const { getSubmitErrorMessage } = await loadSubmitHelpers()

  assert.equal(
    getSubmitErrorMessage({
      createdOwnerName: null,
      error: 'fallo',
      mode: 'create',
    }),
    'No pudimos guardar la locación.',
  )
  assert.equal(
    getSubmitErrorMessage({
      createdOwnerName: null,
      error: 'fallo',
      mode: 'edit',
    }),
    'No pudimos guardar los cambios.',
  )
})

test('getSubmitErrorMessage prefixes the location failure when an inline owner was created', async () => {
  const { getSubmitErrorMessage } = await loadSubmitHelpers()

  assert.equal(
    getSubmitErrorMessage({
      createdOwnerName: 'Maria Pouso',
      error: new Error('Fallo de locación.'),
      mode: 'create',
    }),
    'El dueño "Maria Pouso" se creó correctamente, pero no pudimos guardar la locación. Fallo de locación.',
  )
  assert.equal(
    getSubmitErrorMessage({
      createdOwnerName: 'Maria Pouso',
      error: null,
      mode: 'edit',
    }),
    'El dueño "Maria Pouso" se creó correctamente, pero no pudimos guardar la locación.',
  )
})

test('getInlineOwnerDraft normalizes owner name and phone before deciding creation', async () => {
  const { getInlineOwnerDraft } = await loadSubmitHelpers()

  assert.deepEqual(
    plain(
      getInlineOwnerDraft({
        ownerName: '  Maria   Jose   Pouso  ',
        ownerPhone: '  +598   99   123   456  ',
      }),
    ),
    {
      full_name: 'Maria Jose Pouso',
      phone: '+598 99 123 456',
      shouldCreate: true,
    },
  )
})

test('getInlineOwnerDraft does not create incomplete owners', async () => {
  const { getInlineOwnerDraft } = await loadSubmitHelpers()

  assert.deepEqual(
    plain(
      getInlineOwnerDraft({
        ownerName: '  Maria  ',
        ownerPhone: '   ',
      }),
    ),
    {
      full_name: 'Maria',
      phone: '',
      shouldCreate: false,
    },
  )
  assert.deepEqual(
    plain(
      getInlineOwnerDraft({
        ownerName: '   ',
        ownerPhone: '  +598 99 123 456 ',
      }),
    ),
    {
      full_name: '',
      phone: '+598 99 123 456',
      shouldCreate: false,
    },
  )
})

test('buildSubmitPayloadValues injects the resolved owner id without changing the other values', async () => {
  const { buildSubmitPayloadValues } = await loadSubmitHelpers()
  const values = locationValues({
    owner_id: '',
    title: 'Titulo original',
  })

  const result = buildSubmitPayloadValues(values, 'owner-resolved')

  assert.deepEqual(plain(result), {
    ...values,
    owner_id: 'owner-resolved',
  })
  assert.equal(values.owner_id, '')
})

test('buildSubmitPayloadValues falls back to an empty owner id when unresolved', async () => {
  const { buildSubmitPayloadValues } = await loadSubmitHelpers()
  const values = locationValues({
    owner_id: 'owner-original',
  })

  assert.deepEqual(plain(buildSubmitPayloadValues(values, null)), {
    ...values,
    owner_id: '',
  })
})
