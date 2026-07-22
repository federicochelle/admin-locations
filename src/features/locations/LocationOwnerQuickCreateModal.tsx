import Button from '../../components/ui/Button'

export type LocationOwnerQuickCreateValues = {
  full_name: string
  company_name: string
  email: string
  phone: string
  notes: string
}

type LocationOwnerQuickCreateModalProps = {
  errorMessage: string | null
  isOpen: boolean
  isSubmitting: boolean
  values: LocationOwnerQuickCreateValues
  onChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void
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

function LocationOwnerQuickCreateModal({
  errorMessage,
  isOpen,
  isSubmitting,
  values,
  onChange,
  onClose,
  onSubmit,
}: LocationOwnerQuickCreateModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/35 px-4 py-4 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-owner-modal-title"
        className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <form className="space-y-6" onSubmit={onSubmit}>
          <div>
            <h2
              id="quick-owner-modal-title"
              className="text-2xl font-semibold tracking-tight text-slate-950"
            >
              Nuevo dueño
            </h2>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <FieldLabel htmlFor="owner-full-name" required>
                Nombre completo
              </FieldLabel>
              <input
                id="owner-full-name"
                name="full_name"
                className={inputClassName()}
                value={values.full_name}
                onChange={onChange}
                required
              />
            </div>

            <div>
              <FieldLabel htmlFor="owner-company-name">Empresa</FieldLabel>
              <input
                id="owner-company-name"
                name="company_name"
                className={inputClassName()}
                value={values.company_name}
                onChange={onChange}
              />
            </div>

            <div>
              <FieldLabel htmlFor="owner-email">Email</FieldLabel>
              <input
                id="owner-email"
                name="email"
                type="email"
                className={inputClassName()}
                value={values.email}
                onChange={onChange}
              />
            </div>

            <div>
              <FieldLabel htmlFor="owner-phone">Teléfono</FieldLabel>
              <input
                id="owner-phone"
                name="phone"
                className={inputClassName()}
                value={values.phone}
                onChange={onChange}
              />
            </div>

            <div className="md:col-span-2">
              <FieldLabel htmlFor="owner-notes">Notas</FieldLabel>
              <textarea
                id="owner-notes"
                name="notes"
                rows={4}
                className={inputClassName()}
                value={values.notes}
                onChange={onChange}
              />
            </div>
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
              {isSubmitting ? 'Creando dueño...' : 'Crear dueño'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LocationOwnerQuickCreateModal
