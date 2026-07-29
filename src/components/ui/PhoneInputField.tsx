import PhoneInput, { type Value } from 'react-phone-number-input'
import { DEFAULT_COUNTRY } from '../../lib/phone'

type PhoneInputFieldProps = {
  autoComplete?: string
  className?: string
  disabled?: boolean
  errorMessage?: string | null
  id?: string
  name?: string
  onChange: (value: string) => void
  placeholder?: string
  readOnly?: boolean
  required?: boolean
  value: string
}

function PhoneInputField({
  autoComplete = 'tel',
  className = '',
  disabled = false,
  errorMessage = null,
  id,
  name,
  onChange,
  placeholder,
  readOnly = false,
  required = false,
  value,
}: PhoneInputFieldProps) {
  return (
    <div
      className={[
        'PhoneInputRoot flex w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200',
        errorMessage ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-100' : '',
        disabled || readOnly ? 'bg-slate-50' : '',
        className,
      ].join(' ')}
    >
      <PhoneInput
        id={id}
        name={name}
        autoComplete={autoComplete}
        country={DEFAULT_COUNTRY}
        defaultCountry={DEFAULT_COUNTRY}
        disabled={disabled}
        international
        countryCallingCodeEditable={false}
        value={(value || undefined) as Value}
        onChange={(nextValue) => onChange(nextValue ?? '')}
        placeholder={placeholder}
        readOnly={readOnly}
        numberInputProps={{
          className:
            'PhoneInputText min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400',
          readOnly,
          required,
        }}
      />
    </div>
  )
}

export default PhoneInputField
