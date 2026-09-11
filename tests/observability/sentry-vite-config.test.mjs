import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('vite Sentry sourcemaps require release and private upload credentials', async () => {
  const source = await fs.readFile('vite.config.ts', 'utf8')
  assert.match(source, /VERCEL_GIT_COMMIT_SHA/)
  assert.match(source, /VITE_APP_RELEASE/)
  assert.match(source, /SENTRY_AUTH_TOKEN/)
  assert.match(source, /SENTRY_ORG/)
  assert.match(source, /SENTRY_PROJECT/)
  assert.match(source, /build:\s*{\s*sourcemap:\s*shouldUploadSentrySourceMaps/s)
  assert.match(source, /sentryVitePlugin\(/)
  assert.match(source, /filesToDeleteAfterUpload:\s*'\.\/dist\/assets\/\*\*\/\*\.map'/)
})
