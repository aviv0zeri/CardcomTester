import { afterEach, describe, expect, it, vi } from 'vitest'
const { createSpectraProxyHandler, buildUpstreamPath, DEFAULT_BASE_URL, DEFAULT_PROFILE_ID, envVarForProfile } = require('./spectraProxy')

function mockRes() {
  const res = {
    statusCode: undefined,
    body: undefined,
    headers: {},
    status(code) {
      res.statusCode = code
      return res
    },
    json(payload) {
      res.body = payload
      return res
    },
    send(payload) {
      res.body = payload
      return res
    },
    setHeader(name, value) {
      res.headers[name] = value
    },
  }
  return res
}

function fakeUpstream(status, body) {
  return vi.fn().mockResolvedValue({
    status,
    text: async () => JSON.stringify(body),
  })
}

describe('buildUpstreamPath', () => {
  // `path` is the regex-captured sub-path from the vercel.json rewrite
  // (/spectra-api/(.*) -> /api/spectra-proxy?path=$1) -- always a single
  // string in production, e.g. "customers/27deaf53-...".
  it('re-splits the captured sub-path and preserves other query params', () => {
    const path = buildUpstreamPath({
      path: 'customers/27deaf53-c43d-4d10-b2e4-5415e2f3c699',
      project_id: 'cardcom-tester',
    })
    expect(path).toBe('/customers/27deaf53-c43d-4d10-b2e4-5415e2f3c699?project_id=cardcom-tester')
  })

  it('handles a bare single-segment path with no extra query params', () => {
    expect(buildUpstreamPath({ path: 'health' })).toBe('/health')
  })

  it('also accepts an array (defensive -- not the real production shape)', () => {
    expect(buildUpstreamPath({ path: ['health'] })).toBe('/health')
  })
})

describe('createSpectraProxyHandler -- upstream target and auth', () => {
  it('always targets the configured base URL, never something the browser supplies', async () => {
    const fetchImpl = fakeUpstream(200, { status: 'ok' })
    const handler = createSpectraProxyHandler({
      baseUrl: 'https://payments.avivozeri.com',
      token: 'test-token',
      fetchImpl,
    })
    const req = { method: 'GET', query: { path: 'health' } }
    await handler(req, mockRes())
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://payments.avivozeri.com/health',
      expect.anything(),
    )
  })

  it('injects the server-side Bearer token, constructed only from configuration', async () => {
    const fetchImpl = fakeUpstream(200, {})
    const handler = createSpectraProxyHandler({ token: 'server-secret-value', fetchImpl })
    const req = { method: 'GET', query: { path: 'health' } }
    await handler(req, mockRes())
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer server-secret-value')
  })

  it('ignores a hostile browser-supplied Authorization header entirely', async () => {
    const fetchImpl = fakeUpstream(200, {})
    const handler = createSpectraProxyHandler({ token: 'server-secret-value', fetchImpl })
    const req = {
      method: 'GET',
      query: { path: 'health' },
      headers: { authorization: 'Bearer attacker-supplied-credential' },
    }
    await handler(req, mockRes())
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer server-secret-value')
    expect(init.headers.Authorization).not.toContain('attacker-supplied-credential')
  })

  it('fails closed with 500 when no token is configured, without calling upstream', async () => {
    const fetchImpl = fakeUpstream(200, {})
    const handler = createSpectraProxyHandler({ token: undefined, fetchImpl })
    const req = { method: 'GET', query: { path: 'health' } }
    const res = mockRes()
    await handler(req, res)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(500)
  })

  it('rejects an unsupported method before ever calling upstream', async () => {
    const fetchImpl = fakeUpstream(200, {})
    const handler = createSpectraProxyHandler({ token: 'test-token', fetchImpl })
    const req = { method: 'DELETE', query: { path: 'customers/abc' } }
    const res = mockRes()
    await handler(req, res)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(405)
  })

  it('propagates the upstream status code and JSON body unchanged', async () => {
    const fetchImpl = fakeUpstream(403, { error: 'project proj-b does not belong to the requesting project' })
    const handler = createSpectraProxyHandler({ token: 'test-token', fetchImpl })
    const req = { method: 'GET', query: { path: 'customers/x', project_id: 'proj-b' } }
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({ error: 'project proj-b does not belong to the requesting project' })
  })

  it('forwards the POST body as JSON to the upstream request', async () => {
    const fetchImpl = fakeUpstream(200, { id: 'new-customer' })
    const handler = createSpectraProxyHandler({ token: 'test-token', fetchImpl })
    const req = {
      method: 'POST',
      query: { path: 'customers' },
      body: { project_id: 'cardcom-tester', display_name: 'Someone' },
    }
    await handler(req, mockRes())
    const [, init] = fetchImpl.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ project_id: 'cardcom-tester', display_name: 'Someone' })
  })

  it('never returns the credential to the caller in the response body', async () => {
    const fetchImpl = fakeUpstream(200, { status: 'ok' })
    const handler = createSpectraProxyHandler({ token: 'super-secret-value', fetchImpl })
    const req = { method: 'GET', query: { path: 'health' } }
    const res = mockRes()
    await handler(req, res)
    expect(JSON.stringify(res.body)).not.toContain('super-secret-value')
  })

  it('defaults to the production spectra-payments origin when unconfigured', () => {
    expect(DEFAULT_BASE_URL).toBe('https://payments.avivozeri.com')
  })
})

