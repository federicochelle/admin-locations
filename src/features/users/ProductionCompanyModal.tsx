import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button'
import LocationImageUploader, {
  type LocationImageUploaderHandle,
} from '../locations/LocationImageUploader'
import { prepareImageUploadFile } from '../images/image-upload.processor'
import {
  LOCATION_TOP_STACK_PANEL_SURFACE_CLASS,
} from '../locations/location-top-stack.styles'
import type {
  ProductionCompanyFormValues,
  ProductionCompanyListItem,
} from '../production-companies/production-companies.types'

type ProductionCompanyModalProps = {
  errorMessage: string | null
  isOpen: boolean
  isSubmitting: boolean
  mode: 'create' | 'edit'
  company: ProductionCompanyListItem | null
  onClose: () => void
  onSubmit: (values: ProductionCompanyFormValues, logoFile: File | null) => Promise<void>
}

type PendingLogo = {
  file: File
  previewUrl: string
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

function ReplaceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M20 11a8 8 0 1 0-2.34 5.66"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 4v7h-7"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ProductionCompanyModal({
  errorMessage,
  isOpen,
  isSubmitting,
  mode,
  company,
  onClose,
  onSubmit,
}: ProductionCompanyModalProps) {
  const uploaderRef = useRef<LocationImageUploaderHandle | null>(null)
  const [values, setValues] = useState<ProductionCompanyFormValues>({
    name: '',
  })
  const [pendingLogo, setPendingLogo] = useState<PendingLogo | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setPendingLogo((currentLogo) => {
      if (currentLogo) {
        URL.revokeObjectURL(currentLogo.previewUrl)
      }

      return null
    })
    setValues({
      name: company?.name ?? '',
    })
    setLogoError(null)
  }, [company, isOpen])

  useEffect(() => {
    return () => {
      if (pendingLogo) {
        URL.revokeObjectURL(pendingLogo.previewUrl)
      }
    }
  }, [pendingLogo])

  const visibleLogoUrl = pendingLogo?.previewUrl ?? company?.logoUrl ?? null

  const title = mode === 'create' ? 'Nueva productora' : 'Editar productora'
  const submitLabel = mode === 'create' ? 'Crear productora' : 'Guardar cambios'

  async function handleFilesSelected(files: FileList | null) {
    const selectedFile = files?.[0] ?? null

    if (!selectedFile) {
      return
    }

    try {
      setLogoError(null)

      const preparedFile = await prepareImageUploadFile(selectedFile)

      setPendingLogo((currentLogo) => {
        if (currentLogo) {
          URL.revokeObjectURL(currentLogo.previewUrl)
        }

        return {
          file: preparedFile.file,
          previewUrl: URL.createObjectURL(preparedFile.file),
        }
      })
    } catch (error) {
      setLogoError(
        error instanceof Error
          ? error.message
          : 'No pudimos preparar el logo para subir.',
      )
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit(values, pendingLogo?.file ?? null)
  }

  function handleClose() {
    if (isSubmitting) {
      return
    }

    if (pendingLogo) {
      URL.revokeObjectURL(pendingLogo.previewUrl)
      setPendingLogo(null)
    }

    setLogoError(null)
    onClose()
  }

  if (!isOpen) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/35 px-4 py-4 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="production-company-modal-title"
        className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <h2
              id="production-company-modal-title"
              className="text-2xl font-semibold tracking-tight text-slate-950"
            >
              {title}
            </h2>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-6">
              <div>
              <FieldLabel htmlFor="production-company-name" required>
                Nombre
              </FieldLabel>
              <input
                id="production-company-name"
                name="name"
                className={inputClassName()}
                value={values.name}
                onChange={(event) =>
                  setValues((currentValues) => ({
                    ...currentValues,
                    name: event.target.value,
                  }))
                }
                placeholder="Ej. Cimarron Cine"
                required
              />
              </div>
            </section>

            <section className="space-y-3">
              <FieldLabel htmlFor="production-company-logo">Foto</FieldLabel>
              <div className="hidden">
                <LocationImageUploader
                  ref={uploaderRef}
                  label="Seleccionar imagen"
                  multiple={false}
                  disabled={isSubmitting}
                  onFilesSelected={(files) => {
                    void handleFilesSelected(files)
                  }}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {visibleLogoUrl ? (
                  <div className="group relative overflow-hidden rounded-2xl">
                    <img
                      src={visibleLogoUrl}
                      alt={values.name.trim() ? `Logo de ${values.name.trim()}` : 'Vista previa de la foto'}
                      className={[
                        'rounded-2xl bg-white object-contain p-4',
                        LOCATION_TOP_STACK_PANEL_SURFACE_CLASS,
                      ].join(' ')}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-slate-950/0 transition group-hover:bg-slate-950/20">
                      <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2 opacity-0 transition duration-200 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => uploaderRef.current?.openFileDialog()}
                          disabled={isSubmitting}
                          className="inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ReplaceIcon />
                          Reemplazar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <LocationImageUploader
                    ref={uploaderRef}
                    label="Seleccionar imagen"
                    multiple={false}
                    variant="empty-state"
                    disabled={isSubmitting}
                    onFilesSelected={(files) => {
                      void handleFilesSelected(files)
                    }}
                  />
                )}

                {!visibleLogoUrl ? null : (
                  <div className="mt-3">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => uploaderRef.current?.openFileDialog()}
                        disabled={isSubmitting}
                      >
                        Cambiar foto
                    </Button>
                  </div>
                )}

                {logoError ? (
                  <p className="mt-3 text-sm text-red-600">{logoError}</p>
                ) : null}
              </div>
            </section>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? mode === 'create'
                  ? 'Creando productora...'
                  : 'Guardando cambios...'
                : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

export default ProductionCompanyModal
