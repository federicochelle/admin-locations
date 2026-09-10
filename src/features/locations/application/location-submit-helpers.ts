import { normalizeInlineOwnerValue } from './location-form.helpers'
import type { AdminErrorContext } from '../../../lib/admin-error-reporting'
import type { LocationFormValues } from '../locations.types'

type LocationSubmitMode = 'create' | 'edit' | 'view'

export function buildSubmitObservation(input: {
  correlationId: string
  locationId?: string
  mode: LocationSubmitMode
}): AdminErrorContext {
  return {
    operation: input.mode === 'edit' ? 'location.update' : 'location.create',
    stage: 'payload',
    resourceId: input.locationId,
    correlationId: input.correlationId,
    userFacing: true,
    outcome: 'failed',
  }
}

export function getLocationWriteObservationPatch(input: {
  locationId: string
  mode: LocationSubmitMode
}): Pick<AdminErrorContext, 'extraSafeContext' | 'outcome' | 'resourceId'> {
  return {
    resourceId: input.locationId,
    outcome: 'partial',
    extraSafeContext: {
      confirmed_stages:
        input.mode === 'edit'
          ? ['location.update', 'relations.features', 'relations.tags']
          : ['location.insert', 'relations.features', 'relations.tags'],
    },
  }
}

export function getSubmitErrorMessage(input: {
  createdOwnerName: string | null
  error: unknown
  mode: LocationSubmitMode
}) {
  const defaultErrorMessage =
    input.createdOwnerName
      ? `El dueño "${input.createdOwnerName}" se creó correctamente, pero no pudimos guardar la locación.`
      : input.mode === 'edit'
        ? 'No pudimos guardar los cambios.'
        : 'No pudimos guardar la locación.'

  if (!(input.error instanceof Error)) {
    return defaultErrorMessage
  }

  return input.createdOwnerName
    ? `${defaultErrorMessage} ${input.error.message}`
    : input.error.message
}

export function getInlineOwnerDraft(input: {
  ownerName: string
  ownerPhone: string
}) {
  const normalizedOwnerName = normalizeInlineOwnerValue(input.ownerName)
  const normalizedOwnerPhone = normalizeInlineOwnerValue(input.ownerPhone)

  return {
    full_name: normalizedOwnerName,
    phone: normalizedOwnerPhone,
    shouldCreate:
      normalizedOwnerName.length > 0 && normalizedOwnerPhone.length > 0,
  }
}

export function buildSubmitPayloadValues(
  values: LocationFormValues,
  resolvedOwnerId: string | null,
) {
  return {
    ...values,
    owner_id: resolvedOwnerId ?? '',
  }
}
