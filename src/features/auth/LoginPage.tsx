import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { routePaths } from '../../app/router/route-paths'
import { signIn } from './auth.service'
import { hasActiveAdminAccess } from './auth-context'
import useAuth from './useAuth'
import logo from '../../../logo.webp'

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.7A3 3 0 0 0 13.4 13.5" />
      <path d="M9.9 5.2A11.2 11.2 0 0 1 12 5c6.5 0 10 7 10 7a17.2 17.2 0 0 1-4 4.8" />
      <path d="M6.6 6.7C4 8.5 2 12 2 12s3.5 6 10 6a10.7 10.7 0 0 0 4-.8" />
    </svg>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const { currentUser, isLoading, isProfileLoading, profile } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const hasAuthorizedAdminAccess = hasActiveAdminAccess(currentUser, profile)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setIsSubmitting(true)
      setErrorMessage(null)

      await signIn(email, password)
      navigate(routePaths.dashboard)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos iniciar sesión.'

      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || (currentUser && isProfileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6">
        <p className="text-sm text-slate-300">Verificando permisos...</p>
      </div>
    )
  }

  if (hasAuthorizedAdminAccess) {
    return <Navigate to={routePaths.dashboard} replace />
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-[#B8924A] bg-white shadow-sm lg:grid-cols-[1.1fr_0.9fr]">
          <section
            className="hidden items-center justify-center p-10 lg:flex"
            style={{
              backgroundColor: '#0f1723',
              backgroundImage:
                'radial-gradient(circle at top left, rgba(184,146,74,.08), transparent 35%), linear-gradient(180deg, #0b0f17 0%, #0f1723 100%)',
            }}
          >
            <img
              src={logo}
              alt="Film Locations UY"
              className="h-auto w-full max-w-[14rem]"
            />
          </section>

          <section
            className="p-8 sm:p-10"
            style={{
              backgroundColor: '#c9a35c',
              backgroundImage:
                'linear-gradient(180deg, #d4af68 0%, #c49b4f 100%)',
            }}
          >
            <div className="mx-auto w-full max-w-md">
              <h1 className="text-center text-3xl font-extrabold uppercase tracking-[0.12em] text-slate-950">
                INICIAR SESIÓN
              </h1>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-950"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className={inputClassName()}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-slate-950"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className={`${inputClassName()} pr-11`}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((currentValue) => !currentValue)}
                      className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-600 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                {errorMessage ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Ingresando...' : 'Ingresar'}
                </Button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default LoginPage
