import test from 'node:test'
import assert from 'node:assert/strict'
import { harness, locationId, correlationId } from './harness.mjs'

const observation = { operation: 'location.create', stage: 'location.insert', correlationId, userFacing: true }
const payload = { title: 'Private title', slug: 'private-title', selectedFeatureIds: ['feature'], selectedTagIds: ['tag'] }
const event = { preventDefault() {} }

for (const table of ['owners', 'categories', 'departments', 'zones', 'features', 'tags']) {
  test(`options failure in ${table} preserves Supabase diagnostics without reporting in service`, async () => {
    const original = { message: 'Private provider details', code: '42501', status: 403 }
    const h = await harness({ query: call => call.table === table ? { error: original } : { data: [], error: null } })
    const service = await h.module('src/features/locations/locations.service')
    await assert.rejects(service.getLocationFormOptions(), error => {
      assert.equal(h.events.length, 0)
      assert.equal(error.message, original.message)
      assert.equal(error.cause, original)
      h.reporting.reportAdminError(error, { operation: 'location.options', stage: 'options', provider: 'supabase' })
      h.reporting.reportAdminError(error, observation)
      return true
    })
    assert.equal(h.events.length, 1)
    assert.equal(h.events[0].scope.tags.supabase_code, '42501')
    assert.equal(h.events[0].scope.tags.http_status, '403')
  })
}

for (const [module, entity] of [['owners', 'Owner'], ['categories', 'Category']]) {
  test(`inline ${entity} creation keeps friendly message and original diagnostics`, async () => {
    const original = { message: 'Private provider details', code: '23505' }
    const h = await harness({ query: () => ({ error: original }) })
    const service = await h.module(`src/features/${module}/${module}.service`)
    await assert.rejects(service[`create${entity}`]({}), error => {
      assert.equal(h.events.length, 0)
      assert.equal(error.cause, original)
      assert.ok(error.message)
      h.reporting.reportAdminError(error, observation)
      return true
    })
    assert.equal(h.events[0].scope.tags.supabase_code, '23505')
  })
}

test('reporting scope excludes person identifiers before capture', async () => {
  const h = await harness()
  h.reporting.reportAdminError(new Error('failure'), {
    operation: 'location.owner.create', resourceType: 'owner', resourceId: locationId,
    extraSafeContext: { owner_id: locationId, resource_id: locationId },
  })
  assert.equal(JSON.stringify(h.events[0].scope).includes(locationId), false)
})

function successQuery(call) {
  if (call.table === 'locations' && call.method === 'select') return { data: [], error: null }
  if (call.table === 'locations') return { data: { id: locationId, location_code: 'CODE' }, error: null }
  return { data: [], error: null }
}

test('actual create service propagates, actual form catch reports exactly once', async () => {
  const original = { code: '23505', message: 'private@example.com already exists', details: 'private form' }
  const h = await harness({ query: call => call.method === 'insert' ? { error: original } : successQuery(call) })
  const service = await h.module('src/features/locations/locations.service')
  const form = await h.formHandlers({ createLocation: () => service.createLocation(payload, { correlationId }) })
  await form.handleSubmit(event)
  assert.equal(h.events.length, 1)
  assert.equal(h.events[0].kind, 'exception')
  assert.equal(h.events[0].scope.tags.stage, 'location.insert')
  assert.equal(h.events[0].scope.tags.supabase_code, '23505')
  assert.equal(h.events[0].error.cause, original)
  assert.ok(form.state.submitError)
  assert.equal(form.state.navigation.length, 0)
})

test('normal form validation produces no report and no save', async () => {
  const h = await harness()
  let saves = 0
  const form = await h.formHandlers({ validateRequiredFields: () => ({ title: 'Required' }), createLocation: async () => { saves++; return locationId } })
  await form.handleSubmit(event)
  assert.equal(h.events.length, 0)
  assert.equal(saves, 0)
  assert.equal(form.state.validations[0], 'Required')
})

test('unexpected validation failure is reported', async () => {
  const h = await harness()
  const form = await h.formHandlers({ validateRequiredFields: () => { throw new TypeError('unexpected') } })
  await form.handleSubmit(event)
  assert.equal(h.events.length, 1)
  assert.equal(h.events[0].scope.tags.stage, 'validation')
})

