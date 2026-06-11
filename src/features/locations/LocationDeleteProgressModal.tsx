type LocationDeleteProgressModalProps = {
  isOpen: boolean
}

function LocationDeleteProgressModal({
  isOpen,
}: LocationDeleteProgressModalProps) {
  console.log('DELETE MODAL IS OPEN', isOpen)

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-delete-progress-title"
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 animate-pulse items-center justify-center rounded-full bg-slate-900 text-white"
            >
              <span className="h-3 w-3 rounded-full bg-white" />
            </span>
            <div>
              <h2
                id="location-delete-progress-title"
                className="text-2xl font-semibold tracking-tight text-slate-950"
              >
                Eliminando locación...
              </h2>
            </div>
          </div>

          <p className="text-sm leading-6 text-slate-600">
            Estamos eliminando la locación y sus imágenes asociadas.
          </p>
        </div>
      </div>
    </div>
  )
}

export default LocationDeleteProgressModal
