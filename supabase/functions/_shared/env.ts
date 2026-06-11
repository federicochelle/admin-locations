import { HttpError } from './http.ts'

export function hasEnv(name: string) {
  return Boolean(Deno.env.get(name))
}

export function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)

  if (!value) {
    throw new HttpError(500, `Missing required environment variable: ${name}`)
  }

  return value
}