describe('createSpectraProxyHandler -- per-profile credentials', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses the default token when no X-Spectra-Profile header is present, unchanged from before', async () => {
    const fetchImpl = fakeUpstream(200, {})
    const handler = createSpectraProxyHandler({ token: 'gateopen-token', fetchImpl })
    const req = { method: 'GET', query: { path: 'health' } }
    await handler(req, mockRes())
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer gateopen-token')
  })

  it(`explicitly naming the default profile ("${DEFAULT_PROFILE_ID}") behaves identically to omitting it`, async () => {
    const fetchImpl = fakeUpstream(200, {})
    const handler = createSpectraProxyHandler({ token: 'gateopen-token', fetchImpl })
    const req = { method: 'GET', query: { path: 'health' }, headers: { 'x-spectra-profile': DEFAULT_PROFILE_ID } }
    await handler(req, mockRes())
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer gateopen-token')
  })

  it('selects a different profile\'s token (from options.tokensByProfile) via the X-Spectra-Profile header', async () => {
    const fetchImpl = fakeUpstream(200, {})
    const handler = createSpectraProxyHandler({
      token: 'gateopen-token',
      tokensByProfile: { 'cardcom-tester': 'cardcom-tester-token' },
      fetchImpl,
    })
    const req = { method: 'GET', query: { path: 'customers/x' }, headers: { 'x-spectra-profile': 'cardcom-tester' } }
    await handler(req, mockRes())
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer cardcom-tester-token')
  })

  it('falls back to a derived env var when no options.tokensByProfile override is given', async () => {
    vi.stubEnv('SPECTRA_PAYMENTS_API_TOKEN_CARDCOM_TESTER', 'from-env-token')
    const fetchImpl = fakeUpstream(200, {})
    const handler = createSpectraProxyHandler({ token: 'gateopen-token', fetchImpl })
    const req = { method: 'GET', query: { path: 'health' }, headers: { 'x-spectra-profile': 'cardcom-tester' } }
    await handler(req, mockRes())
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer from-env-token')
  })

  it('fails closed with a profile-specific 500 when the named profile has no configured token', async () => {
    const fetchImpl = fakeUpstream(200, {})
    const handler = createSpectraProxyHandler({ token: 'gateopen-token', fetchImpl })
    const req = { method: 'GET', query: { path: 'health' }, headers: { 'x-spectra-profile': 'some-unconfigured-profile' } }
    const res = mockRes()
    await handler(req, res)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toContain('some-unconfigured-profile')
  })

  it('never lets a request supply its own profile-specific credential directly', async () => {
    // Only the header selects WHICH configured credential is used; there is no
    // way for a request to inject a token value itself -- confirmed above via
    // options.tokensByProfile / env vars being the only sources.
    const fetchImpl = fakeUpstream(200, {})
    const handler = createSpectraProxyHandler({ token: 'gateopen-token', tokensByProfile: {}, fetchImpl })
    const req = {
      method: 'GET',
      query: { path: 'health' },
      headers: { 'x-spectra-profile': 'cardcom-tester', authorization: 'Bearer attacker-value' },
    }
    const res = mockRes()
    await handler(req, res)
    // No env var and no tokensByProfile entry for cardcom-tester -> fails closed.
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(500)
  })
})

describe('envVarForProfile', () => {
  it('derives an uppercase, underscore-joined env var name from a hyphenated profile id', () => {
    expect(envVarForProfile('cardcom-tester')).toBe('SPECTRA_PAYMENTS_API_TOKEN_CARDCOM_TESTER')
  })
})
