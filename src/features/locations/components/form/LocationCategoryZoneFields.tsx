import type { ChangeEvent, RefObject } from 'react'
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

type LocationCategoryFieldProps = {
  categoryComboboxRef: RefObject<HTMLDivElement | null>
  categoryInputValue: string
  fieldErrors: LocationFormFieldErrors
  filteredCategories: LocationFormOptions['categories']
  isCategoryComboboxOpen: boolean
  isCreatingCategory: boolean
  isReadOnly: boolean
  isSubmitting: boolean
  onCategoryDropdownToggle: () => void
  onCategorySearchChange: (event: ChangeEvent<HTMLInputElement>) => void
  onCategorySelect: (categoryId: string, categoryName: string) => void
  onOpenCategoryModal: () => void
  selectedCategoryName: string
  setIsCategoryComboboxOpen: (isOpen: boolean) => void
  values: LocationFormValues
}

type LocationZoneHiddenFieldsProps = {
  filteredZoneOptions: LocationFormOptions['zones']
  isCreatingZone: boolean
  isSubmitting: boolean
  isZoneComboboxOpen: boolean
  onOpenZoneModal: () => void
  onTextChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  onZoneDropdownToggle: () => void
  onZoneSearchChange: (event: ChangeEvent<HTMLInputElement>) => void
  onZoneSelect: (zoneId: string, zoneName: string) => void
  options: LocationFormOptions
  setIsZoneComboboxOpen: (isOpen: boolean) => void
  values: LocationFormValues
  zoneComboboxRef: RefObject<HTMLDivElement | null>
  zoneDepartmentPrompt: string | null
  zoneInputValue: string
}

export default function LocationCategoryZoneFields({
  categoryComboboxRef,
  categoryInputValue,
  fieldErrors,
  filteredCategories,
  isCategoryComboboxOpen,
  isCreatingCategory,
  isReadOnly,
  isSubmitting,
  onCategoryDropdownToggle,
  onCategorySearchChange,
  onCategorySelect,
  onOpenCategoryModal,
  selectedCategoryName,
  setIsCategoryComboboxOpen,
  values,
}: LocationCategoryFieldProps) {
  return (
    <div>
      <FieldLabel htmlFor="category_id" required>
        Categoría
      </FieldLabel>
      {isReadOnly ? (
        <ReadOnlyFieldValue value={selectedCategoryName} />
      ) : (
        <div className="flex items-start gap-3">
          <div className="relative flex-1" ref={categoryComboboxRef}>
            <input
              id="category_id"
              name="category_id"
              type="text"
              autoComplete="off"
              className={[
                inputClassName(),
                getFieldErrorInputClassName(fieldErrors.category_id),
                'pr-10',
              ].join(' ')}
              value={categoryInputValue}
              readOnly={isReadOnly}
              placeholder="Buscar categoría"
              onChange={onCategorySearchChange}
              onFocus={() => {
                if (isReadOnly) {
                  return
                }

                setIsCategoryComboboxOpen(true)
              }}
            />
            <button
              type="button"
              aria-label="Mostrar categorías"
              onClick={onCategoryDropdownToggle}
              disabled={isReadOnly}
              className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 transition hover:text-slate-700"
            >
              <ChevronDownIcon />
            </button>
            {!isReadOnly && isCategoryComboboxOpen ? (
              <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                {filteredCategories.length > 0 ? (
                  <div className="category-combobox-scrollbar max-h-[260px] space-y-1 overflow-x-hidden overflow-y-auto pr-1">
                    {filteredCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() =>
                          onCategorySelect(category.id, category.name)
                        }
                        className={[
                          'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition',
                          values.category_id === category.id
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-700 hover:bg-slate-100',
                        ].join(' ')}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="max-h-[260px] overflow-x-hidden overflow-y-auto px-3 py-2 text-sm text-slate-500">
                    No se encontraron categorías.
                  </p>
                )}
              </div>
            ) : null}
          </div>
          {!isReadOnly ? (
            <button
              type="button"
              aria-label="Crear categoría"
              disabled={isSubmitting || isCreatingCategory}
              onClick={onOpenCategoryModal}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#B8924A] bg-[#B8924A] text-xl font-semibold text-white shadow-sm transition hover:border-[#A37C2E] hover:bg-[#A37C2E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(184,146,74,0.20)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              +
            </button>
          ) : null}
        </div>
      )}
      {fieldErrors.category_id ? (
        <p className="mt-2 text-sm text-red-700">
          {fieldErrors.category_id}
        </p>
      ) : null}
    </div>
  )
}

export function LocationZoneHiddenFields({
  filteredZoneOptions,
  isCreatingZone,
  isSubmitting,
  isZoneComboboxOpen,
  onOpenZoneModal,
  onTextChange,
  onZoneDropdownToggle,
  onZoneSearchChange,
  onZoneSelect,
  options,
  setIsZoneComboboxOpen,
  values,
  zoneComboboxRef,
  zoneDepartmentPrompt,
  zoneInputValue,
}: LocationZoneHiddenFieldsProps) {
  return (
    <div className="hidden">
      <div>
        <FieldLabel htmlFor="department_id">
          Departamento
        </FieldLabel>
        <select
          id="department_id"
          name="department_id"
          className={[
            inputClassName(),
          ].join(' ')}
          value={values.department_id}
          onChange={onTextChange}
        >
          <option value="">Seleccionar departamento</option>
          {options.departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel htmlFor="zone_id">Zona</FieldLabel>
        <div className="flex items-start gap-3">
          <div className="relative flex-1" ref={zoneComboboxRef}>
            <input
              id="zone_id"
              name="zone_id"
              type="text"
              autoComplete="off"
              className={[
                inputClassName(),
                'pr-10',
                !values.department_id
                  ? 'border-slate-400 bg-slate-300 text-slate-600'
                  : '',
              ].join(' ')}
              value={zoneInputValue}
              placeholder={
                values.department_id
                  ? 'Buscar zona'
                  : 'Seleccione un departamento primero'
              }
              onChange={onZoneSearchChange}
              onFocus={() => {
                if (!values.department_id) {
                  return
                }

                setIsZoneComboboxOpen(true)
              }}
              disabled={!values.department_id}
            />
            <button
              type="button"
              aria-label="Mostrar zonas"
              onClick={onZoneDropdownToggle}
              disabled={!values.department_id}
              className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <ChevronDownIcon />
            </button>
            {isZoneComboboxOpen ? (
              <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                {filteredZoneOptions.length > 0 ? (
                  <div className="category-combobox-scrollbar max-h-[260px] space-y-1 overflow-x-hidden overflow-y-auto pr-1">
                    {filteredZoneOptions.map((zone) => (
                      <button
                        key={zone.id}
                        type="button"
                        onClick={() => onZoneSelect(zone.id, zone.name)}
                        className={[
                          'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition',
                          values.zone_id === zone.id
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-700 hover:bg-slate-100',
                        ].join(' ')}
                      >
                        {zone.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="max-h-[260px] overflow-x-hidden overflow-y-auto px-3 py-2 text-sm text-slate-500">
                    No se encontraron zonas.
                  </p>
                )}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Crear zona"
            disabled={isSubmitting || isCreatingZone}
            onClick={onOpenZoneModal}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#B8924A] bg-[#B8924A] text-xl font-semibold text-white shadow-sm transition hover:border-[#A37C2E] hover:bg-[#A37C2E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(184,146,74,0.20)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            +
          </button>
        </div>
        {zoneDepartmentPrompt ? (
          <p className="mt-2 text-sm text-amber-700">{zoneDepartmentPrompt}</p>
        ) : null}
      </div>
    </div>
  )
}
