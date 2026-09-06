import { describe, expect, it } from 'vitest'
const { toProxyRequest } = require('./index')

// Regression test: toProxyRequest once dropped `headers` entirely, so the
// shared spectraProxy handler's X-Spectra-Profile credential-selection (see
// spectraProxy.test.js) silently always fell back to the default profile in
// local dev, no matter what the browser actually sent -- production's
// api/spectra-proxy.js passes the real `req` and was never affected, which is
// exactly why this slipped past every other test.
describe('toProxyRequest', () => {
  it('forwards headers (X-Spectra-Profile lives there, not in query/body)', () => {
    const req = {
      method: 'POST',
      path: '/customers',
      query: {},
      body: { project_id: 'cardcom-tester' },
      headers: { 'x-spectra-profile': 'cardcom-tester', 'content-type': 'application/json' },
    }
    const result = toProxyRequest(req)
    expect(result.headers).toEqual(req.headers)
  })

  it('rewrites the Express sub-path into the same ?path= shape Vercel already sends', () => {
    const req = { method: 'GET', path: '/customers/abc', query: { project_id: 'gateopen' }, body: undefined, headers: {} }
    const result = toProxyRequest(req)
    expect(result.query).toEqual({ project_id: 'gateopen', path: 'customers/abc' })
  })
})