test('relation failure after confirmed DB insert reports partial with ID and checkpoints', async () => {
  const h = await harness({ query: call => call.table === 'location_tags' && call.method === 'insert' ? { error: { code: '23503', message: 'relation failed' } } : successQuery(call) })
  const service = await h.module('src/features/locations/locations.service')
  const form = await h.formHandlers({ createLocation: () => service.createLocation(payload, { correlationId }) })
  await form.handleSubmit(event)
  assert.equal(h.events.length, 1)
  const scope = h.events[0].scope
  assert.equal(scope.tags.outcome, 'partial')
  assert.equal(scope.tags.stage, 'relations.tags')
  assert.equal(scope.contexts.admin_operation.location_id, locationId)
  assert.ok(scope.contexts.admin_operation.confirmed_stages.includes('location.insert'))
})

test('activity failure is a secondary warning; creation still succeeds', async () => {
  const h = await harness({ query: successQuery, activityError: new Error('log failed') })
  const service = await h.module('src/features/locations/locations.service')
  assert.equal(await service.createLocation(payload, { actorProfileId: 'actor', correlationId }), locationId)
  assert.equal(h.events.length, 1)
  assert.equal(h.events[0].scope.level, 'warning')
  assert.equal(h.events[0].scope.tags.user_facing, 'false')
  assert.equal(h.events[0].scope.tags.stage, 'activity_log')
})

test('upload URL error preserves HTTP status, code and stage through upload wrapper', async () => {
  const original = Object.assign(new Error('private API response'), { context: new Response('{}', { status: 403 }) })
  const h = await harness({ invoke: async () => ({ data: null, error: original }) })
  const images = await h.module('src/features/locations/location-images.service')
  const file = new File(['image'], 'private-person.jpg', { type: 'image/jpeg' })
  await assert.rejects(images.uploadLocationImage({ locationId, file, width: 10, height: 20 }), error => {
    h.reporting.reportAdminError(error, { ...observation, stage: 'images.upload' })
    return true
  })
  assert.equal(h.events.length, 1)
  assert.equal(h.events[0].scope.tags.stage, 'images.upload_url')
  assert.equal(h.events[0].scope.tags.http_status, '403')
})

test('actual batch: three images, one finalize failure, no duplicate edit summary', async () => {
  const h = await harness()
  const pendingImages = [0, 1, 2].map(index => ({ id: String(index), originalIndex: index, status: 'pending', width: 10, height: 20, file: new File(['image'], `private-${index}.jpg`, { type: 'image/jpeg' }) }))
  const form = await h.formHandlers({ mode: 'edit', locationId, pendingImages,
    uploadLocationImage: async input => {
      if (input.sortOrder === 1) throw h.reporting.annotateAdminError(new Error('metadata failed'), { stage: 'images.finalize', provider: 'supabase' })
    },
  })
  await form.handleSubmit(event)
  assert.equal(h.events.length, 1)
  assert.equal(h.events[0].scope.tags.stage, 'images.finalize')
  assert.equal(h.events[0].scope.tags.outcome, 'partial')
  assert.equal(h.events[0].scope.contexts.admin_operation.image_count, 3)
  assert.ok(h.events[0].scope.contexts.admin_operation.correlation_id)
  assert.equal(form.state.pending.length, 1)
  assert.ok(form.state.submitError)
  assert.equal(form.state.navigation.length, 0)
})

test('same error and new wrapper around its cause are not reported twice', async () => {
  const h = await harness()
  const original = new Error('original')
  h.reporting.reportAdminError(original, observation)
  h.reporting.reportAdminError(original, observation)
  h.reporting.reportAdminError(new Error('wrapper', { cause: original }), observation)
  assert.equal(h.events.length, 1)
})

test('normalization preserves original Error identity, stack and cause', async () => {
  const h = await harness()
  const cause = new TypeError('root')
  const original = new Error('wrapper', { cause })
  const stack = original.stack
  assert.equal(h.reporting.normalizeAdminError(original), original)
  h.reporting.reportAdminError(original, observation)
  assert.equal(h.events[0].error, original)
  assert.equal(h.events[0].error.stack, stack)
  assert.equal(h.events[0].error.cause, cause)
})

