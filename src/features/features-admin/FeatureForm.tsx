import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Button from '../../components/ui/Button'
import { routePaths } from '../../app/router/route-paths'
import { createFeature, updateFeature } from './features.service'
import type {
  FeatureCreatePayload,
  FeatureFormValues,
  FeatureUpdatePayload,
} from './features.types'

export type FeatureFormMode = 'create' | 'edit'

type FeatureFormProps = {
  mode?: FeatureFormMode
  initialValues?: FeatureFormValues
  featureId?: string
}

const defaultInitialValues: FeatureFormValues = {
  name: '',
  slug: '',
  group: '',
  type: 'boolean',
  active: true,
}

function toNullableString(value: string) {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function buildPayload(
  values: FeatureFormValues,
): FeatureCreatePayload | FeatureUpdatePayload {
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    group: toNullableString(values.group),
    type: values.type,
    active: values.active,
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

function FeatureForm({
  mode = 'create',
  initialValues = defaultInitialValues,
  featureId,
}: FeatureFormProps) {
  const navigate = useNavigate()
  const [values, setValues] = useState<FeatureFormValues>(initialValues)
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

  function handleCheckboxChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { checked, name } = event.target

    setValues((currentValues) => ({
      ...currentValues,
      [name]: checked,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setIsSubmitting(true)
      setSubmitError(null)

      const payload = buildPayload(values)

      if (mode === 'edit') {
        if (!featureId) {
          throw new Error('Falta el identificador de la feature a editar.')
        }

        await updateFeature(featureId, payload)
      } else {
        await createFeature(payload)
      }

      navigate(routePaths.features)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : mode === 'edit'
            ? 'No pudimos guardar los cambios de la feature.'
            : 'No pudimos guardar la feature.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Datos principales</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            {mode === 'edit'
              ? 'Actualizá la feature y su comportamiento básico dentro del catálogo.'
              : 'Creá una feature base para usar luego en la relación entre locaciones y atributos.'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate(routePaths.features)}
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
                : 'Guardar feature'}
          </Button>
        </div>
      </div>

      {submitError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <FieldLabel htmlFor="name" required>
            Nombre
          </FieldLabel>
          <input
            id="name"
            name="name"
            className={inputClassName()}
            value={values.name}
            onChange={handleTextChange}
            required
          />
        </div>

        <div>
          <FieldLabel htmlFor="slug" required>
            Slug
          </FieldLabel>
          <input
            id="slug"
            name="slug"
            className={inputClassName()}
            value={values.slug}
            onChange={handleTextChange}
            required
          />
        </div>

        <div>
          <FieldLabel htmlFor="group">Grupo</FieldLabel>
          <input
            id="group"
            name="group"
            className={inputClassName()}
            value={values.group}
            onChange={handleTextChange}
          />
        </div>

        <div>
          <FieldLabel htmlFor="type">Tipo</FieldLabel>
          <select
            id="type"
            name="type"
            className={inputClassName()}
            value={values.type}
            onChange={handleTextChange}
          >
            <option value="boolean">boolean</option>
            <option value="text">text</option>
            <option value="number">number</option>
            <option value="select">select</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name="active"
              checked={values.active}
              onChange={handleCheckboxChange}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
            />
            Feature activa
          </label>
        </div>
      </div>
    </form>
  )
}

export default FeatureForm
