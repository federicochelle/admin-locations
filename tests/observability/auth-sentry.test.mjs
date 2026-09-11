import test from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './harness.mjs'

const userId = '11111111-1111-4111-8111-111111111111'
const profileId = '33333333-3333-4333-8333-333333333333'

test('auth identity sets Sentry user with id and email only', async () => {
  const h = await harness()
  const authSentry = await h.module('src/features/auth/auth-sentry')
  authSentry.applySentryAuthSession({ id: userId, email: 'admin@example.com' })
  assert.equal(h.sentryState.users.at(-1).id, userId)
  assert.equal(h.sentryState.users.at(-1).email, 'admin@example.com')
})

test('auth identity clears user, profile tags and context on logout/no session', async () => {
  const h = await harness()
  const authSentry = await h.module('src/features/auth/auth-sentry')
  authSentry.clearSentryAdminIdentity()
  assert.equal(h.sentryState.users.at(-1), null)
  assert.deepEqual(h.sentryState.contexts.at(-1), { name: 'admin_profile', context: null })
  assert.deepEqual(h.sentryState.tags.slice(-2), [
    { key: 'profile_id', value: undefined },
    { key: 'role', value: undefined },
  ])
})

test('auth profile sets safe Sentry tags and context without profile metadata', async () => {
  const h = await harness()
  const authSentry = await h.module('src/features/auth/auth-sentry')
  authSentry.applySentryAdminProfile({
    id: profileId,
    user_id: userId,
    role: 'admin',
    full_name: 'Private Name',
    company_name: 'Private Company',
    phone: '+59899123456',
  }, userId)
  assert.deepEqual(h.sentryState.tags.slice(-2), [
    { key: 'profile_id', value: profileId },
    { key: 'role', value: 'admin' },
  ])
  assert.equal(h.sentryState.contexts.at(-1).name, 'admin_profile')
  assert.equal(h.sentryState.contexts.at(-1).context.profile_id, profileId)
  assert.equal(h.sentryState.contexts.at(-1).context.role, 'admin')
  assert.equal(JSON.stringify(h.sentryState).includes('Private Name'), false)
  assert.equal(JSON.stringify(h.sentryState).includes('Private Company'), false)
  assert.equal(JSON.stringify(h.sentryState).includes('+598'), false)
})

test('auth profile clears Sentry profile tags when profile belongs to another user', async () => {
  const h = await harness()
  const authSentry = await h.module('src/features/auth/auth-sentry')
  authSentry.applySentryAdminProfile({ id: profileId, user_id: userId, role: 'admin' }, '22222222-2222-4222-8222-222222222222')
  assert.deepEqual(h.sentryState.contexts.at(-1), { name: 'admin_profile', context: null })
  assert.deepEqual(h.sentryState.tags.slice(-2), [
    { key: 'profile_id', value: undefined },
    { key: 'role', value: undefined },
  ])
})
