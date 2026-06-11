import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { routePaths } from '../../app/router/route-paths'
import { getCurrentSession, signIn } from './auth.service'
import logo from '../../../logo.webp'

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    let isActive = true

    void getCurrentSession()
      .then((session) => {
        if (!isActive) {
          return
        }

        setHasSession(Boolean(session))
      })
      .catch(() => {
        if (!isActive) {
          return
        }

        setHasSession(false)
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsCheckingSession(false)
      })

    return () => {
      isActive = false
    }
  }, [])

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

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6">
        <p className="text-sm text-slate-300">Verificando sesión...</p>
      </div>
    )
  }

  if (hasSession) {
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
              className="h-auto w-full max-w-md"
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
                  <input
                    id="password"
                    type="password"
                    className={inputClassName()}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
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
