import { describe, expect, it, vi } from 'vitest'
const { createSpectraProxyHandler, buildUpstreamPath, DEFAULT_BASE_URL } = require('./spectraProxy')

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
  it('joins catch-all path segments and preserves other query params', () => {
    const path = buildUpstreamPath({
      path: ['customers', '27deaf53-c43d-4d10-b2e4-5415e2f3c699'],
      project_id: 'cardcom-tester',
    })
    expect(path).toBe('/customers/27deaf53-c43d-4d10-b2e4-5415e2f3c699?project_id=cardcom-tester')
  })

  it('handles a bare single-segment path with no extra query params', () => {
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
    const req = { method: 'GET', query: { path: ['health'] } }
    await handler(req, mockRes())
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://payments.avivozeri.com/health',
      expect.anything(),
    )
  })

  it('injects the server-side Bearer token, constructed only from configuration', async () => {
    const fetchImpl = fakeUpstream(200, {})
    const handler = createSpectraProxyHandler({ token: 'server-secret-value', fetchImpl })
    const req = { method: 'GET', query: { path: ['health'] } }
    await handler(req, mockRes())
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer server-secret-value')
  })

  it('ignores a hostile browser-supplied Authorization header entirely', async () => {
    const fetchImpl = fakeUpstream(200, {})
    const handler = createSpectraProxyHandler({ token: 'server-secret-value', fetchImpl })
    const req = {
      method: 'GET',
      query: { path: ['health'] },
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
    const req = { method: 'GET', query: { path: ['health'] } }
    const res = mockRes()
    await handler(req, res)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(500)
  })

  it('rejects an unsupported method before ever calling upstream', async () => {
    const fetchImpl = fakeUpstream(200, {})
    const handler = createSpectraProxyHandler({ token: 'test-token', fetchImpl })
    const req = { method: 'DELETE', query: { path: ['customers', 'abc'] } }
    const res = mockRes()
    await handler(req, res)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(405)
  })

  it('propagates the upstream status code and JSON body unchanged', async () => {
    const fetchImpl = fakeUpstream(403, { error: 'project proj-b does not belong to the requesting project' })
    const handler = createSpectraProxyHandler({ token: 'test-token', fetchImpl })
    const req = { method: 'GET', query: { path: ['customers', 'x'], project_id: 'proj-b' } }
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
      query: { path: ['customers'] },
      body: { project_id: 'cardcom-tester', display_name: 'Someone' },
    }
    await handler(req, mockRes())
    const [, init] = fetchImpl.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ project_id: 'cardcom-tester', display_name: 'Someone' })
  })

  it('never returns the credential to the caller in the response body', async () => {
    const fetchImpl = fakeUpstream(200, { status: 'ok' })
    const handler = createSpectraProxyHandler({ token: 'super-secret-value', fetchImpl })
    const req = { method: 'GET', query: { path: ['health'] } }
    const res = mockRes()
    await handler(req, res)
    expect(JSON.stringify(res.body)).not.toContain('super-secret-value')
  })

  it('defaults to the production spectra-payments origin when unconfigured', () => {
    expect(DEFAULT_BASE_URL).toBe('https://payments.avivozeri.com')
  })
})
