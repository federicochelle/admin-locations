import type { ChangeEvent } from 'react'
import {
  buttonBaseClassName,
  buttonVariantClasses,
} from '../../components/ui/button.styles'
import {
  LOCATION_TOP_STACK_PANEL_HEIGHT_CLASS,
  LOCATION_TOP_STACK_PANEL_SURFACE_CLASS,
} from './location-top-stack.styles'

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/avif'

type LocationImageUploaderProps = {
  disabled?: boolean
  helperText?: string
  label: string
  multiple?: boolean
  variant?: 'button' | 'empty-state'
  onFilesSelected: (files: FileList | null) => void
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 16V5" />
      <path d="m7 10 5-5 5 5" />
      <path d="M5 19h14" />
    </svg>
  )
}

function LocationImageUploader({
  disabled = false,
  label,
  multiple = true,
  variant = 'button',
  onFilesSelected,
}: LocationImageUploaderProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFilesSelected(event.target.files)
    event.target.value = ''
  }

  return (
    <label
      className={
        variant === 'empty-state'
          ? [
              'flex cursor-pointer flex-col items-center justify-center gap-4 py-10 text-center transition hover:border-slate-300 hover:bg-slate-100',
              LOCATION_TOP_STACK_PANEL_SURFACE_CLASS,
              LOCATION_TOP_STACK_PANEL_HEIGHT_CLASS,
            ].join(' ')
          : disabled
            ? 'flex w-full cursor-not-allowed flex-col items-start gap-2'
            : 'flex w-full cursor-pointer flex-col items-start gap-2'
      }
    >
      {variant === 'empty-state' ? (
        <>
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
            <UploadIcon />
          </span>
          <span className="text-base font-semibold text-slate-900">{label}</span>
        </>
      ) : (
        <>
          <span
            className={[
              buttonBaseClassName,
              buttonVariantClasses.primary,
              disabled
                ? 'cursor-not-allowed opacity-60 hover:border-white/10 hover:bg-[#0f1723]'
                : '',
            ].join(' ')}
          >
            {label}
          </span>
        </>
      )}
      <input
        type="file"
        multiple={multiple}
        accept={ACCEPTED_TYPES}
        disabled={disabled}
        onChange={handleChange}
        className="sr-only"
      />
    </label>
  )
}

export default LocationImageUploader
