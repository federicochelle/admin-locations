import type { ChangeEvent, RefObject } from 'react'
import PhoneInputField from '../../../../components/ui/PhoneInputField'
import type { LocationFormFieldErrors } from '../../application/validate-location-form'
import type { LocationFormOptions, LocationFormValues } from '../../locations.types'
import {
  ChevronDownIcon,
  FieldLabel,
  ReadOnlyFieldValue,
} from './location-form-field-ui'
import {
  getFieldErrorInputClassName,
  inputClassName,
} from './location-form-field-styles'

type LocationOwnerFieldsProps = {
  fieldErrors: LocationFormFieldErrors
  filteredOwners: LocationFormOptions['owners']
  isOwnerComboboxOpen: boolean
  isReadOnly: boolean
  onOwnerDropdownToggle: () => void
  onOwnerPhoneChange: (event: ChangeEvent<HTMLInputElement>) => void
  onOwnerSearchChange: (event: ChangeEvent<HTMLInputElement>) => void
  onOwnerSelect: (ownerId: string, ownerName: string) => void
  ownerComboboxRef: RefObject<HTMLDivElement | null>
  ownerInputValue: string
  ownerPhoneValue: string
  setIsOwnerComboboxOpen: (isOpen: boolean) => void
  values: LocationFormValues
}

export default function LocationOwnerFields({
  fieldErrors,
  filteredOwners,
  isOwnerComboboxOpen,
  isReadOnly,
  onOwnerDropdownToggle,
  onOwnerPhoneChange,
  onOwnerSearchChange,
  onOwnerSelect,
  ownerComboboxRef,
  ownerInputValue,
  ownerPhoneValue,
  setIsOwnerComboboxOpen,
  values,
}: LocationOwnerFieldsProps) {
  return (
    <div>
      <FieldLabel htmlFor="owner_id" required>
        Dueño
      </FieldLabel>
      {isReadOnly ? (
        <div className="space-y-3">
          <ReadOnlyFieldValue value={ownerInputValue} />
          <div>
            <FieldLabel htmlFor="owner_phone">Teléfono</FieldLabel>
            <ReadOnlyFieldValue value={ownerPhoneValue} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative" ref={ownerComboboxRef}>
              <input
                id="owner_id"
                name="owner_id"
                type="text"
                autoComplete="off"
                className={[
                  inputClassName(),
                  getFieldErrorInputClassName(fieldErrors.owner_name),
                  'pr-10',
                ].join(' ')}
                value={ownerInputValue}
                readOnly={isReadOnly}
                placeholder="Buscar dueño o escribir uno nuevo"
                onChange={onOwnerSearchChange}
                onFocus={() => {
                  if (isReadOnly) {
                    return
                  }

                  setIsOwnerComboboxOpen(true)
                }}
              />
              <button
                type="button"
                aria-label="Mostrar dueños"
                onClick={onOwnerDropdownToggle}
                disabled={isReadOnly}
                className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 transition hover:text-slate-700"
              >
                <ChevronDownIcon />
              </button>
              {!isReadOnly && isOwnerComboboxOpen ? (
                <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                  {filteredOwners.length > 0 ? (
                    <div className="category-combobox-scrollbar max-h-[260px] space-y-1 overflow-x-hidden overflow-y-auto pr-1">
                      {filteredOwners.map((owner) => (
                        <button
                          key={owner.id}
                          type="button"
                          onClick={() =>
                            onOwnerSelect(owner.id, owner.full_name)
                          }
                          className={[
                            'flex w-full flex-col rounded-xl px-3 py-2 text-left text-sm transition',
                            values.owner_id === owner.id
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-700 hover:bg-slate-100',
                          ].join(' ')}
                        >
                          <span className="font-medium">
                            {owner.full_name}
                          </span>
                          <span
                            className={[
                              'text-xs',
                              values.owner_id === owner.id
                                ? 'text-slate-200'
                                : 'text-slate-500',
                            ].join(' ')}
                          >
                            {owner.phone?.trim() || 'Sin teléfono'}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="max-h-[260px] overflow-x-hidden overflow-y-auto px-3 py-2 text-sm text-slate-500">
                      No se encontraron dueños.
                    </p>
                  )}
                </div>
              ) : null}
          </div>
          {fieldErrors.owner_name ? (
            <p className="text-sm text-red-700">{fieldErrors.owner_name}</p>
          ) : null}
          <div>
            <FieldLabel htmlFor="owner_phone" required>
              Teléfono
            </FieldLabel>
            {isReadOnly ? (
              <ReadOnlyFieldValue value={ownerPhoneValue} />
            ) : (
              <PhoneInputField
                id="owner_phone"
                name="owner_phone"
                value={ownerPhoneValue}
                readOnly={Boolean(values.owner_id)}
                placeholder={
                  values.owner_id
                    ? 'Teléfono del dueño seleccionado'
                    : 'Ingresar teléfono'
                }
                onChange={(nextValue) =>
                  onOwnerPhoneChange({
                    target: {
                      value: nextValue,
                    },
                  } as ChangeEvent<HTMLInputElement>)
                }
                errorMessage={fieldErrors.owner_phone}
              />
            )}
            {fieldErrors.owner_phone ? (
              <p className="mt-2 text-sm text-red-700">
                {fieldErrors.owner_phone}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
