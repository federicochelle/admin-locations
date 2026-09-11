import type { ChangeEvent } from 'react'
import type { LocationFormValues } from '../../locations.types'

type LocationVisibilityFieldsProps = {
  onCheckboxChange: (event: ChangeEvent<HTMLInputElement>) => void
  onTextChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  values: LocationFormValues
}

export default function LocationVisibilityFields({
  onCheckboxChange,
  onTextChange,
  values,
}: LocationVisibilityFieldsProps) {
  return (
    <>
      <select
        name="visibility_level"
        value={values.visibility_level}
        onChange={onTextChange}
      >
        <option value="public">public</option>
        <option value="private">private</option>
        <option value="restricted">restricted</option>
      </select>
      <select
        name="map_visibility"
        value={values.map_visibility}
        onChange={onTextChange}
      >
        <option value="public">public</option>
        <option value="approximate">approximate</option>
        <option value="private">private</option>
      </select>
      <input
        name="address_public"
        value={values.address_public}
        onChange={onTextChange}
      />
      <input
        type="hidden"
        name="address_private"
        value={values.address_private}
        onChange={onTextChange}
      />
      <input
        type="checkbox"
        name="published"
        checked={values.published}
        onChange={onCheckboxChange}
      />
      <input
        type="checkbox"
        name="show_exact_location"
        checked={values.show_exact_location}
        onChange={onCheckboxChange}
      />
    </>
  )
}
