import type { ChangeEvent } from 'react'
import type { LocationFormValues } from '../../locations.types'
import LocationVisibilityFields from './LocationVisibilityFields'

type LocationAdvancedFieldsProps = {
  onCheckboxChange: (event: ChangeEvent<HTMLInputElement>) => void
  onTextChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  showAdvancedSection: boolean
  values: LocationFormValues
}

export default function LocationAdvancedFields({
  onCheckboxChange,
  onTextChange,
  showAdvancedSection,
  values,
}: LocationAdvancedFieldsProps) {
  return (
    <div className="hidden">
      {showAdvancedSection ? (
        <>
          <select
            name="status"
            value={values.status}
            onChange={onTextChange}
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
          <input
            type="checkbox"
            name="premium"
            checked={values.premium}
            onChange={onCheckboxChange}
          />
          <input
            type="checkbox"
            name="featured"
            checked={values.featured}
            onChange={onCheckboxChange}
          />
        </>
      ) : null}
      <LocationVisibilityFields
        onCheckboxChange={onCheckboxChange}
        onTextChange={onTextChange}
        values={values}
      />
    </div>
  )
}
