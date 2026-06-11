import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { getLocationEditPath, routePaths } from '../../app/router/route-paths'
import { createOwner, updateOwner } from './owners.service'
import type {
  OwnerCreatePayload,
  OwnerFormValues,
  OwnerLocationListItem,
  OwnerUpdatePayload,
} from './owners.types'
import { useState } from 'react'

export type OwnerFormMode = 'create' | 'edit'

type OwnerFormProps = {
  mode?: OwnerFormMode
  initialValues?: OwnerFormValues
  locations?: OwnerLocationListItem[]
  ownerId?: string
  ownerName?: string | null
  activeLocationActionKey?: string | null
  onDeleteLocation?: (id: string) => Promise<void>
}

const defaultInitialValues: OwnerFormValues = {
  full_name: '',
  company_name: '',
  email: '',
  phone: '',
  whatsapp: '',
  document_or_rut: '',
  notes: '',
  status: 'active',
}

function toNullableString(value: string) {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function buildPayload(
  values: OwnerFormValues,
): OwnerCreatePayload | OwnerUpdatePayload {
  return {
    full_name: values.full_name.trim(),
    company_name: toNullableString(values.company_name),
    email: toNullableString(values.email),
    phone: toNullableString(values.phone),
    whatsapp: toNullableString(values.whatsapp),
    document_or_rut: toNullableString(values.document_or_rut),
    notes: toNullableString(values.notes),
    status: values.status,
  }
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

function formatCellValue(value: string | null) {
  return value && value.trim().length > 0 ? value : 'Sin dato'
}

function formatLocationCode() {
  return 'xxxx-xxxx'
}

function CoverPlaceholder() {
  return (
    <div className="flex h-14 w-20 items-center justify-center border border-slate-300 bg-slate-50 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
      Sin foto
    </div>
  )
}

function ActionIconButton({
  actionLabel,
  buttonClassName = '',
  children,
  disabled = false,
  onClick,
}: {
  actionLabel: string
  buttonClassName?: string
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={actionLabel}
      disabled={disabled}
      onClick={onClick}
      className={[
        'group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition disabled:cursor-not-allowed disabled:opacity-60',
        buttonClassName,
      ].join(' ')}
    >
      {children}
      <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
        {actionLabel}
      </span>
    </button>
  )
}

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M12 20h9"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M3 6h18"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6V4h8v2"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function OwnerForm({
  mode = 'create',
  initialValues = defaultInitialValues,
  locations = [],
  ownerId,
  ownerName = null,
  activeLocationActionKey = null,
  onDeleteLocation,
}: OwnerFormProps) {
  const navigate = useNavigate()
  const [values, setValues] = useState<OwnerFormValues>(initialValues)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleTextChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    const { name, value } = event.target

    setValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setIsSubmitting(true)
      setSubmitError(null)

      const payload = buildPayload(values)

      if (mode === 'edit') {
        if (!ownerId) {
          throw new Error('Falta el identificador del dueño a editar.')
        }

        await updateOwner(ownerId, payload)
      } else {
        await createOwner(payload)
      }

      navigate(routePaths.owners)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : mode === 'edit'
            ? 'No pudimos guardar los cambios del dueño.'
            : 'No pudimos guardar el dueño.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      {submitError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="full_name" required>
            Nombre completo
          </FieldLabel>
          <input
            id="full_name"
            name="full_name"
            className={inputClassName()}
            value={values.full_name}
            onChange={handleTextChange}
            required
          />
        </div>

        <div>
          <FieldLabel htmlFor="company_name">Empresa</FieldLabel>
          <input
            id="company_name"
            name="company_name"
            className={inputClassName()}
            value={values.company_name}
            onChange={handleTextChange}
          />
        </div>

        <div>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <input
            id="email"
            name="email"
            type="email"
            className={inputClassName()}
            value={values.email}
            onChange={handleTextChange}
          />
        </div>

        <div>
          <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
          <input
            id="phone"
            name="phone"
            className={inputClassName()}
            value={values.phone}
            onChange={handleTextChange}
          />
        </div>
        <div className="md:col-span-2">
          <FieldLabel htmlFor="notes">Notas</FieldLabel>
          <textarea
            id="notes"
            name="notes"
            className={inputClassName()}
            value={values.notes}
            onChange={handleTextChange}
            rows={5}
          />
        </div>

        {mode === 'edit' ? (
          <div className="md:col-span-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Locaciones asociadas
              </h2>
            </div>

            {locations.length === 0 ? (
              <div className="px-6 py-6 text-sm text-slate-600">
                No hay locaciones asociadas a este dueño.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Portada
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Título
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Departamento
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Zona
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Código
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {locations.map((location) => (
                      <tr key={location.id} className="align-top">
                        <td className="px-6 py-4">
                          {location.coverImageUrl ? (
                            <div className="h-14 w-20 overflow-hidden border border-slate-200 bg-slate-100">
                              <img
                                src={location.coverImageUrl}
                                alt={`Portada de ${location.title}`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <CoverPlaceholder />
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-950">
                          {location.title}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatCellValue(location.departmentName)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatCellValue(location.zoneName)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatLocationCode()}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <div className="flex flex-nowrap items-center gap-2">
                            <Link
                              to={getLocationEditPath(location.id)}
                              state={
                                ownerId && ownerName
                                  ? {
                                      source: 'owner',
                                      ownerId,
                                      ownerName,
                                    }
                                  : undefined
                              }
                              aria-label="Editar"
                              className="group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                            >
                              <EditIcon />
                              <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
                                Editar
                              </span>
                            </Link>

                            <ActionIconButton
                              actionLabel={
                                activeLocationActionKey === `delete:${location.id}`
                                  ? 'Eliminando...'
                                  : 'Eliminar'
                              }
                              buttonClassName="border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                              disabled={activeLocationActionKey !== null}
                              onClick={() => void onDeleteLocation?.(location.id)}
                            >
                              <DeleteIcon />
                            </ActionIconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          onClick={() => navigate(routePaths.owners)}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === 'edit'
              ? 'Guardando cambios...'
              : 'Guardando...'
            : mode === 'edit'
              ? 'Guardar cambios'
              : 'Guardar dueño'}
        </Button>
      </div>
    </form>
  )
}

export default OwnerForm
