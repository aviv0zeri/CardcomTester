// Typed client for spectra-payments -- our own normalized Payment API, a separate
// backend/process from the Express raw-Cardcom lab (see labClient.ts, never merged
// with this file on purpose). Every response shape here is spectra-payments' own
// vocabulary (Customer/CheckoutSession/Payment) -- never a raw Cardcom field, never a
// provider credential. project_id comes from the selected business profile
// (profiles.ts): each business is its own spectra-payments project, exactly like
// any other consuming integration would be. Callers that don't pick one get the
// default business.

import { DEFAULT_PROFILE } from './profiles'

const SPECTRA_API_BASE = '/spectra-api'

export const SPECTRA_PROJECT_ID = DEFAULT_PROFILE.spectraProjectId
// The default BusinessProfile id, used only as this module's own fallback --
// every real call from GuidedWalkthrough already passes the selected
// profile's own id explicitly, mirroring how projectId already works.
const DEFAULT_PROFILE_ID = DEFAULT_PROFILE.id

// The proxy hop is sub-second; a long wait is the API itself (its own call to
// Cardcom is capped at 15s per request server-side). Cap the whole round trip
// so the UI reports the stall instead of spinning indefinitely.
const SPECTRA_TIMEOUT_MS = 30_000

async function spectraFetch<T>(path: string, profileId: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const started = performance.now()
  const timer = setTimeout(() => controller.abort(), SPECTRA_TIMEOUT_MS)
  let text: string
  let response: Response
  try {
    response = await fetch(`${SPECTRA_API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      // X-Spectra-Profile tells the proxy which server-side credential to
      // attach -- a routing hint only, never a credential itself (see
      // server/spectraProxy.js). It never reaches spectra-payments; the proxy
      // strips it before forwarding upstream.
      headers: { 'Content-Type': 'application/json', 'X-Spectra-Profile': profileId, ...(init?.headers ?? {}) },
    })
    text = await response.text()
  } catch (cause) {
    if (controller.signal.aborted) {
      const seconds = Math.round((performance.now() - started) / 1000)
      throw new Error(`No answer from spectra-payments after ${seconds}s (${path}). The wait is on the API side, not this page -- try again.`)
    }
    throw cause
  } finally {
    clearTimeout(timer)
  }
  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    // A non-JSON body means the /spectra-api proxy did not answer (the SPA
    // fallback page came back instead): in production the Vercel function,
    // locally the Express dev server (server/index.js) with
    // SPECTRA_PAYMENTS_API_TOKEN set in server/.env.
    throw new Error(
      'Could not reach the spectra-payments proxy (/spectra-api). Locally: run the Express server with SPECTRA_PAYMENTS_API_TOKEN in server/.env.',
    )
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

function withProject(projectId: string, params: Record<string, string> = {}): string {
  return new URLSearchParams({ project_id: projectId, ...params }).toString()
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
  line_items?: SpectraLineItem[]
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

// What POST /checkout-sessions accepts as line_items (must sum to amount exactly)
// and what every read of the Payment/CheckoutSession echoes back (with line_total).
export type SpectraLineItemInput = { name: string; unit_price: string; quantity: number }
export type SpectraLineItem = SpectraLineItemInput & { line_total: string }

export function checkSpectraHealth(): Promise<SpectraHealth> {
  return spectraFetch('/health', DEFAULT_PROFILE_ID)
}

export function createCustomer(
  input: {
    displayName?: string
    email?: string
  } = {},
  projectId: string = SPECTRA_PROJECT_ID,
  profileId: string = DEFAULT_PROFILE_ID,
): Promise<SpectraCustomer> {
  return spectraFetch('/customers', profileId, {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      display_name: input.displayName,
      email: input.email,
    }),
  })
}

// A Guided-run retry (e.g. after a CheckoutSession/LowProfile rejection) must
// reuse the Customer that run already created, never manufacture a second one
// for the same attempt. `existing` is only ever null at the START of a
// genuinely new run (see GuidedWalkthrough's clearRun()) -- once set, this
// never calls `create` again until the caller resets it back to null.
export function resolveSpectraCustomer(
  existing: SpectraCustomer | null,
  create: () => Promise<SpectraCustomer>,
): Promise<SpectraCustomer> {
  return existing ? Promise.resolve(existing) : create()
}

export function createHostedCheckoutSession(input: {
  customerId: string
  amount: number
  currency?: string
  language?: string
  projectId?: string
  profileId?: string
  lineItems?: SpectraLineItemInput[]
}): Promise<SpectraCheckoutSession> {
  return spectraFetch('/checkout-sessions', input.profileId ?? DEFAULT_PROFILE_ID, {
    method: 'POST',
    body: JSON.stringify({
      project_id: input.projectId ?? SPECTRA_PROJECT_ID,
      customer_id: input.customerId,
      amount: input.amount.toFixed(2),
      currency: input.currency ?? 'ILS',
      checkout_mode: 'hosted',
      language: input.language ?? 'he',
      // Absent (not null) when there are none, so the field never shows up empty.
      line_items: input.lineItems?.length ? input.lineItems : undefined,
    }),
  })
}

export function createEmbeddedFieldsCheckoutSession(input: {
  customerId: string
  amount: number
  currency?: string
  language?: string
  projectId?: string
  profileId?: string
  lineItems?: SpectraLineItemInput[]
}): Promise<SpectraCheckoutSession> {
  return spectraFetch('/checkout-sessions', input.profileId ?? DEFAULT_PROFILE_ID, {
    method: 'POST',
    body: JSON.stringify({
      project_id: input.projectId ?? SPECTRA_PROJECT_ID,
      customer_id: input.customerId,
      amount: input.amount.toFixed(2),
      currency: input.currency ?? 'ILS',
      checkout_mode: 'embedded_fields',
      language: input.language ?? 'he',
      // Absent (not null) when there are none, so the field never shows up empty.
      line_items: input.lineItems?.length ? input.lineItems : undefined,
    }),
  })
}

export function getCheckoutSession(
  checkoutSessionId: string,
  projectId: string = SPECTRA_PROJECT_ID,
  profileId: string = DEFAULT_PROFILE_ID,
): Promise<SpectraCheckoutSession> {
  return spectraFetch(`/checkout-sessions/${checkoutSessionId}?${withProject(projectId)}`, profileId)
}

export function verifyCheckoutSession(
  checkoutSessionId: string,
  projectId: string = SPECTRA_PROJECT_ID,
  profileId: string = DEFAULT_PROFILE_ID,
): Promise<SpectraVerifyResult> {
  return spectraFetch(`/checkout-sessions/${checkoutSessionId}/verify?${withProject(projectId)}`, profileId, {
    method: 'POST',
  })
}

export function getPayment(
  paymentId: string,
  projectId: string = SPECTRA_PROJECT_ID,
  profileId: string = DEFAULT_PROFILE_ID,
): Promise<SpectraPayment> {
  return spectraFetch(`/payments/${paymentId}?${withProject(projectId)}`, profileId)
}

export type SpectraSubscription = {
  id: string
  project_id: string
  customer_id: string
  payment_method_id: string
  external_plan_reference: string | null
  amount: string
  currency: string
  billing_interval: string
  billing_anchor_day: number | null
  status: string
  current_period_start: string | null
  current_period_end: string | null
  next_charge_date: string | null
  cancel_at_period_end: boolean
  latest_payment_id: string | null
  created_at: string
  updated_at: string
}

export type SpectraCustomerList = { customers: SpectraCustomer[]; next_cursor: string | null }

// The project's own persisted Customers -- this is what makes the profile
// selector actually teach isolation instead of just switching a brand: the
// same list, scoped by whichever project_id/credential is selected. Bounded
// (server enforces 1-100) and keyset-paginated; pass a prior call's
// next_cursor back as opts.cursor to continue.
export function listCustomers(
  projectId: string,
  profileId: string = DEFAULT_PROFILE_ID,
  opts: { limit?: number; cursor?: string } = {},
): Promise<SpectraCustomerList> {
  const params: Record<string, string> = { project_id: projectId }
  if (opts.limit) params.limit = String(opts.limit)
  if (opts.cursor) params.cursor = opts.cursor
  return spectraFetch(`/customers?${new URLSearchParams(params).toString()}`, profileId)
}

export function listPaymentsForCustomer(
  customerId: string,
  projectId: string = SPECTRA_PROJECT_ID,
  profileId: string = DEFAULT_PROFILE_ID,
): Promise<{ payments: SpectraPayment[] }> {
  return spectraFetch(`/payments?${withProject(projectId, { customer_id: customerId })}`, profileId)
}

export function listSubscriptionsForCustomer(
  customerId: string,
  projectId: string = SPECTRA_PROJECT_ID,
  profileId: string = DEFAULT_PROFILE_ID,
): Promise<{ subscriptions: SpectraSubscription[] }> {
  return spectraFetch(
    `/subscriptions?${withProject(projectId, { customer_id: customerId })}`,
    profileId,
  )
}
