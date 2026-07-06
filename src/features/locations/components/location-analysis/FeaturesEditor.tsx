import type { LocationFeatureOption } from '../../locations.types'
import SelectableOptionsSection, {
  type GroupedSelectableOptions,
} from './SelectableOptionsSection'

type FeaturesEditorProps = {
  featureGroups: GroupedSelectableOptions<LocationFeatureOption>[]
  formatGroupLabel: (group: string | null) => string
  isDisabled: boolean
  isReadOnly: boolean
  onToggle: (featureId: string) => void
  selectedFeatureIds: string[]
}

function FeaturesEditor({
  featureGroups,
  formatGroupLabel,
  isDisabled,
  isReadOnly,
  onToggle,
  selectedFeatureIds,
}: FeaturesEditorProps) {
  return (
    <div>
      <SelectableOptionsSection
        emptyMessage={
          isReadOnly
            ? 'Esta locación no tiene características seleccionadas.'
            : 'No hay features booleanas activas disponibles.'
        }
        groups={featureGroups}
        isDisabled={isDisabled}
        isReadOnly={isReadOnly}
        onToggle={onToggle}
        selectedIds={selectedFeatureIds}
        title={formatGroupLabel}
      />
    </div>
  )
}

export default FeaturesEditor
