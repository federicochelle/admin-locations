import { expect, type Page } from '@playwright/test'

type DiagnosticsIssue =
  | {
      kind: 'console-error'
      message: string
      url: string
    }
  | {
      kind: 'page-error'
      message: string
    }
  | {
      kind: 'request-failed'
      failureText: string
      method: string
      resourceType: string
      url: string
    }
  | {
      kind: 'response-5xx'
      method: string
      status: number
      url: string
    }

const EXTENSION_PROTOCOLS = ['chrome-extension://', 'moz-extension://', 'safari-web-extension://']

function isIgnorableUrl(url: string) {
  if (!url) {
    return false
  }

  if (EXTENSION_PROTOCOLS.some((protocol) => url.startsWith(protocol))) {
    return true
  }

  try {
    const parsedUrl = new URL(url)
    return parsedUrl.pathname === '/favicon.ico'
  } catch {
    return url.endsWith('/favicon.ico')
  }
}

function formatIssue(issue: DiagnosticsIssue) {
  switch (issue.kind) {
    case 'console-error':
      return `[console.error] ${issue.message} (${issue.url})`
    case 'page-error':
      return `[pageerror] ${issue.message}`
    case 'request-failed':
      return `[requestfailed] ${issue.method} ${issue.url} (${issue.resourceType}) ${issue.failureText}`
    case 'response-5xx':
      return `[response:${issue.status}] ${issue.method} ${issue.url}`
  }
}

export class DiagnosticsTracker {
  private readonly issues: DiagnosticsIssue[] = []
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  start() {
    this.page.on('pageerror', (error) => {
      this.issues.push({
        kind: 'page-error',
        message: error.stack || error.message,
      })
    })

    this.page.on('console', (message) => {
      if (message.type() !== 'error') {
        return
      }

      const location = message.location()
      const url = location.url || this.page.url()

      if (isIgnorableUrl(url)) {
        return
      }

      this.issues.push({
        kind: 'console-error',
        message: message.text(),
        url,
      })
    })

    this.page.on('requestfailed', (request) => {
      const url = request.url()

      if (isIgnorableUrl(url)) {
        return
      }

      this.issues.push({
        kind: 'request-failed',
        failureText: request.failure()?.errorText || 'Unknown request failure',
        method: request.method(),
        resourceType: request.resourceType(),
        url,
      })
    })

    this.page.on('response', (response) => {
      if (response.status() < 500) {
        return
      }

      const url = response.url()

      if (isIgnorableUrl(url)) {
        return
      }

      this.issues.push({
        kind: 'response-5xx',
        method: response.request().method(),
        status: response.status(),
        url,
      })
    })
  }

  async assertNoUnexpectedIssues() {
    await expect(
      this.issues.map(formatIssue),
      this.issues.length === 0
        ? 'No se registraron errores inesperados.'
        : `Se registraron errores inesperados:\n${this.issues.map(formatIssue).join('\n')}`,
    ).toEqual([])
  }
}
