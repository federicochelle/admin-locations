type SelectableOptionItem = {
  id: string
  name: string
}

export type GroupedSelectableOptions<T extends SelectableOptionItem> = {
  group: string | null
  items: T[]
}

type SelectableOptionsSectionProps<T extends SelectableOptionItem> = {
  emptyMessage: string
  groups: GroupedSelectableOptions<T>[]
  isDisabled: boolean
  isReadOnly: boolean
  onToggle: (itemId: string) => void
  selectedIds: string[]
  title: (group: string | null) => string
}

function SelectableOptionsSection<T extends SelectableOptionItem>({
  emptyMessage,
  groups,
  isDisabled,
  isReadOnly,
  onToggle,
  selectedIds,
  title,
}: SelectableOptionsSectionProps<T>) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        return (
          <div key={group.group?.trim() || 'ungrouped'} className="space-y-3">
            <h5 className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
              {title(group.group)}
            </h5>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.items.map((item) => {
                const isSelected = selectedIds.includes(item.id)

                return (
                  <label
                    key={item.id}
                    className={[
                      'flex min-w-0 items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition',
                      isSelected
                        ? 'border-[#B8924A] bg-[#0f1723] text-[#B8924A] shadow-sm'
                        : isReadOnly
                          ? 'border-slate-200 bg-white text-slate-500'
                          : 'cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(item.id)}
                      disabled={isDisabled || isReadOnly}
                      className={[
                        'mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300',
                        isSelected
                          ? 'border-[#B8924A] text-[#B8924A] focus:ring-[rgba(184,146,74,0.20)]'
                          : 'text-slate-900 focus:ring-slate-300',
                      ].join(' ')}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{item.name}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default SelectableOptionsSection
