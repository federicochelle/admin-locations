import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import { getOwnerById } from './owners.service'
import type { OwnerEditableDetails } from './owners.types'

type OwnerDetailsModalProps = {
  isOpen: boolean
  ownerId: string | null
  onClose: () => void
}

function formatFieldValue(value: string | null) {
  return value && value.trim().length > 0 ? value : 'Sin dato'
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: string
  htmlFor: string
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-slate-700">
      {children}
    </label>
  )
}

function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

function OwnerDetailsModal({
  isOpen,
  ownerId,
  onClose,
}: OwnerDetailsModalProps) {
  const [details, setDetails] = useState<OwnerEditableDetails | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isOpen || !ownerId) {
      return
    }

    let isActive = true

    void getOwnerById(ownerId)
      .then((nextDetails) => {
        if (!isActive) {
          return
        }

        setDetails(nextDetails)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'No pudimos cargar los datos del dueño.'

        setErrorMessage(message)
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [isOpen, ownerId])

  if (!isOpen || !ownerId) {
    return null
  }

  const owner = details?.owner ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-details-modal-title"
        className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="space-y-6">
          <div>
            <h2
              id="owner-details-modal-title"
              className="text-2xl font-semibold tracking-tight text-slate-950"
            >
              Detalle del dueño
            </h2>
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              Cargando datos del dueño...
            </div>
          ) : null}

          {!isLoading && errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {!isLoading && !errorMessage && owner ? (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel htmlFor="owner-details-full-name">
                  Nombre completo
                </FieldLabel>
                <input
                  id="owner-details-full-name"
                  className={inputClassName()}
                  value={formatFieldValue(owner.full_name)}
                  readOnly
                />
              </div>

              <div>
                <FieldLabel htmlFor="owner-details-company-name">Empresa</FieldLabel>
                <input
                  id="owner-details-company-name"
                  className={inputClassName()}
                  value={formatFieldValue(owner.company_name)}
                  readOnly
                />
              </div>

              <div>
                <FieldLabel htmlFor="owner-details-email">Email</FieldLabel>
                <input
                  id="owner-details-email"
                  className={inputClassName()}
                  value={formatFieldValue(owner.email)}
                  readOnly
                />
              </div>

              <div>
                <FieldLabel htmlFor="owner-details-phone">Teléfono</FieldLabel>
                <input
                  id="owner-details-phone"
                  className={inputClassName()}
                  value={formatFieldValue(owner.phone)}
                  readOnly
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel htmlFor="owner-details-notes">Notas</FieldLabel>
                <textarea
                  id="owner-details-notes"
                  rows={4}
                  className={inputClassName()}
                  value={formatFieldValue(owner.notes)}
                  readOnly
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OwnerDetailsModal
