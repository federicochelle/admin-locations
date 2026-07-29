import {
  AsYouType,
  isPossiblePhoneNumber,
  parsePhoneNumberFromString,
} from 'libphonenumber-js'

const DEFAULT_COUNTRY = 'UY'

export function normalizePhoneWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function parseOwnerPhone(value: string | null | undefined) {
  const normalizedValue = normalizePhoneWhitespace(value ?? '')

  if (!normalizedValue) {
    return null
  }

  return (
    parsePhoneNumberFromString(normalizedValue) ??
    parsePhoneNumberFromString(normalizedValue, DEFAULT_COUNTRY)
  )
}

export function toE164OwnerPhone(value: string | null | undefined) {
  const parsedPhone = parseOwnerPhone(value)

  return parsedPhone?.isValid() ? parsedPhone.number : null
}

export function isValidOwnerPhone(value: string | null | undefined) {
  const normalizedValue = normalizePhoneWhitespace(value ?? '')

  if (!normalizedValue) {
    return false
  }

  return isPossiblePhoneNumber(normalizedValue, DEFAULT_COUNTRY)
}

export function formatOwnerPhoneForInput(value: string | null | undefined) {
  const normalizedValue = normalizePhoneWhitespace(value ?? '')

  if (!normalizedValue) {
    return ''
  }

  const parsedPhone = parseOwnerPhone(normalizedValue)

  if (parsedPhone?.isValid()) {
    return parsedPhone.number
  }

  return normalizedValue
}

export function formatOwnerPhoneForDisplay(value: string | null | undefined) {
  const normalizedValue = normalizePhoneWhitespace(value ?? '')

  if (!normalizedValue) {
    return ''
  }

  const parsedPhone = parseOwnerPhone(normalizedValue)

  if (parsedPhone?.isValid()) {
    return parsedPhone.formatInternational()
  }

  return normalizedValue
}

export function getOwnerWhatsappDigits(value: string | null | undefined) {
  const parsedPhone = parseOwnerPhone(value)

  if (parsedPhone?.isValid()) {
    return parsedPhone.number.replace(/\D/g, '')
  }

  return null
}

export function getOwnerWhatsappUrl(value: string | null | undefined) {
  const digits = getOwnerWhatsappDigits(value)

  return digits ? `https://wa.me/${digits}` : null
}

export function formatOwnerPhoneAsYouType(value: string | null | undefined) {
  const normalizedValue = normalizePhoneWhitespace(value ?? '')

  if (!normalizedValue) {
    return ''
  }

  return new AsYouType(DEFAULT_COUNTRY).input(normalizedValue)
}

export { DEFAULT_COUNTRY }
