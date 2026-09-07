import { randomUUID } from 'node:crypto'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const suppliedRelease = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VITE_APP_RELEASE
if (suppliedRelease && !/^[a-f0-9]{7,64}$/.test(suppliedRelease)) throw new Error('Build release must be a commit SHA')
if (process.env.VERCEL === '1' && !suppliedRelease) throw new Error('Vercel build requires VERCEL_GIT_COMMIT_SHA or VITE_APP_RELEASE')
// Local builds/testing only; never a production release on Vercel.
const release = suppliedRelease || `local-${randomUUID().replaceAll('-', '')}`

export default defineConfig({
  define: { 'import.meta.env.VITE_APP_RELEASE': JSON.stringify(release) },
  plugins: [react(), tailwindcss(), {
    name: 'admin-build-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: release }) })
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Cache-Control', 'no-store')
        response.end(JSON.stringify({ version: release }))
      })
    },
  }],
})
