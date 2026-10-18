import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'

// Run against a locally running app: bunx vite --host localhost --port 3000.
const origin = process.env.AUTH_TEST_URL ?? 'http://localhost:3000'
const request = (path, options) =>
  fetch(new URL(path, origin), { redirect: 'manual', ...options })

test('guests are redirected before workspace content renders', async () => {
  const response = await request('/')
  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), '/login')
  assert.doesNotMatch(await response.text(), /aria-label="Workspace"/)
})

test('login is server rendered and publicly accessible', async () => {
  const response = await request('/login')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
  const html = await response.text()
  assert.match(html, /Welcome back\./)
  assert.match(html, /autocomplete="current-password"/i)
  assert.match(html, /type="password"/)
})

test('a forged session cookie cannot unlock the workspace', async () => {
  const response = await request('/', {
    headers: { cookie: 'better-auth.session_token=forged.invalid-signature' },
  })
  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), '/login')
})

test('the same-origin auth proxy returns no session for guests', async () => {
  const response = await request('/api/auth/get-session')
  assert.equal(response.status, 200)
  assert.equal(await response.json(), null)
})

test('invalid credentials cannot establish a session', async () => {
  const response = await request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({
      email: `missing-${randomUUID()}@example.com`,
      password: randomUUID(),
    }),
  })
  assert.equal(response.status, 401)
  assert.doesNotMatch(
    response.headers.get('set-cookie') ?? '',
    /session_token=/,
  )
})

test('auth writes from an untrusted origin are rejected', async () => {
  const response = await request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://untrusted.example',
    },
    body: JSON.stringify({
      email: 'nobody@example.com',
      password: randomUUID(),
    }),
  })
  assert.equal(response.status, 403)
})
