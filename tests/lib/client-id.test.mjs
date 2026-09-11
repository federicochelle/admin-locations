import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

async function loadClientId(contextOverrides = {}) {
  const context = vm.createContext({
    Date,
    Math,
    Uint8Array,
    ...contextOverrides,
  })
  const source = await fs.readFile('src/lib/client-id.ts', 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023,
    },
  }).outputText
  const mod = new vm.SourceTextModule(output, { context })

  await mod.link(() => {
    throw new Error('Unexpected import')
  })
  await mod.evaluate()

  return mod.namespace
}

test('createClientUuid uses crypto.randomUUID when available', async () => {
  const { createClientUuid } = await loadClientId({
    crypto: {
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
    },
  })

  assert.equal(createClientUuid(), '11111111-1111-4111-8111-111111111111')
})

test('createClientUuid falls back to getRandomValues when randomUUID is absent', async () => {
  const { createClientUuid } = await loadClientId({
    crypto: {
      getRandomValues(bytes) {
        for (let index = 0; index < bytes.length; index += 1) {
          bytes[index] = index
        }

        return bytes
      },
    },
  })
  const id = createClientUuid()

  assert.match(id, UUID_V4_PATTERN)
  assert.equal(id, '00010203-0405-4607-8809-0a0b0c0d0e0f')
})

test('createClientUuid returns a UUID v4 without Web Crypto', async () => {
  const { createClientUuid } = await loadClientId({
    Date: { now: () => 1700000000000 },
    Math: { floor: Math.floor, random: () => 0.5 },
  })

  assert.match(createClientUuid(), UUID_V4_PATTERN)
})