test('sanitizer strips private values, bodies, credentials, breadcrumbs and signed URLs', async () => {
  const h = await harness()
  const privateText = 'María private@example.com +59899123456 Calle Privada Bearer secret-token'
  h.reporting.reportAdminError(new Error(privateText), { ...observation, resourceId: locationId,
    route: '/locations/' + locationId + '/edit?token=secret-token',
    extraSafeContext: { image_count: 3, image_mime: 'image/jpeg', filename: 'private-person.jpg', form: privateText, Authorization: privateText, image_dimensions: { width: 10, height: 20, private: privateText } },
  })
  const scope = h.events[0].scope
  const output = h.reporting.sanitizeAdminSentryEvent({ type: undefined, ...scope,
    message: privateText, user: { email: privateText }, extra: { body: privateText },
    request: { url: 'https://private.test/photo?token=secret-token', headers: { Authorization: privateText }, cookies: privateText, data: privateText },
    breadcrumbs: [{ message: privateText, data: { url: privateText } }],
    exception: { values: [{ type: 'Error', value: privateText, stacktrace: { frames: [{ filename: 'https://admin.test/assets/index-abc.js?token=secret-token', lineno: 10, colno: 2, vars: { form: privateText }, context_line: privateText }] } }] },
  })
  const serialized = JSON.stringify(output)
  for (const secret of ['María', 'private@example.com', '59899123456', 'Calle Privada', 'secret-token', 'private-person.jpg', 'Authorization', 'cookies', 'breadcrumbs', 'context_line']) assert.equal(serialized.includes(secret), false, secret)
  assert.equal(output.contexts.admin_operation.location_id, locationId)
  assert.equal(output.contexts.admin_operation.route, '/locations/:id/edit')
  assert.equal(output.exception.values[0].stacktrace.frames[0].filename, '/assets/index-abc.js')
  assert.equal(output.exception.values[0].stacktrace.frames[0].lineno, 10)
})

test('no exception uses captureMessage; a failed SDK never breaks the operation', async () => {
  const h = await harness()
  h.reporting.reportAdminError(null, { ...observation, outcome: 'partial' })
  assert.equal(h.events[0].kind, 'message')
  const report = h.reporting.createAdminErrorReporter({ captureException() { throw new Error('SDK down') }, captureMessage() { throw new Error('SDK down') } })
  assert.doesNotThrow(() => report(new Error('original'), observation))
})

test('gallery refresh absorbs failure, reports once with shared save context', async () => {
  const h = await harness({ query: () => ({ error: { code: '42501', message: 'forbidden' } }) })
  const hooks = await h.module('src/features/locations/useLocationImages')
  const gallery = hooks.useLocationImages(locationId)
  await assert.doesNotReject(gallery.refresh({ ...observation, outcome: 'partial' }))
  assert.equal(h.events.length, 1)
  assert.equal(h.events[0].scope.tags.stage, 'images.refresh')
  assert.equal(h.events[0].scope.tags.outcome, 'partial')
  assert.equal(h.events[0].scope.contexts.admin_operation.correlation_id, correlationId)
})

test('delete hook retains absorbed failure behavior and reports known partial DB deletion', async () => {
  const original = Object.assign(new Error('Edge function non-2xx'), { context: new Response(JSON.stringify({ error: 'Could not delete location.', details: 'private@example.com' }), { status: 500 }) })
  const h = await harness({ invoke: async () => ({ error: original }) })
  const hooks = await h.module('src/features/locations/useLocations')
  await assert.doesNotReject(hooks.useLocations().remove(locationId, correlationId))
  assert.equal(h.events.length, 1)
  assert.equal(h.events[0].scope.tags.operation, 'location.delete')
  assert.equal(h.events[0].scope.tags.stage, 'db_delete')
  assert.equal(h.events[0].scope.tags.outcome, 'partial')
  assert.equal(h.events[0].scope.contexts.admin_operation.correlation_id, correlationId)
  assert.equal(original.context.bodyUsed, false)
})

test('generic delete failure does not invent a confirmed cleanup or rollback', async () => {
  const h = await harness({ invoke: async () => ({ error: new TypeError('Failed to fetch') }) })
  const hooks = await h.module('src/features/locations/useLocations')
  await hooks.useLocations().remove(locationId, correlationId)
  assert.equal(h.events[0].scope.tags.outcome, 'unknown')
  assert.equal(h.events[0].scope.tags.stage, 'request')
})

test('Cloudflare 502 is propagated with status and original upload stage', async () => {
  const h = await harness({ fetch: async () => new Response('private upstream body', { status: 502 }) })
  const images = await h.module('src/features/locations/location-images.service')
  await assert.rejects(images.uploadImageFileToCloudflare('https://upload.test/private-token', new File(['x'], 'private.jpg')), error => {
    h.reporting.reportAdminError(error, observation)
    return true
  })
  assert.equal(h.events.length, 1)
  assert.equal(h.events[0].scope.tags.http_status, '502')
  assert.equal(h.events[0].scope.tags.stage, 'images.upload')
  assert.equal(h.events[0].scope.tags.provider, 'cloudflare')
})

