import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
import { harness } from './harness.mjs'

const formSource = await fs.readFile('src/features/locations/LocationForm.tsx', 'utf8')
const formAst = ts.createSourceFile('form.tsx', formSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const gridSource = await fs.readFile('src/features/locations/LocationImagesGrid.tsx', 'utf8')
const gridAst = ts.createSourceFile('grid.tsx', gridSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function nodes(ast, predicate) {
  const result = []
  function visit(node) {
    if (predicate(node)) result.push(node)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return result
}
function run(source, context) {
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React,
  } }).outputText
  return vm.runInContext(output, context)
}
function findElement(element, predicate) {
  if (!element || typeof element !== 'object') return undefined
  if (predicate(element)) return element
  for (const child of [element.props?.children].flat(Infinity)) {
    const match = findElement(child, predicate)
    if (match) return match
  }
}

for (const target of ['cover', 'gallery']) test(`create ${target}: enabled blur button opens editor; confirm replaces file and save uploads it`, async t => {
  const h = await harness()
  const original = new File(['optimized original'], 'image.jpg', { type: 'image/jpeg' })
  const blurred = new File(['manually blurred'], 'image.jpg', { type: 'image/jpeg' })
  const pending = { id: target, file: original, width: 10, height: 20, status: 'pending',
    originalIndex: 0, isCover: target === 'cover', previewUrl: 'blob:original' }
  let uploads = 0
  const form = await h.formHandlers({ pendingImages: [pending], uploadLocationImage: async ({ file }) => {
    uploads++
    assert.equal(file, blurred)
  } })
  Object.assign(h.context, {
    React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
    useRef: value => ({ current: value }), useState: value => [value, () => {}],
    ImageLightbox: () => null,
    LOCATION_TOP_STACK_PANEL_HEIGHT_CLASS: '', LOCATION_TOP_STACK_PANEL_SURFACE_CLASS: '',
    pendingCoverImage: pending, pendingGalleryImages: [pending], isSubmitting: false,
    LocationImageUploader: () => null, coverImageUploaderRef: { current: null },
    isPreparingImages: false, isDropboxImporting: false,
    handleCoverImageSelected() {}, handleOpenImageSourceModal() {},
    handleRemovePendingImage() {}, handleSetCoverImage() {},
    manualBlurLoadingImageId: null, manualBlurTarget: null,
    setManualBlurTarget: value => { h.context.manualBlurTarget = value },
    setManualBlurErrorMessage: value => { assert.equal(value, null) },
    pendingImagesRef: { current: [pending] },
    setIsApplyingManualBlur() {},
    applyBlurStrokesToImage: async (file, strokes) => {
      assert.equal(file, original)
      assert.equal(strokes.length, 1)
      return blurred
    },
  })
  // Evaluate the real grid and nested form handlers, with external dependencies mocked.
  run(gridAst.statements.filter(node => !ts.isImportDeclaration(node) && !ts.isExportAssignment(node))
    .map(node => node.getText(gridAst)).join('\n'), h.context)
  run(nodes(formAst, node => ts.isFunctionDeclaration(node) &&
    ['handleOpenManualBlur', 'handleApplyManualBlur'].includes(node.name?.text))
    .map(node => node.getText(formAst)).join('\n'), h.context)
  const grids = nodes(formAst, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(formAst) === 'LocationImagesGrid')
  const grid = grids.find(node => node.attributes.properties.some(prop =>
    prop.name?.getText(formAst) === 'images' && prop.initializer.getText(formAst) ===
      (target === 'cover' ? '{pendingCoverImage ? [pendingCoverImage] : []}' : '{pendingGalleryImages}')))
  assert.ok(grid)
  const props = run(`(${grid.getText(formAst)})`, h.context).props
  const rendered = h.context.LocationImagesGrid(props)
  const button = findElement(rendered, element => element.type === 'button' && element.props['aria-label'] === 'Aplicar blur manual')
  assert.ok(button)
  assert.equal(button.props.disabled, false)
  button.props.onClick({ stopPropagation() {} })
  assert.equal(h.context.manualBlurTarget.kind, 'pending')
  assert.equal(h.context.manualBlurTarget.imageId, target)

  // The form renders the editor from this target and wires its confirmation to onApply.
  const modal = nodes(formAst, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(formAst) === 'LocationManualBlurModal')[0]
  Object.assign(h.context, { LocationManualBlurModal: () => null, manualBlurErrorMessage: null,
    isApplyingManualBlur: false, handleCloseManualBlurModal() {} })
  const modalProps = run(`(${modal.getText(formAst)})`, h.context).props
  assert.equal(modalProps.isOpen, true)
  assert.equal(modalProps.image.file, original)
  const modalSource = await fs.readFile('src/features/locations/LocationManualBlurModal.tsx', 'utf8')
  const modalAst = ts.createSourceFile('modal.tsx', modalSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  Object.assign(h.context, { image: modalProps.image, isApplying: false, isPreparing: false,
    strokes: [{ points: [{ x: 1, y: 1 }], radius: 5 }], onApply: modalProps.onApply })
  run(nodes(modalAst, node => ts.isFunctionDeclaration(node) && node.name?.text === 'handleConfirm')
    .map(node => node.getText(modalAst)).join('\n'), h.context)
  await h.context.handleConfirm()
  assert.equal(form.state.pending[0].file, blurred)
  assert.equal(h.context.manualBlurTarget, null)
  const blurredPreviewUrl = form.state.pending[0].previewUrl
  t.after(() => URL.revokeObjectURL(blurredPreviewUrl))
  // Simulate the next React render before submitting.
  h.context.pendingImages = form.state.pending
  await form.handleSubmit({ preventDefault() {} })
  assert.equal(form.state.submitError, null)
  assert.equal(uploads, 1)
})
