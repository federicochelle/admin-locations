import assert from 'node:assert/strict'
import test from 'node:test'
import { harness, locationId } from '../observability/harness.mjs'

const createdOwnerId = '44444444-4444-4444-8444-444444444444'

function buildInlineOwnerCreatePayload(input) {
  return {
    full_name: input.full_name.trim(),
    phone: input.phone.trim(),
  }
}

test('handleSubmit keeps an existing owner id and does not create an inline owner', async () => {
  const h = await harness()
  let ownerCreates = 0
  let payloadOwnerId = null
  const form = await h.formHandlers({
    buildPayload: (values) => {
      payloadOwnerId = values.owner_id
      return {
        ...values,
        selectedFeatureIds: [],
        selectedTagIds: [],
      }
    },
    createLocation: async (payload) => {
      assert.equal(payload.owner_id, 'existing-owner')
      return locationId
    },
    createOwner: async () => {
      ownerCreates += 1
      return createdOwnerId
    },
    ownerInputValue: 'Nuevo dueño',
    ownerPhoneValue: '099123456',
    values: { owner_id: 'existing-owner' },
  })

  await form.handleSubmit({ preventDefault() {} })

  assert.equal(ownerCreates, 0)
  assert.equal(payloadOwnerId, 'existing-owner')
  assert.equal(form.state.submitError, null)
})

test('handleSubmit creates an inline owner, updates owner state and builds payload with the new id', async () => {
  const h = await harness()
  const ownerPayloads = []
  const ownerSearchTerms = []
  const ownerPhoneInputs = []
  let payloadOwnerId = null
  const form = await h.formHandlers({
    buildInlineOwnerCreatePayload,
    buildPayload: (values) => {
      payloadOwnerId = values.owner_id
      return {
        ...values,
        selectedFeatureIds: [],
        selectedTagIds: [],
      }
    },
    createLocation: async (payload) => {
      assert.equal(payload.owner_id, createdOwnerId)
      return locationId
    },
    createOwner: async (payload, options) => {
      ownerPayloads.push({ options, payload })
      return createdOwnerId
    },
    ownerInputValue: '  Dueño Nuevo  ',
    ownerPhoneValue: ' 099123456 ',
    setOwnerPhoneInput: (value) => {
      ownerPhoneInputs.push(value)
    },
    setOwnerSearchTerm: (value) => {
      ownerSearchTerms.push(value)
    },
    setValues: (updater) => {
      h.context.values = updater(h.context.values)
    },
    values: { owner_id: '' },
  })

  await form.handleSubmit({ preventDefault() {} })

  assert.equal(ownerPayloads.length, 1)
  assert.deepEqual(ownerPayloads[0].payload, {
    full_name: 'Dueño Nuevo',
    phone: '099123456',
  })
  assert.equal(ownerPayloads[0].options.actorProfileId, 'actor')
  assert.equal(typeof ownerPayloads[0].options.correlationId, 'string')
  assert.equal(h.context.values.owner_id, createdOwnerId)
  assert.deepEqual(ownerSearchTerms, ['Dueño Nuevo'])
  assert.deepEqual(ownerPhoneInputs, ['099123456'])
  assert.equal(payloadOwnerId, createdOwnerId)
  assert.equal(form.state.submitError, null)
})

test('handleSubmit stops before saving the location when inline owner creation fails', async () => {
  const h = await harness()
  let locationCreates = 0
  let locationUpdates = 0
  const form = await h.formHandlers({
    buildInlineOwnerCreatePayload,
    createLocation: async () => {
      locationCreates += 1
      return locationId
    },
    createOwner: async () => {
      throw new Error('No pudimos crear el dueño.')
    },
    ownerInputValue: 'Dueño Nuevo',
    ownerPhoneValue: '099123456',
    setOwnerPhoneInput() {},
    setOwnerSearchTerm() {},
    setValues: (updater) => {
      h.context.values = updater(h.context.values)
    },
    updateLocation: async () => {
      locationUpdates += 1
      return locationId
    },
    values: { owner_id: '' },
  })

  await form.handleSubmit({ preventDefault() {} })

  assert.equal(locationCreates, 0)
  assert.equal(locationUpdates, 0)
  assert.equal(form.state.submitError, 'No pudimos crear el dueño.')
})