test('detection/blur fallback reports the precise inner stage without rejecting the image', async () => {
  for (const stage of ['images.detect', 'images.blur']) {
    const original = new Error('private diagnostic')
    const h = await harness({
      detect: async () => { if (stage === 'images.detect') throw original; return { summary: { faces: 1 }, faces: [] } },
      blur: async () => { throw original },
    })
    const images = await h.module('src/features/locations/location-image-selection')
    const image = await images.preparePendingLocationImage(new File(['x'], 'private.jpg', { type: 'image/jpeg' }), { id: 'image', isCover: true, originalIndex: 0, target: 'cover' })
    URL.revokeObjectURL(image.previewUrl)
    assert.equal(image.status, 'pending')
    assert.equal(image.errorMessage, null)
    assert.equal(h.events.length, 1)
    assert.equal(h.events[0].scope.tags.stage, stage)
    assert.equal(h.events[0].error, original)
    assert.equal(h.events[0].scope.contexts.admin_operation.fallback_used, true)
  }
})

test('update relation failure records partial after confirmed principal write', async () => {
  const h = await harness({ query: call => call.table === 'location_features' && call.method === 'insert' ? { error: { code: '23503', message: 'failed' } } : successQuery(call) })
  const service = await h.module('src/features/locations/locations.service')
  const form = await h.formHandlers({ mode: 'edit', locationId, updateLocation: () => service.updateLocation(locationId, payload, { correlationId }) })
  await form.handleSubmit(event)
  assert.equal(h.events.length, 1)
  assert.equal(h.events[0].scope.tags.operation, 'location.update')
  assert.equal(h.events[0].scope.tags.outcome, 'partial')
  assert.equal(h.events[0].scope.tags.stage, 'relations.features')
  assert.ok(h.events[0].scope.contexts.admin_operation.confirmed_stages.includes('location.update'))
})

test('automatic event is sanitized without labelling it a location operation', async () => {
  const h = await harness()
  const sanitized = h.reporting.sanitizeAdminSentryEvent({ type: undefined, level: 'error', exception: { values: [{ type: 'TypeError', value: 'private name' }] }, request: { data: 'password' } })
  assert.equal(sanitized.tags, undefined)
  assert.equal(sanitized.exception.values[0].type, 'TypeError')
  assert.equal(sanitized.request, undefined)
})

test('real SDK with mocked transport sends a sanitized handled event and linked stack', async () => {
  const Sentry = await import('@sentry/react')
  const h = await harness()
  const envelopes = []
  Sentry.init({
    dsn: 'https://public@example.invalid/1',
    enabled: true,
    sendDefaultPii: false,
    environment: 'test',
    release: 'test-fixture',
    beforeSend: h.reporting.sanitizeAdminSentryEvent,
    transport: () => ({ send: async envelope => { envelopes.push(envelope); return { statusCode: 200 } }, flush: async () => true }),
  })
  try {
    const report = h.reporting.createAdminErrorReporter(Sentry)
    const original = new Error('private@example.com / private-photo.jpg / secret-token')
    report(new Error('Private owner at private address', { cause: original }), { ...observation, resourceId: locationId })
    await Sentry.flush(2000)
    const sent = envelopes.flatMap(envelope => envelope[1]).filter(item => item[0].type === 'event')
    assert.equal(sent.length, 1)
    const serialized = JSON.stringify(sent[0][1])
    for (const secret of ['private@example.com', 'private-photo.jpg', 'secret-token', 'Private owner', 'private address']) assert.equal(serialized.includes(secret), false)
    assert.equal(sent[0][1].tags.operation, 'location.create')
    assert.equal(sent[0][1].contexts.admin_operation.location_id, locationId)
    assert.ok(sent[0][1].exception.values.some(value => value.stacktrace?.frames?.length))
  } finally {
    await Sentry.close(2000)
  }
})

test('unsupported file validation and its wrapper produce zero events', async () => {
  const h = await harness()
  const constants = await h.module('src/features/images/image-upload.constants')
  assert.throws(() => constants.assertSupportedImageFile({ name: 'private.doc', type: 'application/msword' }), error => {
    h.reporting.reportAdminError(new Error('UI wrapper', { cause: error }), observation)
    return true
  })
  assert.equal(h.events.length, 0)
})
