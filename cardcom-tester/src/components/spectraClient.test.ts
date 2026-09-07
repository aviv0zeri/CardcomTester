import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SPECTRA_PROJECT_ID,
  cancelSubscription,
  checkSpectraHealth,
  createCustomer,
  createEmbeddedFieldsCheckoutSession,
  createHostedCheckoutSession,
  executeDuePeriod,
  getCheckoutSession,
  getCustomer,
  getPayment,
  getPaymentMethod,
  getSubscription,
  listCustomers,
  listPaymentAttempts,
  listPaymentDocuments,
  listPaymentsForCustomer,
  listPaymentsForSubscription,
  listSubscriptions,
  listSubscriptionsForCustomer,
  reconcilePayment,
  reexecutePayment,
  resolveSpectraCustomer,
  verifyCheckoutSession,
} from './spectraClient'
import type { SpectraCustomer } from './spectraClient'
import { DEFAULT_PROFILE } from './profiles'

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

describe('resolveSpectraCustomer', () => {
  const existingCustomer: SpectraCustomer = {
    id: 'cust-existing',
    project_id: SPECTRA_PROJECT_ID,
    external_reference: null,
    display_name: 'Guided Tester',
    email: null,
    created_at: 't',
    updated_at: 't',
  }

  // A: first Spectra create -- no existing Customer, so `create` runs once.
  it('creates a Customer when none exists yet', async () => {
    const create = vi.fn().mockResolvedValue(existingCustomer)
    const result = await resolveSpectraCustomer(null, create)
    expect(create).toHaveBeenCalledTimes(1)
    expect(result).toBe(existingCustomer)
  })

  // B + C: a retry (e.g. after a CheckoutSession/LowProfile failure) must
  // reuse the already-created Customer -- `create` must NOT run again, and
  // the SAME Customer object/id comes back.
  it('reuses an existing Customer without calling create again', async () => {
    const create = vi.fn().mockRejectedValue(new Error('must not be called'))
    const result = await resolveSpectraCustomer(existingCustomer, create)
    expect(create).not.toHaveBeenCalled()
    expect(result).toBe(existingCustomer)
    expect(result.id).toBe('cust-existing')
  })

  // D: a genuinely new/reset run (existing cleared back to null, matching
  // GuidedWalkthrough's clearRun()) creates a Customer normally again.
  it('creates a fresh Customer again once the caller has reset to null', async () => {
    const secondCustomer: SpectraCustomer = { ...existingCustomer, id: 'cust-second' }
    const create = vi.fn().mockResolvedValue(secondCustomer)
    const result = await resolveSpectraCustomer(null, create)
    expect(create).toHaveBeenCalledTimes(1)
    expect(result.id).toBe('cust-second')
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

describe('listCustomers', () => {
  it('GETs with project_id, and forwards limit/cursor only when given', async () => {
    const fetchMock = mockFetchOnce(200, { customers: [], next_cursor: null })
    await listCustomers(SPECTRA_PROJECT_ID)
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/customers?project_id=${SPECTRA_PROJECT_ID}`)
  })

  it('includes limit and cursor when passed', async () => {
    const fetchMock = mockFetchOnce(200, { customers: [], next_cursor: null })
    await listCustomers(SPECTRA_PROJECT_ID, DEFAULT_PROFILE.id, { limit: 10, cursor: 'abc' })
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/customers?project_id=${SPECTRA_PROJECT_ID}&limit=10&cursor=abc`)
  })

  it('returns the customers array and next_cursor as given', async () => {
    mockFetchOnce(200, {
      customers: [{ id: 'c-1', project_id: SPECTRA_PROJECT_ID, display_name: 'Ada' }],
      next_cursor: 'xyz',
    })
    const result = await listCustomers(SPECTRA_PROJECT_ID)
    expect(result.customers).toHaveLength(1)
    expect(result.next_cursor).toBe('xyz')
  })
})

describe('listPaymentsForCustomer', () => {
  it('GETs /payments with project_id and customer_id', async () => {
    const fetchMock = mockFetchOnce(200, { payments: [] })
    await listPaymentsForCustomer('cust-1', SPECTRA_PROJECT_ID)
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/payments?project_id=${SPECTRA_PROJECT_ID}&customer_id=cust-1`)
  })
})

describe('listSubscriptionsForCustomer', () => {
  it('GETs /subscriptions with project_id and customer_id', async () => {
    const fetchMock = mockFetchOnce(200, { subscriptions: [] })
    await listSubscriptionsForCustomer('cust-1', SPECTRA_PROJECT_ID)
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/subscriptions?project_id=${SPECTRA_PROJECT_ID}&customer_id=cust-1`)
  })
})

describe('listSubscriptions', () => {
  it('GETs project-wide, with no customer_id', async () => {
    const fetchMock = mockFetchOnce(200, { subscriptions: [], next_cursor: null })
    await listSubscriptions(SPECTRA_PROJECT_ID)
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/subscriptions?project_id=${SPECTRA_PROJECT_ID}`)
  })

  it('includes limit and cursor when passed', async () => {
    const fetchMock = mockFetchOnce(200, { subscriptions: [], next_cursor: null })
    await listSubscriptions(SPECTRA_PROJECT_ID, DEFAULT_PROFILE.id, { limit: 10, cursor: 'abc' })
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/subscriptions?project_id=${SPECTRA_PROJECT_ID}&limit=10&cursor=abc`)
  })

  it('returns the subscriptions array and next_cursor as given', async () => {
    mockFetchOnce(200, { subscriptions: [{ id: 's-1', project_id: SPECTRA_PROJECT_ID }], next_cursor: 'xyz' })
    const result = await listSubscriptions(SPECTRA_PROJECT_ID)
    expect(result.subscriptions).toHaveLength(1)
    expect(result.next_cursor).toBe('xyz')
  })
})

describe('getCustomer', () => {
  it('GETs the persisted Customer with the fixed project_id', async () => {
    const fetchMock = mockFetchOnce(200, { id: 'cust-1', display_name: 'Ada' })
    await getCustomer('cust-1')
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/customers/cust-1?project_id=${SPECTRA_PROJECT_ID}`)
  })
})

describe('getSubscription', () => {
  it('GETs the persisted Subscription with the fixed project_id', async () => {
    const fetchMock = mockFetchOnce(200, { id: 'sub-1', status: 'ACTIVE' })
    await getSubscription('sub-1')
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/subscriptions/sub-1?project_id=${SPECTRA_PROJECT_ID}`)
  })
})

