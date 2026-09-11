export function FieldLabel({
  children,
  htmlFor,
  required = false,
}: {
  children: string
  htmlFor: string
  required?: boolean
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-medium text-slate-700"
    >
      {children}
      {required ? <span className="text-slate-500"> *</span> : null}
    </label>
  )
}

export function ReadOnlyFieldValue({
  value,
}: {
  value: string | null | undefined
}) {
  const normalizedValue = value?.trim()

  return (
    <div className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm">
      {normalizedValue && normalizedValue.length > 0 ? normalizedValue : '-'}
    </div>
  )
}

export function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      className="h-6 w-6"
    >
      <path
        d="m5 7.5 5 5 5-5"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
