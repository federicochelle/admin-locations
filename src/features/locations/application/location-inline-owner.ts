import type { Dispatch, SetStateAction } from 'react'
import type { AdminErrorContext } from '../../../lib/admin-error-reporting'
import type { LocationFormValues } from '../locations.types'
import type { getInlineOwnerDraft } from './location-submit-helpers'

type InlineOwnerCreatePayload = {
  full_name: string
  company_name: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  document_or_rut: string | null
  notes: string | null
  status: string
}

type ResolveInlineLocationOwnerInput = {
  actorProfileId: string | null
  buildInlineOwnerCreatePayload: (input: {
    full_name: string
    phone: string
  }) => InlineOwnerCreatePayload
  createOwner: (
    payload: InlineOwnerCreatePayload,
    options?: {
      actorProfileId?: string | null
      correlationId?: string
    },
  ) => Promise<string>
  currentOwnerId: string | null
  getInlineOwnerDraft: typeof getInlineOwnerDraft
  observation: AdminErrorContext
  ownerInputValue: string
  ownerPhoneValue: string
  setOwnerPhoneInput: (value: string) => void
  setOwnerSearchTerm: (value: string) => void
  setValues: Dispatch<SetStateAction<LocationFormValues>>
}

export async function resolveInlineLocationOwner({
  actorProfileId,
  buildInlineOwnerCreatePayload,
  createOwner,
  currentOwnerId,
  getInlineOwnerDraft,
  observation,
  ownerInputValue,
  ownerPhoneValue,
  setOwnerPhoneInput,
  setOwnerSearchTerm,
  setValues,
}: ResolveInlineLocationOwnerInput) {
  if (currentOwnerId) {
    return {
      createdOwnerName: null,
      ownerId: currentOwnerId,
    }
  }

  const inlineOwnerDraft = getInlineOwnerDraft({
    ownerName: ownerInputValue,
    ownerPhone: ownerPhoneValue,
  })

  if (!inlineOwnerDraft.shouldCreate) {
    return {
      createdOwnerName: null,
      ownerId: currentOwnerId,
    }
  }

  observation.stage = 'owner.inline'
  observation.provider = 'supabase'
  const resolvedOwnerId = await createOwner(
    buildInlineOwnerCreatePayload({
      full_name: inlineOwnerDraft.full_name,
      phone: inlineOwnerDraft.phone,
    }),
    {
      actorProfileId,
      correlationId: observation.correlationId,
    },
  )
  observation.outcome = 'partial'
  observation.extraSafeContext = { confirmed_stages: ['owner.inline'] }
  setValues((currentValues) => ({
    ...currentValues,
    owner_id: resolvedOwnerId ?? '',
  }))
  setOwnerSearchTerm(inlineOwnerDraft.full_name)
  setOwnerPhoneInput(inlineOwnerDraft.phone)

  return {
    createdOwnerName: inlineOwnerDraft.full_name,
    ownerId: resolvedOwnerId,
  }
}