describe('listPaymentsForSubscription', () => {
  it('GETs /payments with project_id and subscription_id', async () => {
    const fetchMock = mockFetchOnce(200, { payments: [] })
    await listPaymentsForSubscription('sub-1', SPECTRA_PROJECT_ID)
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/payments?project_id=${SPECTRA_PROJECT_ID}&subscription_id=sub-1`)
  })
})

describe('getPaymentMethod', () => {
  it('GETs the persisted PaymentMethod with the fixed project_id', async () => {
    const fetchMock = mockFetchOnce(200, { id: 'pm-1', status: 'ACTIVE', card_brand: null })
    const result = await getPaymentMethod('pm-1')
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/payment-methods/pm-1?project_id=${SPECTRA_PROJECT_ID}`)
    expect(result.card_brand).toBeNull()
  })
})

describe('listPaymentAttempts', () => {
  it('GETs /payments/{id}/attempts with the fixed project_id', async () => {
    const fetchMock = mockFetchOnce(200, { attempts: [] })
    await listPaymentAttempts('pay-1')
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/payments/pay-1/attempts?project_id=${SPECTRA_PROJECT_ID}`)
  })
})

describe('listPaymentDocuments', () => {
  it('GETs /payments/{id}/documents with the fixed project_id', async () => {
    const fetchMock = mockFetchOnce(200, { documents: [] })
    await listPaymentDocuments('pay-1')
    const [path] = fetchMock.mock.calls[0]
    expect(path).toBe(`/spectra-api/payments/pay-1/documents?project_id=${SPECTRA_PROJECT_ID}`)
  })
})

describe('executeDuePeriod', () => {
  it('POSTs to execute-due-period with project_id in the body', async () => {
    const fetchMock = mockFetchOnce(200, {
      outcome: 'NOT_DUE',
      subscription: { id: 'sub-1', status: 'ACTIVE' },
      payment_id: null,
      attempt_status: null,
    })
    const result = await executeDuePeriod('sub-1', SPECTRA_PROJECT_ID)
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/spectra-api/subscriptions/sub-1/execute-due-period')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ project_id: SPECTRA_PROJECT_ID })
    expect(result.outcome).toBe('NOT_DUE')
  })
})

describe('cancelSubscription', () => {
  it('POSTs at_period_end=true when requested', async () => {
    const fetchMock = mockFetchOnce(200, { id: 'sub-1', cancel_at_period_end: true })
    await cancelSubscription('sub-1', true, SPECTRA_PROJECT_ID)
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/spectra-api/subscriptions/sub-1/cancel')
    expect(JSON.parse(init.body as string)).toEqual({
      project_id: SPECTRA_PROJECT_ID,
      at_period_end: true,
    })
  })

  it('POSTs at_period_end=false for immediate cancellation', async () => {
    const fetchMock = mockFetchOnce(200, { id: 'sub-1', status: 'CANCELLED' })
    await cancelSubscription('sub-1', false, SPECTRA_PROJECT_ID)
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body as string)).toEqual({
      project_id: SPECTRA_PROJECT_ID,
      at_period_end: false,
    })
  })
})

describe('reconcilePayment', () => {
  it('POSTs to reconcile with project_id in the body', async () => {
    const fetchMock = mockFetchOnce(200, {
      payment_id: 'pay-1',
      payment_status: 'SUCCEEDED',
      attempt_status: 'SUCCEEDED',
      reconciliation_outcome: 'RESOLVED',
    })
    const result = await reconcilePayment('pay-1', SPECTRA_PROJECT_ID)
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/spectra-api/payments/pay-1/reconcile')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ project_id: SPECTRA_PROJECT_ID })
    expect(result.reconciliation_outcome).toBe('RESOLVED')
  })
})

describe('reexecutePayment', () => {
  it('POSTs to re-execute with project_id in the body', async () => {
    const fetchMock = mockFetchOnce(200, {
      payment_id: 'pay-1',
      payment_status: 'PENDING',
      attempt_status: 'UNKNOWN',
    })
    const result = await reexecutePayment('pay-1', SPECTRA_PROJECT_ID)
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/spectra-api/payments/pay-1/re-execute')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ project_id: SPECTRA_PROJECT_ID })
    expect(result.attempt_status).toBe('UNKNOWN')
  })
})

describe('X-Spectra-Profile header (proxy credential selection)', () => {
  it('defaults to the default BusinessProfile id when no profileId is passed', async () => {
    const fetchMock = mockFetchOnce(200, { id: 'pay-1', status: 'SUCCEEDED' })
    await getPayment('pay-1')
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['X-Spectra-Profile']).toBe(DEFAULT_PROFILE.id)
  })

  it('sends an explicitly-passed profileId instead of the default', async () => {
    const fetchMock = mockFetchOnce(200, { id: 'pay-1', status: 'SUCCEEDED' })
    await getPayment('pay-1', 'cardcom-tester', 'cardcom-tester')
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['X-Spectra-Profile']).toBe('cardcom-tester')
  })

  it('threads profileId through createCustomer the same way it already threads projectId', async () => {
    const fetchMock = mockFetchOnce(200, {
      id: 'cust-1',
      project_id: 'cardcom-tester',
      external_reference: null,
      display_name: 'Ada',
      email: null,
      created_at: 't',
      updated_at: 't',
    })
    await createCustomer({ displayName: 'Ada' }, 'cardcom-tester', 'cardcom-tester')
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['X-Spectra-Profile']).toBe('cardcom-tester')
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
    await expect(checkSpectraHealth()).rejects.toThrow(/spectra-payments proxy/)
  })
})
