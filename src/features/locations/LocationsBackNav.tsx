import { useNavigate } from 'react-router-dom'
import { routePaths } from '../../app/router/route-paths'

function ArrowLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="m15 18-6-6 6-6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LocationsBackNav() {
  const navigate = useNavigate()

  function handleGoBack() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate(routePaths.locations)
  }

  return (
    <div className="flex flex-wrap items-center">
      <button
        type="button"
        onClick={handleGoBack}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
      >
        <ArrowLeftIcon />
        Volver a locaciones
      </button>
    </div>
  )
}

export default LocationsBackNav
