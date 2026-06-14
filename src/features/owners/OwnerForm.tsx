import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { routePaths } from '../../app/router/route-paths'
import { createOwner, updateOwner } from './owners.service'
import useAuth from '../auth/useAuth'
import LocationsTable from '../locations/LocationsTable'
import type { LocationListItem } from '../locations/locations.types'
import type {
  OwnerCreatePayload,
  OwnerFormValues,
  OwnerLocationListItem,
  OwnerUpdatePayload,
} from './owners.types'

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
  const { profile } = useAuth()
  const [values, setValues] = useState<OwnerFormValues>(initialValues)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const ownerLocationsAsLocationListItems = useMemo<LocationListItem[]>(
    () =>
      locations.map((location) => ({
        id: location.id,
        title: location.title,
        locationCode: location.locationCode,
        coverImageUrl: location.coverImageUrl,
        departmentName: location.departmentName,
        zoneName: location.zoneName,
        categoryName: null,
        ownerId: ownerId ?? null,
        ownerName: values.full_name.trim() || ownerName || null,
        ownerPhone: values.phone.trim() || null,
        slug: '',
        featured: false,
        premium: false,
        status: location.status,
        published: location.published,
      })),
    [locations, ownerId, ownerName, values.full_name, values.phone],
  )

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

        await updateOwner(ownerId, payload, {
          actorProfileId: profile?.id ?? null,
        })
      } else {
        await createOwner(payload, {
          actorProfileId: profile?.id ?? null,
        })
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
          <div className="md:col-span-2">
            <div className="px-6 py-5">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Locaciones asociadas
              </h2>
            </div>

            {locations.length === 0 ? (
              <div className="px-6 py-6 text-sm text-slate-600">
                No hay locaciones asociadas a este dueño.
              </div>
            ) : (
              <LocationsTable
                locations={ownerLocationsAsLocationListItems}
                activeActionKey={activeLocationActionKey}
                showToolbar={false}
                title={null}
                visibleColumns={{
                  cover: true,
                  code: true,
                  department: true,
                  owner: false,
                  phone: false,
                  actions: true,
                }}
                getLocationEditState={() =>
                  ownerId && ownerName
                    ? {
                        source: 'owner',
                        ownerId,
                        ownerName,
                      }
                    : undefined
                }
                onDelete={(location) => onDeleteLocation?.(location.id) ?? Promise.resolve()}
              />
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
