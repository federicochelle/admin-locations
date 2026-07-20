import { NavLink } from 'react-router-dom'
import { routePaths } from '../../app/router/route-paths'
import { navigationItems } from '../../constants/navigation'
import logo from '../../../logo.webp'

function Sidebar() {
  return (
    <aside
      className="border-b border-white/10 text-slate-100 md:fixed md:inset-y-0 md:left-0 md:w-72 md:overflow-y-auto md:border-b-0 md:border-r"
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

        <nav className="flex gap-2 overflow-x-auto px-4 py-4 md:flex-1 md:flex-col md:overflow-x-visible md:overflow-y-visible">
          {navigationItems.map((item) => {
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
          })}
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar
