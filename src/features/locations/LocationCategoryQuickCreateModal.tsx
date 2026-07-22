import Button from '../../components/ui/Button'

type LocationCategoryQuickCreateModalProps = {
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

function LocationCategoryQuickCreateModal({
  errorMessage,
  isOpen,
  isSubmitting,
  name,
  onChange,
  onClose,
  onSubmit,
}: LocationCategoryQuickCreateModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/35 px-4 py-4 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-category-modal-title"
        className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <form className="space-y-6" onSubmit={onSubmit}>
          <div>
            <h2
              id="quick-category-modal-title"
              className="text-2xl font-semibold tracking-tight text-slate-950"
            >
              Nueva categoría
            </h2>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div>
            <FieldLabel htmlFor="quick-category-name" required>
              Nombre
            </FieldLabel>
            <input
              id="quick-category-name"
              name="name"
              className={inputClassName()}
              value={name}
              onChange={onChange}
              required
            />
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando categoría...' : 'Crear categoría'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LocationCategoryQuickCreateModal
