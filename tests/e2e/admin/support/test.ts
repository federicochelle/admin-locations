import { test as base, expect } from '@playwright/test'
import { AdminApp } from './app'
import { DiagnosticsTracker } from './diagnostics'

type Fixtures = {
  app: AdminApp
  diagnostics: DiagnosticsTracker
}

export const test = base.extend<Fixtures>({
  diagnostics: [async ({ page }, use) => {
    const diagnostics = new DiagnosticsTracker(page)
    diagnostics.start()
    await use(diagnostics)
    await diagnostics.assertNoUnexpectedIssues()
  }, { auto: true }],
  app: async ({ page }, use) => {
    await use(new AdminApp(page))
  },
})

export { expect }
