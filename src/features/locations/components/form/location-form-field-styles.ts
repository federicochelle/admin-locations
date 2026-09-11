export function inputClassName() {
  return 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
}

export function getFieldErrorInputClassName(errorMessage: string | null) {
  return errorMessage ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''
}
