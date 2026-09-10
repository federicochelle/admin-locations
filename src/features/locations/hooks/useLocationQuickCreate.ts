import { useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { createAdminCorrelationId, type AdminErrorContext } from '../../../lib/admin-error-reporting'
import {
  formatOwnerPhoneForInput,
  toE164OwnerPhone,
} from '../../../lib/phone'
import { createCategory } from '../../categories/categories.service'
import { normalizeCategoryLocationCodePrefixInput } from '../../categories/location-code-prefix'
import { createOwner } from '../../owners/owners.service'
import { createZone } from '../../zones/zones.service'
import type { LocationOwnerQuickCreateValues } from '../LocationOwnerQuickCreateModal'
import {
  normalizeInlineOwnerValue,
  slugifyCategoryName,
  slugifyZoneName,
  toNullableString,
} from '../application/location-form.helpers'
import type {
  LocationDepartmentOption,
  LocationFormOptions,
  LocationFormValues,
} from '../locations.types'

const defaultOwnerQuickCreateValues: LocationOwnerQuickCreateValues = {
  full_name: '',
  company_name: '',
  email: '',
  phone: '',
  notes: '',
}

function buildOwnerQuickCreatePayload(values: LocationOwnerQuickCreateValues) {
  return {
    full_name: normalizeInlineOwnerValue(values.full_name),
    company_name: toNullableString(values.company_name),
    email: toNullableString(values.email),
    phone: toE164OwnerPhone(values.phone),
    whatsapp: null,
    document_or_rut: null,
    notes: toNullableString(values.notes),
    status: 'active',
  }
}

type UseLocationQuickCreateInput = {
  isReadOnly: boolean
  profileId: string | null
  refreshOptions: () => Promise<LocationFormOptions>
  reportLocationFailure: (error: unknown, context: Partial<AdminErrorContext>) => void
  selectedDepartment: LocationDepartmentOption | null
  setCategorySearchTerm: Dispatch<SetStateAction<string>>
  setOwnerPhoneInput: Dispatch<SetStateAction<string>>
  setOwnerSearchTerm: Dispatch<SetStateAction<string>>
  setValues: Dispatch<SetStateAction<LocationFormValues>>
  setZoneSearchTerm: Dispatch<SetStateAction<string>>
  valuesDepartmentId: string
}

export function useLocationQuickCreate({
  isReadOnly,
  profileId,
  refreshOptions,
  reportLocationFailure,
  selectedDepartment,
  setCategorySearchTerm,
  setOwnerPhoneInput,
  setOwnerSearchTerm,
  setValues,
  setZoneSearchTerm,
  valuesDepartmentId,
}: UseLocationQuickCreateInput) {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [categoryCreateName, setCategoryCreateName] = useState('')
  const [categoryCreateLocationCodePrefix, setCategoryCreateLocationCodePrefix] =
    useState('')
  const [categoryCreateError, setCategoryCreateError] = useState<string | null>(null)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false)
  const [zoneCreateName, setZoneCreateName] = useState('')
  const [zoneCreateError, setZoneCreateError] = useState<string | null>(null)
  const [isCreatingZone, setIsCreatingZone] = useState(false)
  const [zoneDepartmentPrompt, setZoneDepartmentPrompt] = useState<string | null>(null)
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false)
  const [ownerCreateValues, setOwnerCreateValues] =
    useState<LocationOwnerQuickCreateValues>(defaultOwnerQuickCreateValues)
  const [ownerCreateError, setOwnerCreateError] = useState<string | null>(null)
  const [isCreatingOwner, setIsCreatingOwner] = useState(false)

  function handleOwnerCreateChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (isReadOnly) {
      return
    }

    const { name, value } = event.target

    setOwnerCreateValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }))
  }

  function handleCategoryCreateChange(event: ChangeEvent<HTMLInputElement>) {
    if (isReadOnly) {
      return
    }

    setCategoryCreateName(event.target.value)
  }

  function handleCategoryCreateLocationCodePrefixChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    if (isReadOnly) {
      return
    }

    setCategoryCreateLocationCodePrefix(
      normalizeCategoryLocationCodePrefixInput(event.target.value),
    )
  }

  function handleOpenCategoryModal() {
    if (isReadOnly) {
      return
    }

    setCategoryCreateError(null)
    setCategoryCreateName('')
    setCategoryCreateLocationCodePrefix('')
    setIsCategoryModalOpen(true)
  }

  function handleCloseCategoryModal() {
    if (isCreatingCategory) {
      return
    }

    setIsCategoryModalOpen(false)
    setCategoryCreateError(null)
    setCategoryCreateName('')
    setCategoryCreateLocationCodePrefix('')
  }

  function handleOpenZoneModal() {
    if (isReadOnly) {
      return
    }

    if (!valuesDepartmentId) {
      setZoneDepartmentPrompt('Primero seleccioná un departamento.')
      return
    }

    setZoneDepartmentPrompt(null)
    setZoneCreateError(null)
    setZoneCreateName('')
    setIsZoneModalOpen(true)
  }

  function handleCloseZoneModal() {
    if (isCreatingZone) {
      return
    }

    setIsZoneModalOpen(false)
    setZoneCreateError(null)
    setZoneCreateName('')
  }

  function handleZoneCreateChange(event: ChangeEvent<HTMLInputElement>) {
    if (isReadOnly) {
      return
    }

    setZoneCreateName(event.target.value)
  }

  function handleCloseOwnerModal() {
    if (isCreatingOwner) {
      return
    }

    setIsOwnerModalOpen(false)
    setOwnerCreateError(null)
    setOwnerCreateValues(defaultOwnerQuickCreateValues)
  }

  async function handleCategoryQuickCreateSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (isReadOnly) {
      return
    }

    const trimmedName = categoryCreateName.trim()
    const normalizedLocationCodePrefix = normalizeCategoryLocationCodePrefixInput(
      categoryCreateLocationCodePrefix,
    )

    if (!trimmedName) {
      setCategoryCreateError('El nombre es obligatorio.')
      return
    }

    if (!normalizedLocationCodePrefix) {
      setCategoryCreateError('El prefijo de código es obligatorio.')
      return
    }

    const correlationId = createAdminCorrelationId()
    try {
      setIsCreatingCategory(true)
      setCategoryCreateError(null)

      const createdCategoryId = await createCategory({
        name: trimmedName,
        slug: slugifyCategoryName(trimmedName) || 'categoria',
        location_code_prefix: normalizedLocationCodePrefix,
        parent_id: null,
        sort_order: 0,
        active: true,
      }, {
        actorProfileId: profileId,
        correlationId,
      })
      const nextOptions = await refreshOptions()

      setValues((currentValues) => ({
        ...currentValues,
        category_id: createdCategoryId,
      }))
      const createdCategory =
        nextOptions.categories.find((category) => category.id === createdCategoryId) ?? null
      setCategorySearchTerm(createdCategory?.name ?? trimmedName)
      setIsCategoryModalOpen(false)
      setCategoryCreateName('')
      setCategoryCreateLocationCodePrefix('')
    } catch (error) {
      reportLocationFailure(error, { operation: 'location.category.create', stage: 'request', provider: 'supabase', correlationId })
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos crear la categoría.'

      setCategoryCreateError(message)
    } finally {
      setIsCreatingCategory(false)
    }
  }

  async function handleZoneQuickCreateSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (isReadOnly) {
      return
    }

    const trimmedName = zoneCreateName.trim()

    if (!trimmedName) {
      setZoneCreateError('El nombre es obligatorio.')
      return
    }

    if (!valuesDepartmentId || !selectedDepartment) {
      setZoneCreateError('Primero seleccioná un departamento.')
      return
    }

    const correlationId = createAdminCorrelationId()
    try {
      setIsCreatingZone(true)
      setZoneCreateError(null)

      const createdZoneId = await createZone({
        name: trimmedName,
        slug: slugifyZoneName(trimmedName) || 'zona',
        department_id: valuesDepartmentId,
        active: true,
        department: selectedDepartment.name,
        lat: null,
        lng: null,
      }, {
        actorProfileId: profileId,
        correlationId,
      })
      const nextOptions = await refreshOptions()

      setValues((currentValues) => ({
        ...currentValues,
        zone_id: createdZoneId,
      }))
      const createdZone =
        nextOptions.zones.find((zone) => zone.id === createdZoneId) ?? null
      setZoneSearchTerm(createdZone?.name ?? trimmedName)
      setZoneDepartmentPrompt(null)
      setIsZoneModalOpen(false)
      setZoneCreateName('')
    } catch (error) {
      reportLocationFailure(error, { operation: 'location.zone.create', stage: 'request', provider: 'supabase', correlationId })
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos crear la zona.'

      setZoneCreateError(message)
    } finally {
      setIsCreatingZone(false)
    }
  }

  async function handleOwnerQuickCreateSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (isReadOnly) {
      return
    }

    const trimmedName = ownerCreateValues.full_name.trim()

    if (!trimmedName) {
      setOwnerCreateError('El nombre completo es obligatorio.')
      return
    }

    if (ownerCreateValues.phone.trim().length > 0 && !toE164OwnerPhone(ownerCreateValues.phone)) {
      setOwnerCreateError('Ingresá un teléfono válido con código de país.')
      return
    }

    const correlationId = createAdminCorrelationId()
    try {
      setIsCreatingOwner(true)
      setOwnerCreateError(null)

      const createdOwnerId = await createOwner(
        buildOwnerQuickCreatePayload(ownerCreateValues),
        {
          actorProfileId: profileId,
          correlationId,
        },
      )
      const nextOptions = await refreshOptions()

      setValues((currentValues) => ({
        ...currentValues,
        owner_id: createdOwnerId,
      }))
      const createdOwner =
        nextOptions.owners.find((owner) => owner.id === createdOwnerId) ?? null
      setOwnerSearchTerm(createdOwner?.full_name ?? normalizeInlineOwnerValue(trimmedName))
      setOwnerPhoneInput(
        formatOwnerPhoneForInput(
          createdOwner?.phone ?? normalizeInlineOwnerValue(ownerCreateValues.phone),
        ),
      )
      setIsOwnerModalOpen(false)
      setOwnerCreateValues(defaultOwnerQuickCreateValues)
    } catch (error) {
      reportLocationFailure(error, { operation: 'location.owner.create', stage: 'request', provider: 'supabase', correlationId })
      const message =
        error instanceof Error
          ? error.message
          : 'No pudimos crear el dueño.'

      setOwnerCreateError(message)
    } finally {
      setIsCreatingOwner(false)
    }
  }

  return {
    categoryCreateError,
    categoryCreateLocationCodePrefix,
    categoryCreateName,
    handleCategoryCreateChange,
    handleCategoryCreateLocationCodePrefixChange,
    handleCategoryQuickCreateSubmit,
    handleCloseCategoryModal,
    handleCloseOwnerModal,
    handleCloseZoneModal,
    handleOpenCategoryModal,
    handleOpenZoneModal,
    handleOwnerCreateChange,
    handleOwnerQuickCreateSubmit,
    handleZoneCreateChange,
    handleZoneQuickCreateSubmit,
    isCategoryModalOpen,
    isCreatingCategory,
    isCreatingOwner,
    isCreatingZone,
    isOwnerModalOpen,
    isZoneModalOpen,
    ownerCreateError,
    ownerCreateValues,
    setZoneDepartmentPrompt,
    zoneCreateError,
    zoneCreateName,
    zoneDepartmentPrompt,
  }
}
