import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { routePaths } from '../../app/router/route-paths'
import { navigationItems } from '../../constants/navigation'
import useAuth from '../../features/auth/useAuth'
import logo from '../../../logo.webp'

function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  async function handleSignOut() {
    try {
      await signOut()
    } finally {
      navigate(routePaths.login)
    }
  }

  function renderNavigationItems() {
    return navigationItems.map((item) => {
      if (item.type === 'divider') {
        return (
          <div
            key={item.label}
            aria-hidden="true"
            className="mx-4 hidden h-px bg-white/10 md:block"
          />
        )
      }

      const icon = item.icon

      if (item.disabled || !item.to || !icon) {
        return (
          <div
            key={item.label}
            className="flex min-w-fit items-center gap-3 rounded-xl border-l-[3px] border-l-transparent px-4 py-3 text-sm font-medium text-slate-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              width={18}
              height={18}
              aria-hidden="true"
              className="text-slate-600"
            >
              {icon?.paths.map((path) => (
                <path
                  key={path}
                  d={path}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {icon?.circle ? (
                <circle
                  cx={icon.circle.cx}
                  cy={icon.circle.cy}
                  r={icon.circle.r}
                  strokeWidth="1.8"
                />
              ) : null}
            </svg>
            <span>{item.label}</span>
          </div>
        )
      }

      return (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            [
              'flex min-w-fit items-center gap-3 rounded-xl border-l-[3px] px-4 py-3 text-sm font-medium transition',
              isActive
                ? 'border-l-[#B8924A] bg-white/8 text-white'
                : 'border-l-transparent text-slate-200 hover:bg-white/4 hover:text-white',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                width={18}
                height={18}
                aria-hidden="true"
                className={isActive ? 'text-[#B8924A]' : 'text-slate-400'}
              >
                {icon.paths.map((path) => (
                  <path
                    key={path}
                    d={path}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {icon.circle ? (
                  <circle
                    cx={icon.circle.cx}
                    cy={icon.circle.cy}
                    r={icon.circle.r}
                    strokeWidth="1.8"
                  />
                ) : null}
              </svg>
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      )
    })
  }

  return (
    <>
      <div
        className="border-b border-white/10 text-slate-100 md:hidden"
        style={{
          backgroundColor: '#000000',
          backgroundImage:
            'radial-gradient(circle at top left, rgba(184,146,74,.10), transparent 35%), linear-gradient(180deg, #000000 0%, #050505 100%)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <NavLink
            to={routePaths.dashboard}
            aria-label="Ir al inicio"
            className="rounded-xl outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#B8924A] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <img src={logo} alt="Logo" className="h-auto w-full max-w-[74px]" />
          </NavLink>

          <button
            type="button"
            aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((currentValue) => !currentValue)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8924A] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              {isMobileMenuOpen ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px] md:hidden"
        />
      ) : null}

      <aside
        className={[
          'fixed inset-y-0 right-0 z-50 w-80 max-w-[88vw] overflow-y-auto border-l border-white/10 text-slate-100 transition-transform duration-300 md:left-0 md:right-auto md:w-72 md:border-l-0 md:border-r',
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full',
          'md:translate-x-0',
        ].join(' ')}
        style={{
          backgroundColor: '#000000',
          backgroundImage:
            'radial-gradient(circle at top left, rgba(184,146,74,.10), transparent 35%), linear-gradient(180deg, #000000 0%, #050505 100%)',
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex justify-center border-b border-white/10 px-6 py-6">
            <NavLink
              to={routePaths.dashboard}
              aria-label="Ir al inicio"
              className="rounded-xl outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#B8924A] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <img src={logo} alt="Logo" className="h-auto w-full max-w-[90px]" />
            </NavLink>
          </div>

          <nav className="flex flex-col gap-2 px-4 py-4 md:flex-1">
            {renderNavigationItems()}
          </nav>

          <div className="mt-auto border-t border-white/10 p-4">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8924A] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
