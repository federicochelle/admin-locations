// Runs the real TypeScript modules/handlers with isolated mocked dependencies.
// No browser, credentials, API calls, or Sentry transport. No added dependencies.
import fs from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = process.cwd()
export const locationId = '11111111-1111-4111-8111-111111111111'
export const correlationId = '22222222-2222-4222-8222-222222222222'

export async function harness({ query, invoke, activityError, fetch, prepare, detect, blur } = {}) {
  const events = []
  const requests = []
  const context = vm.createContext({
    Error, TypeError, RangeError, DOMException, Response, Request, Headers,
    Blob, File, FormData, AbortController, URL, TextEncoder, crypto, setTimeout, clearTimeout,
    console: { warn() {}, error() {} },
    fetch: fetch ?? (() => { throw new Error('Unexpected fetch in test') }),
  })
  const sentry = {
    captureException(error, hint) { events.push({ kind: 'exception', error, scope: hint.captureContext }); return 'event-id' },
    captureMessage(message, scope) { events.push({ kind: 'message', message, scope }); return 'event-id' },
  }
  const supabase = {
    from(table) {
      const call = { table, method: 'select' }
      const builder = new Proxy({}, { get(_, key) {
        if (key === 'then') return (resolve, reject) => {
          requests.push(call)
          Promise.resolve().then(() => query?.(call) ?? { data: [], error: null }).then(resolve, reject)
        }
        return (...args) => {
          if (['insert', 'update', 'delete'].includes(key)) { call.method = key; call.payload = args[0] }
          return builder
        }
      } })
      return builder
    },
    functions: { invoke: async (name, options) => {
      requests.push({ name })
      if (!invoke) throw new Error('Unexpected Edge invocation in test')
      return invoke(name, options)
    } },
  }
  const mocks = new Map([
    ['@sentry/react', sentry],
    ['react', { useState: initial => [initial, () => {}], useEffect() {}, useRef: value => ({ current: value }) }],
    [path.join(root, 'src/features/images/image-upload.processor'), { prepareImageUploadFile: prepare ?? (async file => ({ file, outputDimensions: { width: 10, height: 20 } })) }],
    [path.join(root, 'src/features/locations/location-sensitive-content.service'), { detectLocationImageSensitiveContent: detect ?? (async () => ({ summary: { faces: 0 }, faces: [] })) }],
    [path.join(root, 'src/features/locations/location-face-blur'), { applyFaceBlurToImage: blur ?? (async file => file) }],
    [path.join(root, 'src/lib/supabase'), { getSupabaseClient: () => supabase }],
    [path.join(root, 'src/features/activity/activity-logs.service'), { createActivityLog: async () => { if (activityError) throw activityError } }],
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
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
    const mod = new vm.SourceTextModule(output, { context, identifier: filename, initializeImportMeta(meta) { meta.env = { VITE_APP_RELEASE: 'aaaaaaaa' } } })
    cache.set(key, mod)
    await mod.link((child, ref) => load(child, ref.identifier))
    return mod
  }
  async function module(file) {
    const mod = await load(path.join(root, file), root)
    if (mod.status !== 'evaluated') await mod.evaluate()
    return mod.namespace
  }
  const reporting = await module('src/lib/admin-error-reporting')
  async function formHandlers(overrides = {}) {
    // Extract actual nested handlers using the TS AST, not copied implementations.
    const source = await fs.readFile(path.join(root, 'src/features/locations/LocationForm.tsx'), 'utf8')
    const ast = ts.createSourceFile('LocationForm.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const names = new Set(['handleSubmit', 'runPendingImageUploads', 'runPendingImageDeletes', 'syncVisibleGallery'])
    const declarations = []
    function visit(node) {
      if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) declarations.push('export ' + node.getText(ast))
      ts.forEachChild(node, visit)
    }
    visit(ast)
    if (declarations.length !== 4) throw new Error('Expected actual LocationForm handlers')
    const state = { pending: [], submitError: null, navigation: [], validations: [], submitting: false, progress: null }
    const noop = () => {}
    Object.assign(context, reporting, {
      mode: 'create', isReadOnly: false, locationId: undefined, createdLocationIdRef: { current: null },
      values: { owner_id: 'existing-owner' }, ownerInputValue: '', ownerPhoneValue: '',
      profile: { id: 'actor' }, initialValues: {},
      validateRequiredFields: () => ({}), hasFieldErrors: errors => Boolean(errors.title),
      getValidationMessages: errors => Object.values(errors), setFieldErrors: noop,
      setSubmitError: value => { state.submitError = value },
      setValidationModalMessages: value => { state.validations = value },
      setIsSubmitting: value => { state.submitting = value }, setEditDeleteErrorMessage: noop,
      openSaveProgress: () => { state.progress = { stages: [], errorMessage: null } },
      updateStageStatus: noop,
      markSaveProgressSuccess: () => { state.progress.successMessage = 'saved' },
      setSaveProgress: value => { state.progress = value },
      updateSaveProgress: updater => { if (state.progress) state.progress = updater(state.progress) },
      setSaveProgressError: (_stage, message) => { state.progress.errorMessage = message },
      buildPayload: value => value, createLocation: async () => locationId,
      updateLocation: async () => locationId,
      pendingDeletedPersistedImageIds: [], visiblePersistedImages: [], pendingImages: state.pending,
      setPendingDeletedPersistedImageIds: noop,
      setPendingImages: updater => { state.pending = updater(state.pending) },
      updatePendingImage: (id, changes) => Object.assign(state.pending.find(image => image.id === id), changes),
      revokePreviewUrl: noop,
      locationImages: { refresh: async () => {}, hasRefreshError: () => false },
      protection: { markSaved() {}, markIncomplete() {} },
      wait: async () => {}, SAVE_SUCCESS_DELAY_MS: 0,
      IMAGE_UPLOAD_TIMEOUT_MS: 90000, IMAGE_UPLOAD_CONCURRENCY: 3,
      IMAGE_UPLOAD_TIMEOUT_ERROR_MESSAGE: 'Upload timeout',
      window: { setTimeout, clearTimeout, location: { pathname: '/locations/new' } },
      onCreateSuccess: undefined, onEditSuccess: undefined,
      routePaths: { locations: '/locations' }, getLocationEditPath: id => `/locations/${id}/edit`,
      navigate: path => state.navigation.push(path),
      reportLocationFailure: (error, observation) => reporting.reportAdminError(error, { userFacing: true, ...observation }),
      ...overrides,
    })
    if (overrides.pendingImages) state.pending = overrides.pendingImages
    const output = ts.transpileModule(declarations.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
    const mod = new vm.SourceTextModule(output, { context })
    await mod.link(() => { throw new Error('Unexpected handler import') })
    await mod.evaluate()
    return { ...mod.namespace, state }
  }
  return { events, requests, module, reporting, formHandlers, context }
}
