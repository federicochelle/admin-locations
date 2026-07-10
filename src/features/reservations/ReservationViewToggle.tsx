type ReservationViewToggleProps = {
  value: 'calendar' | 'list'
  onChange: (view: 'calendar' | 'list') => void
}

function ReservationViewToggle({
  value,
  onChange,
}: ReservationViewToggleProps) {
  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm">
      {[
        { value: 'calendar', label: 'Calendario' },
        { value: 'list', label: 'Lista' },
      ].map((option) => {
        const isActive = value === option.value

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value as 'calendar' | 'list')}
            className={[
              'rounded-xl px-4 py-2 text-sm font-medium transition',
              isActive
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default ReservationViewToggle
