// Typed client for spectra-payments -- our own normalized Payment API, a separate
// backend/process from the Express raw-Cardcom lab (see labClient.ts, never merged
// with this file on purpose). Every response shape here is spectra-payments' own
// vocabulary (Customer/CheckoutSession/Payment) -- never a raw Cardcom field, never a
// provider credential. project_id is fixed to one constant: CardcomTester behaves as
// one consuming project, exactly like any other integration would.

const SPECTRA_API_BASE = '/spectra-api'

export const SPECTRA_PROJECT_ID = 'cardcom-tester'

async function spectraFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SPECTRA_API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const text = await response.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error('spectra-payments is not running on :8099. Start it and retry.')
  }
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `spectra-payments request failed (HTTP ${response.status})`
    throw new Error(message)
  }
  return data as T
}

function withProject(params: Record<string, string> = {}): string {
  return new URLSearchParams({ project_id: SPECTRA_PROJECT_ID, ...params }).toString()
}

export type SpectraHealth = {
  status: string
}

export type SpectraCustomer = {
  id: string
  project_id: string
  external_reference: string | null
  display_name: string | null
  email: string | null
  created_at: string
  updated_at: string
}

export type SpectraCheckoutSession = {
  checkout_session_id: string
  checkout_mode: string
  status: string
  payment_id?: string
  payment_status?: string
  checkout_url?: string
  bootstrap?: { session_reference: string }
  closed_reason?: string | null
}

export type SpectraVerifyResult = {
  checkout_session_id: string
  checkout_session_status: string
  payment_id: string
  payment_status: string
}

export type SpectraPayment = {
  id: string
  project_id: string
  customer_id: string
  checkout_session_id: string | null
  amount: string
  currency: string
  source: string
  business_reference: string | null
  status: string
  subscription_id: string | null
  subscription_period_start: string | null
  subscription_period_end: string | null
  created_at: string
  updated_at: string
}

export function checkSpectraHealth(): Promise<SpectraHealth> {
  return spectraFetch('/health')
}

export function createCustomer(input: {
  displayName?: string
  email?: string
} = {}): Promise<SpectraCustomer> {
  return spectraFetch('/customers', {
    method: 'POST',
    body: JSON.stringify({
      project_id: SPECTRA_PROJECT_ID,
      display_name: input.displayName,
      email: input.email,
    }),
  })
}

export function createHostedCheckoutSession(input: {
  customerId: string
  amount: number
  currency?: string
  language?: string
}): Promise<SpectraCheckoutSession> {
  return spectraFetch('/checkout-sessions', {
    method: 'POST',
    body: JSON.stringify({
      project_id: SPECTRA_PROJECT_ID,
      customer_id: input.customerId,
      amount: input.amount.toFixed(2),
      currency: input.currency ?? 'ILS',
      checkout_mode: 'hosted',
      language: input.language ?? 'he',
    }),
  })
}

export function getCheckoutSession(checkoutSessionId: string): Promise<SpectraCheckoutSession> {
  return spectraFetch(`/checkout-sessions/${checkoutSessionId}?${withProject()}`)
}

export function verifyCheckoutSession(checkoutSessionId: string): Promise<SpectraVerifyResult> {
  return spectraFetch(`/checkout-sessions/${checkoutSessionId}/verify?${withProject()}`, {
    method: 'POST',
  })
}

export function getPayment(paymentId: string): Promise<SpectraPayment> {
  return spectraFetch(`/payments/${paymentId}?${withProject()}`)
}
