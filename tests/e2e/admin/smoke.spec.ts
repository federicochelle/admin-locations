import { anonymousGuardPaths } from './support/app'
import { expect, test } from './support/test'

test.describe('Admin smoke sin sesión', () => {
  test('login carga con formulario real y validaciones locales básicas', async ({ app, page }) => {
    await app.goto('/login')
    await app.expectLoginPage()

    const emailInput = page.getByLabel('Email', { exact: true })
    const passwordInput = page.getByLabel('Contraseña', { exact: true })
    const submitButton = page.getByRole('button', { name: 'Ingresar', exact: true })

    await submitButton.click()
    await expect(emailInput).toBeFocused()
    await expect(
      await emailInput.evaluate(
        (input) => (input as HTMLInputElement).checkValidity(),
      ),
    ).toBe(false)

    await emailInput.fill('admin-invalido')
    await passwordInput.fill('x')
    await submitButton.click()

    await expect(
      await emailInput.evaluate(
        (input) => (input as HTMLInputElement).checkValidity(),
      ),
    ).toBe(false)
    await expect(page).toHaveURL(/\/login$/)
  })

  for (const guardedPath of anonymousGuardPaths) {
    test(`guard anónimo redirige ${guardedPath} hacia /login incluso tras reload directo`, async ({ app }) => {
      await app.expectAnonymousRedirect(guardedPath)
    })
  }
})
