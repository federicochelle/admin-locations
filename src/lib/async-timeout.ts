import type { AdminErrorContext } from './admin-error-reporting'

type RunWithAdminTimeoutOptions<T> = {
  action: () => Promise<T>
  cleanupLateResult?: (value: T) => void
  message: string
  provider: AdminErrorContext['provider']
  stage: NonNullable<AdminErrorContext['stage']>
  timeoutMs: number
}

export class AdminOperationTimeoutError extends Error {
  provider: AdminErrorContext['provider']
  stage: NonNullable<AdminErrorContext['stage']>
  timeoutMs: number

  constructor({
    message,
    provider,
    stage,
    timeoutMs,
  }: Omit<RunWithAdminTimeoutOptions<unknown>, 'action'>) {
    super(message)
    this.name = 'AdminOperationTimeoutError'
    this.provider = provider
    this.stage = stage
    this.timeoutMs = timeoutMs
  }
}

export function isAdminOperationTimeoutError(error: unknown): error is AdminOperationTimeoutError {
  return error instanceof AdminOperationTimeoutError
}

export async function runWithAdminTimeout<T>({
  action,
  cleanupLateResult,
  message,
  provider,
  stage,
  timeoutMs,
}: RunWithAdminTimeoutOptions<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  const actionPromise = action()

  actionPromise.then(
    (value) => {
      if (timedOut) {
        cleanupLateResult?.(value)
      }
    },
    () => {},
  )

  try {
    return await Promise.race([
      actionPromise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true
          reject(new AdminOperationTimeoutError({ message, provider, stage, timeoutMs }))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}
