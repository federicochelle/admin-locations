import Button from '../../components/ui/Button'

type LocationZoneQuickCreateModalProps = {
  departmentName: string
  errorMessage: string | null
  isOpen: boolean
  isSubmitting: boolean
  name: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

function FieldLabel({
  children,
  htmlFor,
  required = false,
}: {
  children: string
  htmlFor: string
  required?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-slate-700">
      {children}
      {required ? <span className="text-slate-500"> *</span> : null}
    </label>
  )
}

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function LocationZoneQuickCreateModal({
  departmentName,
  errorMessage,
  isOpen,
  isSubmitting,
  name,
  onChange,
  onClose,
  onSubmit,
}: LocationZoneQuickCreateModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-zone-modal-title"
        className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <form className="space-y-6" onSubmit={onSubmit}>
          <div>
            <h2
              id="quick-zone-modal-title"
              className="text-2xl font-semibold tracking-tight text-slate-950"
            >
              Nueva zona
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Departamento: <span className="font-medium text-slate-900">{departmentName}</span>
            </p>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div>
            <FieldLabel htmlFor="quick-zone-name" required>
              Nombre
            </FieldLabel>
            <input
              id="quick-zone-name"
              name="name"
              className={inputClassName()}
              value={name}
              onChange={onChange}
              required
            />
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando zona...' : 'Crear zona'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LocationZoneQuickCreateModal
