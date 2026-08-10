const CONTACT_METADATA_START = '[admin_request_contact]'
const CONTACT_METADATA_END = '[/admin_request_contact]'

export type RequestProjectContactMetadata = {
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  notes: string | null
}

function normalizeValue(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null
}

export function buildRequestProjectMessageWithContactMetadata(input: {
  contactName: string
  contactEmail: string
  contactPhone: string
  notes: string | null
}) {
  const metadataLines = [
    CONTACT_METADATA_START,
    `contact_name=${input.contactName.trim()}`,
    `contact_email=${input.contactEmail.trim()}`,
    `contact_phone=${input.contactPhone.trim()}`,
    CONTACT_METADATA_END,
  ]
  const notes = normalizeValue(input.notes)

  return notes ? `${metadataLines.join('\n')}\n\n${notes}` : metadataLines.join('\n')
}

export function parseRequestProjectMessageWithContactMetadata(
  message: string | null | undefined,
): RequestProjectContactMetadata {
  const normalizedMessage = message?.replace(/\r\n/g, '\n').trim() || ''

  if (!normalizedMessage.startsWith(CONTACT_METADATA_START)) {
    return {
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      notes: normalizeValue(message),
    }
  }

  const endIndex = normalizedMessage.indexOf(CONTACT_METADATA_END)

  if (endIndex === -1) {
    return {
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      notes: normalizeValue(message),
    }
  }

  const metadataBlock = normalizedMessage
    .slice(CONTACT_METADATA_START.length, endIndex)
    .trim()
  const notesBlock = normalizedMessage
    .slice(endIndex + CONTACT_METADATA_END.length)
    .trim()
  const metadata = new Map<string, string>()

  for (const line of metadataBlock.split('\n')) {
    const separatorIndex = line.indexOf('=')

    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()

    if (!key) {
      continue
    }

    metadata.set(key, value)
  }

  return {
    contactName: normalizeValue(metadata.get('contact_name')),
    contactEmail: normalizeValue(metadata.get('contact_email')),
    contactPhone: normalizeValue(metadata.get('contact_phone')),
    notes: normalizeValue(notesBlock),
  }
}
