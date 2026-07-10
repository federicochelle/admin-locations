import Button from '../../components/ui/Button'
import {
  RESERVATION_STATUS_OPTIONS,
  type ReservationFormValues,
  type ReservationLocationOption,
} from './reservations.types'

type ReservationFormProps = {
  errorMessage: string | null
  isSubmitting: boolean
  locationOptions: ReservationLocationOption[]
  mode: 'create' | 'edit'
  onChange: (
    field: keyof ReservationFormValues,
    value: string,
  ) => void
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  values: ReservationFormValues
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

function formatLocationOption(option: ReservationLocationOption) {
  return option.locationCode?.trim()
    ? `${option.locationCode.replaceAll('-', ' ')} · ${option.title}`
    : option.title
}

function ReservationForm({
  errorMessage,
  isSubmitting,
  locationOptions,
  mode,
  onChange,
  onClose,
  onSubmit,
  values,
}: ReservationFormProps) {
  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <FieldLabel htmlFor="reservation-location" required>
            Locación
          </FieldLabel>
          <select
            id="reservation-location"
            value={values.locationId}
            onChange={(event) => onChange('locationId', event.target.value)}
            disabled={isSubmitting}
            required
            className={inputClassName()}
          >
            <option value="">Seleccioná una locación</option>
            {locationOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {formatLocationOption(option)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <FieldLabel htmlFor="reservation-title" required>
            Título
          </FieldLabel>
          <input
            id="reservation-title"
            value={values.title}
            onChange={(event) => onChange('title', event.target.value)}
            disabled={isSubmitting}
            required
            className={inputClassName()}
            placeholder="Ej. Producción de campaña verano"
          />
        </div>

        <div>
          <FieldLabel htmlFor="reservation-starts-at" required>
            Inicio
          </FieldLabel>
          <input
            id="reservation-starts-at"
            type="datetime-local"
            value={values.startsAt}
            onChange={(event) => onChange('startsAt', event.target.value)}
            disabled={isSubmitting}
            required
            className={inputClassName()}
          />
        </div>

        <div>
          <FieldLabel htmlFor="reservation-ends-at" required>
            Fin
          </FieldLabel>
          <input
            id="reservation-ends-at"
            type="datetime-local"
            value={values.endsAt}
            onChange={(event) => onChange('endsAt', event.target.value)}
            min={values.startsAt || undefined}
            disabled={isSubmitting}
            required
            className={inputClassName()}
          />
        </div>

        <div className="md:col-span-2">
          <FieldLabel htmlFor="reservation-status" required>
            Estado
          </FieldLabel>
          <select
            id="reservation-status"
            value={values.status}
            onChange={(event) => onChange('status', event.target.value)}
            disabled={isSubmitting}
            required
            className={inputClassName()}
          >
            {RESERVATION_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <FieldLabel htmlFor="reservation-notes">Notas</FieldLabel>
          <textarea
            id="reservation-notes"
            rows={5}
            value={values.notes}
            onChange={(event) => onChange('notes', event.target.value)}
            disabled={isSubmitting}
            className={inputClassName()}
            placeholder="Agregá contexto, producción, necesidades o aclaraciones internas."
          />
        </div>
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
          {isSubmitting
            ? mode === 'create'
              ? 'Creando reserva...'
              : 'Guardando cambios...'
            : mode === 'create'
              ? 'Crear reserva'
              : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}

export default ReservationForm
