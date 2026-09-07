import { expect, type Locator, type Page } from '@playwright/test'

export const anonymousGuardPaths = [
  '/dashboard',
  '/locations',
  '/users',
  '/settings',
] as const

export type AppRouteExpectation = {
  path: string
  sidebarLabel: string
  readySignals: Array<() => Locator>
  postVisit?: (page: Page) => Promise<void>
}

const loadingMessagePattern = /Cargando .*\.{3}|Verificando (sesión|permisos)\.\.\./i

export const adminReadOnlyRoutes: AppRouteExpectation[] = [
  {
    path: '/locations',
    sidebarLabel: 'Locaciones',
    readySignals: [
      () => heading('Listado de locaciones'),
      () => heading('Todavia no hay locaciones cargadas.'),
      () => heading('No se encontraron locaciones.'),
    ],
  },
  {
    path: '/categories',
    sidebarLabel: 'Categorías',
    readySignals: [
      () => heading('Listado de categorías'),
      () => heading('Todavía no hay categorías cargadas'),
    ],
  },
  {
    path: '/owners',
    sidebarLabel: 'Dueños',
    readySignals: [
      () => heading('Listado de dueños'),
      () => heading('Todavía no hay dueños cargados'),
    ],
  },
  {
    path: '/reservations',
    sidebarLabel: 'Reservas',
    readySignals: [() => heading('Listado de reservas')],
    postVisit: async (page) => {
      await page.getByRole('button', { name: 'Lista' }).click()
    },
  },
  {
    path: '/users',
    sidebarLabel: 'Usuarios',
    readySignals: [
      () => heading('Listado de usuarios'),
      () => heading('Todavía no hay usuarios visibles'),
    ],
  },
  {
    path: '/settings',
    sidebarLabel: 'Configuración',
    readySignals: [
      () => heading('Conexiones'),
      () => heading('Todavía no hay conexiones visibles'),
    ],
  },
]

function heading(name: string) {
  return globalThis.__playwrightPage!.getByRole('heading', { name, exact: true })
}

async function expectAnyVisible(signals: Array<() => Locator>) {
  for (const createLocator of signals) {
    const locator = createLocator()
    try {
      await expect(locator).toBeVisible({ timeout: 10_000 })
      return
    } catch {
      continue
    }
  }

  throw new Error('Ninguna señal estable del repo quedó visible para esta ruta.')
}

async function waitForLoadersToDisappear(page: Page) {
  const loadingIndicators = page.getByText(loadingMessagePattern)
  const indicatorCount = await loadingIndicators.count()

  if (indicatorCount === 0) {
    return
  }

  await expect(loadingIndicators.first()).toBeHidden({ timeout: 15_000 })
}

declare global {
  var __playwrightPage: Page | undefined
}

export class AdminApp {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
    globalThis.__playwrightPage = page
  }

  async goto(path: string) {
    await this.page.goto(path)
  }

  async expectLoginPage() {
    await expect(this.page).toHaveURL(/\/login$/)
    await expect(
      this.page.getByRole('heading', { name: 'INICIAR SESIÓN', exact: true }),
    ).toBeVisible()
    await expect(this.page.getByLabel('Email', { exact: true })).toBeVisible()
    await expect(this.page.getByLabel('Contraseña', { exact: true })).toBeVisible()
  }

  async expectDashboardReady() {
    await expect(this.page).toHaveURL(/\/dashboard$/)
    await expectAnyVisible([
      () => this.page.getByRole('heading', { name: 'Solicitudes pendientes', exact: true }),
      () => this.page.getByRole('heading', { name: 'Próximas reservas', exact: true }),
      () => this.page.getByRole('heading', { name: 'Actividad reciente', exact: true }),
    ])
    await waitForLoadersToDisappear(this.page)
  }

  async expectAnonymousRedirect(path: string) {
    await this.goto(path)
    await this.expectLoginPage()
    await this.page.reload()
    await this.expectLoginPage()
  }

  async openSidebarRoute(route: AppRouteExpectation) {
    await this.page.getByRole('link', { name: route.sidebarLabel, exact: true }).click()
    await expect(this.page).toHaveURL(new RegExp(`${route.path.replace('/', '\\/')}$`))

    if (route.postVisit) {
      await route.postVisit(this.page)
    }

    await expectAnyVisible(route.readySignals.map((createSignal) => () => {
      globalThis.__playwrightPage = this.page
      return createSignal()
    }))
    await waitForLoadersToDisappear(this.page)
  }
}
