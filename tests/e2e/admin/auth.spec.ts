import { adminReadOnlyRoutes } from './support/app'
import { hasAdminCredentials, loginAsAdmin, logoutFromSidebar } from './support/auth'
import { expect, test } from './support/test'

test.describe('Admin smoke autenticado', () => {
  test.skip(
    !hasAdminCredentials(),
    'Faltan PLAYWRIGHT_ADMIN_EMAIL y/o PLAYWRIGHT_ADMIN_PASSWORD para ejecutar login real.',
  )

  test('login real, persistencia, navegación principal read-only y logout', async ({ app, page }) => {
    await loginAsAdmin(page)
    await app.expectDashboardReady()

    await page.reload()
    await app.expectDashboardReady()

    for (const route of adminReadOnlyRoutes) {
      await app.openSidebarRoute(route)
    }

    await logoutFromSidebar(page)
    await app.expectLoginPage()

    await app.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
    await app.expectLoginPage()
  })
})
