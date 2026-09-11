import type { ChangeEvent, ReactNode } from 'react'
import type { LocationFormMode } from '../../LocationForm'
import type { LocationFormFieldErrors } from '../../application/validate-location-form'
import type { LocationFormValues } from '../../locations.types'
import {
  FieldLabel,
} from './location-form-field-ui'
import {
  getFieldErrorInputClassName,
  inputClassName,
} from './location-form-field-styles'

type LocationBasicFieldsProps = {
  fieldErrors: LocationFormFieldErrors
  isReadOnly: boolean
  mode: LocationFormMode
  onTextChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  primaryCardActions?: ReactNode
  values: LocationFormValues
}

function getFormHeading(mode: LocationFormMode) {
  if (mode === 'edit') {
    return 'Editar locación'
  }

  if (mode === 'view') {
    return 'Detalle de locación'
  }

  return 'Panel de creación'
}

export default function LocationBasicFields({
  fieldErrors,
  isReadOnly,
  mode,
  onTextChange,
  primaryCardActions,
  values,
}: LocationBasicFieldsProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 text-2xl font-semibold text-slate-950">
          {getFormHeading(mode)}
        </h3>
        {primaryCardActions ? (
          <div className="shrink-0">{primaryCardActions}</div>
        ) : null}
      </div>

      <div>
        <FieldLabel htmlFor="title" required>
          Título
        </FieldLabel>
        <input
          id="title"
          name="title"
          className={[
            inputClassName(),
            getFieldErrorInputClassName(fieldErrors.title),
          ].join(' ')}
          value={values.title}
          onChange={onTextChange}
          readOnly={isReadOnly}
          required
        />
        {!isReadOnly && fieldErrors.title ? (
          <p className="mt-2 text-sm text-red-600">{fieldErrors.title}</p>
        ) : null}
      </div>
    </>
  )
}
