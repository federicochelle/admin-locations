import type { ChangeEvent } from 'react'
import LocationAddressPicker from '../../LocationAddressPicker'
import { getLocationAddressPickerValue } from '../../application/location-form.helpers'
import type { LocationFormFieldErrors } from '../../application/validate-location-form'
import type { ParsedGooglePlaceAddress } from '../../location-address-parser'
import type { LocationFormValues } from '../../locations.types'
import {
  FieldLabel,
  ReadOnlyFieldValue,
} from './location-form-field-ui'
import { inputClassName } from './location-form-field-styles'

type LocationAddressFieldsProps = {
  fieldErrors: LocationFormFieldErrors
  googleMapsApiKey: string | null
  isReadOnly: boolean
  isSubmitting: boolean
  onGooglePlaceSelected: (place: ParsedGooglePlaceAddress) => void
  onTextChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  resolvedViewAddress: string | null
  values: LocationFormValues
}

function renderGoogleLocationFallback(inputClassNameValue: string) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        value=""
        disabled
        placeholder="Buscar dirección o pegar enlace de Google Maps"
        autoComplete="off"
        className={inputClassNameValue}
        readOnly
      />
      <p className="text-sm text-slate-600">
        Google Places no está configurado. Puedes seguir usando la dirección manual.
      </p>
    </div>
  )
}

export default function LocationAddressFields({
  fieldErrors,
  googleMapsApiKey,
  isReadOnly,
  isSubmitting,
  onGooglePlaceSelected,
  resolvedViewAddress,
  values,
}: LocationAddressFieldsProps) {
  return (
    <div>
      <FieldLabel htmlFor="google-location-search" required>
        Dirección
      </FieldLabel>
      {isReadOnly ? (
        <ReadOnlyFieldValue value={resolvedViewAddress} />
      ) : (
        <>
          {googleMapsApiKey ? (
            <LocationAddressPicker
              formattedAddress={values.formatted_address}
              value={getLocationAddressPickerValue(values)}
              disabled={isSubmitting || isReadOnly}
              error={fieldErrors.address_private}
              onPlaceSelected={onGooglePlaceSelected}
            />
          ) : (
            renderGoogleLocationFallback(inputClassName())
          )}
        </>
      )}
      {!isReadOnly && fieldErrors.address_private ? (
        <p className="mt-2 text-sm text-red-700">
          {fieldErrors.address_private}
        </p>
      ) : null}
    </div>
  )
}
