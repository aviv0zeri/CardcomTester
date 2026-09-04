import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SPECTRA_PROJECT_ID,
  checkSpectraHealth,
  createCustomer,
  createEmbeddedFieldsCheckoutSession,
  createHostedCheckoutSession,
  getCheckoutSession,
  getPayment,
  verifyCheckoutSession,
} from './spectraClient'

function mockFetchOnce(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('checkSpectraHealth', () => {
  it('calls GET /spectra-api/health', async () => {
    const fetchMock = mockFetchOnce(200, { status: 'ok' })
    const result = await checkSpectraHealth()
    expect(fetchMock).toHaveBeenCalledWith('/spectra-api/health', expect.any(Object))
    expect(result).toEqual({ status: 'ok' })
  })
})

describe('createCustomer', () => {
  it('POSTs the fixed CardcomTester project_id, never a caller-supplied one', async () => {
    const fetchMock = mockFetchOnce(200, {
      id: 'cust-1',
      project_id: SPECTRA_PROJECT_ID,
      external_reference: null,
      display_name: 'Ada',
      email: null,
      created_at: 't',
      updated_at: 't',
    })
    await createCustomer({ displayName: 'Ada' })

    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/spectra-api/customers')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      project_id: SPECTRA_PROJECT_ID,
      display_name: 'Ada',
      email: undefined,
    })
  })
})

describe('createHostedCheckoutSession', () => {
  it('always sends checkout_mode hosted and the fixed project_id', async () => {
    const fetchMock = mockFetchOnce(200, {
      checkout_session_id: 'cs-1',
      checkout_mode: 'hosted',
      status: 'OPEN',
      payment_id: 'pay-1',
      payment_status: 'PENDING',
      checkout_url: 'https://secure.cardcom.solutions/example',
    })
    const result = await createHostedCheckoutSession({ customerId: 'cust-1', amount: 10 })

    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/spectra-api/checkout-sessions')
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      project_id: SPECTRA_PROJECT_ID,
      customer_id: 'cust-1',
      amount: '10.00',
      currency: 'ILS',
      checkout_mode: 'hosted',
      language: 'he',
    })
    expect(result.payment_id).toBe('pay-1')
    expect(result.checkout_url).toBe('https://secure.cardcom.solutions/example')
  })
})

describe('createEmbeddedFieldsCheckoutSession', () => {
  it('always sends checkout_mode embedded_fields and the fixed project_id', async () => {
    const fetchMock = mockFetchOnce(200, {
      checkout_session_id: 'cs-2',
      checkout_mode: 'embedded_fields',
      status: 'OPEN',
      payment_id: 'pay-2',
      payment_status: 'PENDING',
      bootstrap: { session_reference: 'lp-session-2' },
    })
    const result = await createEmbeddedFieldsCheckoutSession({ customerId: 'cust-1', amount: 10 })

    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/spectra-api/checkout-sessions')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      project_id: SPECTRA_PROJECT_ID,
      customer_id: 'cust-1',
      amount: '10.00',
      currency: 'ILS',
      checkout_mode: 'embedded_fields',
      language: 'he',
    })
    expect(result.payment_id).toBe('pay-2')
    expect(result.bootstrap?.session_reference).toBe('lp-session-2')
    // The response carries no checkout_url for this mode -- session_reference (via
    // bootstrap) is the only thing the embedded presentation needs.
    expect(result.checkout_url).toBeUndefined()
  })
})

describe('getCheckoutSession', () => {
  it('GETs with the fixed project_id as a query parameter', async () => {
    const fetchMock = mockFetchOnce(200, {
      checkout_session_id: 'cs-1',
      checkout_mode: 'hosted',
      status: 'OPEN',
    })
    await getCheckoutSession('cs-1')
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/checkout-sessions/cs-1?project_id=${SPECTRA_PROJECT_ID}`)
  })
})

describe('verifyCheckoutSession', () => {
  it('POSTs to the verify endpoint with the fixed project_id', async () => {
    const fetchMock = mockFetchOnce(200, {
      checkout_session_id: 'cs-1',
      checkout_session_status: 'CLOSED',
      payment_id: 'pay-1',
      payment_status: 'SUCCEEDED',
    })
    const result = await verifyCheckoutSession('cs-1')
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/checkout-sessions/cs-1/verify?project_id=${SPECTRA_PROJECT_ID}`)
    expect(init.method).toBe('POST')
    expect(result.payment_status).toBe('SUCCEEDED')
  })
})

describe('getPayment', () => {
  it('GETs the persisted Payment with the fixed project_id', async () => {
    const fetchMock = mockFetchOnce(200, {
      id: 'pay-1',
      status: 'SUCCEEDED',
    })
    await getPayment('pay-1')
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/payments/pay-1?project_id=${SPECTRA_PROJECT_ID}`)
  })
})

describe('error handling', () => {
  it('surfaces the response error field on a non-2xx status', async () => {
    mockFetchOnce(404, { error: 'Payment abc not found' })
    await expect(getPayment('abc')).rejects.toThrow('Payment abc not found')
  })

  it('reports a clear message when the response is not JSON (proxy/server down)', async () => {
    const fn = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('<html>Bad Gateway</html>'),
    })
    vi.stubGlobal('fetch', fn)
    await expect(checkSpectraHealth()).rejects.toThrow(/not running on :8099/)
  })
})
