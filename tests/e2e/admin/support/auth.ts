import { expect, type Page } from '@playwright/test'
import { AdminApp } from './app'

const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL?.trim() || ''
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD?.trim() || ''

export function hasAdminCredentials() {
  return adminEmail.length > 0 && adminPassword.length > 0
}

export async function loginAsAdmin(page: Page) {
  const app = new AdminApp(page)

  if (!hasAdminCredentials()) {
    throw new Error(
      'Faltan PLAYWRIGHT_ADMIN_EMAIL o PLAYWRIGHT_ADMIN_PASSWORD para ejecutar login real.',
    )
  }

  await app.goto('/login')
  await app.expectLoginPage()
  await page.getByLabel('Email', { exact: true }).fill(adminEmail)
  await page.getByLabel('Contraseña', { exact: true }).fill(adminPassword)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await app.expectDashboardReady()
  await expect.poll(() => hasPersistedSupabaseSession(page)).toBe(true)
}

export async function logoutFromSidebar(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect.poll(() => hasPersistedSupabaseSession(page)).toBe(false)
}

async function hasPersistedSupabaseSession(page: Page) {
  return await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (!key.startsWith('sb-') || !key.includes('auth-token')) {
        continue
      }

      const rawValue = window.localStorage.getItem(key)

      if (!rawValue) {
        continue
      }

      try {
        const parsedValue = JSON.parse(rawValue) as {
          access_token?: string
          currentSession?: { access_token?: string } | null
        }

        if (
          typeof parsedValue.access_token === 'string' ||
          typeof parsedValue.currentSession?.access_token === 'string'
        ) {
          return true
        }
      } catch {
        continue
      }
    }

    return false
  })
}
