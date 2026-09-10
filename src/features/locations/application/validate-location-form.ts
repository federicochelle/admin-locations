import { isValidOwnerPhone } from '../../../lib/phone'
import { normalizeInlineOwnerValue } from './location-form.helpers'
import type { LocationFormValues } from '../locations.types'

export type LocationFormFieldErrors = {
  title: string | null
  address_private: string | null
  category_id: string | null
  owner_name: string | null
  owner_phone: string | null
}

export function getDefaultFieldErrors(): LocationFormFieldErrors {
  return {
    title: null,
    address_private: null,
    category_id: null,
    owner_name: null,
    owner_phone: null,
  }
}

export function validateRequiredFields(
  values: LocationFormValues,
  options: {
    ownerName: string
    ownerPhone: string
  },
): LocationFormFieldErrors {
  const normalizedOwnerName = normalizeInlineOwnerValue(options.ownerName)
  const normalizedOwnerPhone = normalizeInlineOwnerValue(options.ownerPhone)

  return {
    title:
      values.title.trim().length > 0 ? null : 'El título es obligatorio.',
    category_id:
      values.category_id.trim().length > 0
        ? null
        : 'Debe seleccionar una categoría.',
    address_private:
      values.address_private.trim().length > 0
        ? null
        : 'Debe ingresar una dirección.',
    owner_name:
      normalizedOwnerName.length === 0
        ? 'Debe ingresar el nombre del dueño.'
        : null,
    owner_phone:
      normalizedOwnerPhone.length === 0
        ? 'Debe ingresar el teléfono del dueño.'
        : values.owner_id.trim().length === 0 && !isValidOwnerPhone(normalizedOwnerPhone)
          ? 'Ingresá un teléfono válido con código de país.'
        : null,
  }
}

export function hasFieldErrors(fieldErrors: LocationFormFieldErrors) {
  return Object.values(fieldErrors).some((errorMessage) => errorMessage !== null)
}

export function getValidationMessages(fieldErrors: LocationFormFieldErrors) {
  return [
    fieldErrors.title,
    fieldErrors.category_id,
    fieldErrors.address_private,
    fieldErrors.owner_name,
    fieldErrors.owner_phone,
  ].filter((message): message is string => message !== null)
}
