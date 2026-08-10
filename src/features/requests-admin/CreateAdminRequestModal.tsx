import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import type { AdminManualRequestLocationOption } from './admin-location-requests.types'

export type CreateAdminRequestFormValues = {
  title: string
  productionCompany: string
  contactName: string
  contactEmail: string
  contactPhone: string
  tentativeStartDate: string
  tentativeEndDate: string
  message: string
  locationIds: string[]
}

type CreateAdminRequestModalProps = {
  errorMessage: string | null
  isLoadingLocations: boolean
  isOpen: boolean
  isSubmitting: boolean
  locationOptions: AdminManualRequestLocationOption[]
  onClose: () => void
  onSubmit: (values: CreateAdminRequestFormValues) => Promise<boolean>
}

function getInitialValues(): CreateAdminRequestFormValues {
  return {
    title: '',
    productionCompany: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    tentativeStartDate: '',
    tentativeEndDate: '',
    message: '',
    locationIds: [],
  }
}

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function fieldLabelClassName() {
  return 'mb-2 block text-sm font-medium text-slate-700'
}

function formatLocationOption(option: AdminManualRequestLocationOption) {
  return option.locationCode?.trim()
    ? `${option.locationCode.replaceAll('-', ' ')} · ${option.title}`
    : option.title
}

function CreateAdminRequestModal({
  errorMessage,
  isLoadingLocations,
  isOpen,
  isSubmitting,
  locationOptions,
  onClose,
  onSubmit,
}: CreateAdminRequestModalProps) {
  const [values, setValues] = useState<CreateAdminRequestFormValues>(() => getInitialValues())
  const [locationSearch, setLocationSearch] = useState('')

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setValues(getInitialValues())
    setLocationSearch('')
  }, [isOpen])

  const filteredLocationOptions = useMemo(() => {
    const normalizedSearch = locationSearch.trim().toLocaleLowerCase('es-UY')

    if (!normalizedSearch) {
      return locationOptions
    }

    return locationOptions.filter((option) => {
      const title = option.title.toLocaleLowerCase('es-UY')
      const locationCode = option.locationCode?.toLocaleLowerCase('es-UY') || ''

      return title.includes(normalizedSearch) || locationCode.includes(normalizedSearch)
    })
  }, [locationOptions, locationSearch])

  if (!isOpen) {
    return null
  }

  function handleChange(field: Exclude<keyof CreateAdminRequestFormValues, 'locationIds'>, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
  }

  function toggleLocation(locationId: string) {
    setValues((currentValues) => ({
      ...currentValues,
      locationIds: currentValues.locationIds.includes(locationId)
        ? currentValues.locationIds.filter((currentLocationId) => currentLocationId !== locationId)
        : [...currentValues.locationIds, locationId],
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const wasSuccessful = await onSubmit(values)

    if (wasSuccessful) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-admin-request-title"
        className="w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="create-admin-request-title"
                className="text-2xl font-semibold tracking-tight text-slate-950"
              >
                Nueva solicitud
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Cargá una solicitud manual con la versión mínima para que el detalle admin funcione.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Cerrar formulario de nueva solicitud"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label htmlFor="admin-request-title" className={fieldLabelClassName()}>
                    Producto
                  </label>
                  <input
                    id="admin-request-title"
                    value={values.title}
                    onChange={(event) => handleChange('title', event.target.value)}
                    disabled={isSubmitting}
                    required
                    className={inputClassName()}
                    placeholder="Ej. Comercial TV invierno"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="admin-request-production-company" className={fieldLabelClassName()}>
                    Productora
                  </label>
                  <input
                    id="admin-request-production-company"
                    value={values.productionCompany}
                    onChange={(event) => handleChange('productionCompany', event.target.value)}
                    disabled={isSubmitting}
                    className={inputClassName()}
                    placeholder="Ej. Oriental Films"
                  />
                </div>

                <div>
                  <label htmlFor="admin-request-contact-name" className={fieldLabelClassName()}>
                    Nombre del contacto
                  </label>
                  <input
                    id="admin-request-contact-name"
                    value={values.contactName}
                    onChange={(event) => handleChange('contactName', event.target.value)}
                    disabled={isSubmitting}
                    required
                    className={inputClassName()}
                  />
                </div>

                <div>
                  <label htmlFor="admin-request-contact-email" className={fieldLabelClassName()}>
                    Email
                  </label>
                  <input
                    id="admin-request-contact-email"
                    type="email"
                    value={values.contactEmail}
                    onChange={(event) => handleChange('contactEmail', event.target.value)}
                    disabled={isSubmitting}
                    required
                    className={inputClassName()}
                  />
                </div>

                <div>
                  <label htmlFor="admin-request-contact-phone" className={fieldLabelClassName()}>
                    Teléfono
                  </label>
                  <input
                    id="admin-request-contact-phone"
                    value={values.contactPhone}
                    onChange={(event) => handleChange('contactPhone', event.target.value)}
                    disabled={isSubmitting}
                    required
                    className={inputClassName()}
                  />
                </div>

                <div>
                  <label htmlFor="admin-request-start-date" className={fieldLabelClassName()}>
                    Fecha tentativa de inicio
                  </label>
                  <input
                    id="admin-request-start-date"
                    type="date"
                    value={values.tentativeStartDate}
                    onChange={(event) => handleChange('tentativeStartDate', event.target.value)}
                    disabled={isSubmitting}
                    className={inputClassName()}
                  />
                </div>

                <div>
                  <label htmlFor="admin-request-end-date" className={fieldLabelClassName()}>
                    Fecha tentativa de fin
                  </label>
                  <input
                    id="admin-request-end-date"
                    type="date"
                    value={values.tentativeEndDate}
                    min={values.tentativeStartDate || undefined}
                    onChange={(event) => handleChange('tentativeEndDate', event.target.value)}
                    disabled={isSubmitting}
                    className={inputClassName()}
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="admin-request-message" className={fieldLabelClassName()}>
                    Mensaje u observaciones
                  </label>
                  <textarea
                    id="admin-request-message"
                    rows={6}
                    value={values.message}
                    onChange={(event) => handleChange('message', event.target.value)}
                    disabled={isSubmitting}
                    className={inputClassName()}
                    placeholder="Agregá contexto, referencias o aclaraciones internas."
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Locaciones
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {values.locationIds.length} seleccionada{values.locationIds.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <input
                  value={locationSearch}
                  onChange={(event) => setLocationSearch(event.target.value)}
                  disabled={isSubmitting || isLoadingLocations}
                  className={inputClassName()}
                  placeholder="Buscar por código o nombre"
                />
              </div>

              <div className="mt-4 max-h-[24rem] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                {isLoadingLocations ? (
                  <div className="flex min-h-48 items-center justify-center px-4 py-6 text-sm text-slate-600">
                    Cargando locaciones...
                  </div>
                ) : filteredLocationOptions.length === 0 ? (
                  <div className="flex min-h-48 items-center justify-center px-4 py-6 text-center text-sm text-slate-600">
                    No encontramos locaciones para este filtro.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {filteredLocationOptions.map((option) => {
                      const isSelected = values.locationIds.includes(option.id)

                      return (
                        <label
                          key={option.id}
                          className={[
                            'flex cursor-pointer items-start gap-3 px-4 py-3 transition',
                            isSelected ? 'bg-amber-50/70' : 'bg-white hover:bg-slate-50',
                          ].join(' ')}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleLocation(option.id)}
                            disabled={isSubmitting}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-300"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-950">
                              {formatLocationOption(option)}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoadingLocations}>
              {isSubmitting ? 'Creando solicitud...' : 'Crear solicitud'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateAdminRequestModal
