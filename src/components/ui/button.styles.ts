export type ButtonVariant = 'primary' | 'secondary'

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-white/10 bg-[#0f1723] text-white hover:border-[#B8924A] hover:bg-[#162131] focus-visible:ring-4 focus-visible:ring-[rgba(184,146,74,0.20)]',
  secondary:
    'border border-[#dbe3ea] bg-white text-[#0f1723] hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-4 focus-visible:ring-[rgba(15,23,35,0.10)]',
}

export const buttonBaseClassName =
  'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60'
