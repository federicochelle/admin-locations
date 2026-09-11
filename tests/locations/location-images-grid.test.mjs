import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children,
    },
  }
}

function runGrid(source, context) {
  const ast = ts.createSourceFile(
    'LocationImagesGrid.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const body = ast.statements
    .filter(
      (node) =>
        !ts.isImportDeclaration(node) &&
        !ts.isExportAssignment(node),
    )
    .map((node) => node.getText(ast))
    .join('\n')
  const output = ts.transpileModule(body, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2023,
    },
  }).outputText

  vm.runInContext(output, context)
}

function findAll(element, predicate, matches = []) {
  if (!element || typeof element !== 'object') {
    return matches
  }

  if (predicate(element)) {
    matches.push(element)
  }

  for (const child of [element.props?.children].flat(Infinity)) {
    findAll(child, predicate, matches)
  }

  return matches
}

function pendingErrorImage(id, retryable) {
  return {
    id,
    file: new File(['image'], `${id}.jpg`, { type: 'image/jpeg' }),
    previewUrl: `blob:${id}`,
    width: 0,
    height: 0,
    originalIndex: 0,
    isCover: false,
    selectionTarget: 'gallery',
    status: 'error',
    errorMessage: 'No pudimos preparar la imagen.',
    retryable,
  }
}

test('LocationImagesGrid shows retry only for explicitly retryable pending image errors', async () => {
  const source = await fs.readFile(
    'src/features/locations/LocationImagesGrid.tsx',
    'utf8',
  )
  const context = vm.createContext({
    React: { createElement },
    useRef: (value) => ({ current: value }),
    useState: (value) => [value, () => {}],
    ImageLightbox: () => null,
    LOCATION_TOP_STACK_PANEL_HEIGHT_CLASS: '',
    LOCATION_TOP_STACK_PANEL_SURFACE_CLASS: '',
    window: { setTimeout },
  })

  runGrid(source, context)

  const rendered = context.LocationImagesGrid({
    images: [
      pendingErrorImage('retryable', true),
      pendingErrorImage('permanent', false),
      pendingErrorImage('unknown', undefined),
    ],
    mode: 'pending',
    onRetry: () => {},
    showCover: false,
  })
  const retryButtons = findAll(
    rendered,
    (element) =>
      element.type === 'button' &&
      [element.props?.children].flat(Infinity).includes('Reintentar'),
  )

  assert.equal(retryButtons.length, 1)
})
