import { useState } from 'react'
import { PaymentOverlay } from './PaymentOverlay'
import {
  SPECTRA_PROJECT_ID,
  checkSpectraHealth,
  createCustomer,
  createHostedCheckoutSession,
  getPayment,
  verifyCheckoutSession,
  type SpectraCheckoutSession,
  type SpectraCustomer,
  type SpectraPayment,
  type SpectraVerifyResult,
} from './spectraClient'

type SpectraPaymentsProps = {
  disabled?: boolean
}

// Deliberately local, not shared with GuidedWalkthrough's own JsonBlock -- this tab
// never imports from or modifies the Direct Cardcom lab's components.
function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre
      dir="ltr"
      style={{
        background: '#101418',
        color: '#d7e2ea',
        padding: '10px 12px',
        borderRadius: 8,
        fontSize: 12,
        overflowX: 'auto',
        margin: 0,
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function StepPanel({
  title,
  request,
  response,
}: {
  title: string
  request?: unknown
  response?: unknown
}) {
  if (request === undefined && response === undefined) return null
  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{title}</p>
      {request !== undefined ? (
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 12, opacity: 0.7 }}>sent to spectra-payments</p>
          <JsonBlock value={request} />
        </div>
      ) : null}
      {response !== undefined ? (
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 12, opacity: 0.7 }}>
            returned by spectra-payments
          </p>
          <JsonBlock value={response} />
        </div>
      ) : null}
    </div>
  )
}

export function SpectraPayments({ disabled }: SpectraPaymentsProps) {
  const [health, setHealth] = useState<'unknown' | 'ok' | 'unreachable'>('unknown')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [customer, setCustomer] = useState<SpectraCustomer | null>(null)
  const [checkoutSession, setCheckoutSession] = useState<SpectraCheckoutSession | null>(null)
  const [verifyResult, setVerifyResult] = useState<SpectraVerifyResult | null>(null)
  const [payment, setPayment] = useState<SpectraPayment | null>(null)
  const [overlayOpen, setOverlayOpen] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'request failed')
    }
    setBusy(false)
  }

  const handleCheckHealth = () =>
    run(async () => {
      const result = await checkSpectraHealth()
      setHealth(result.status === 'ok' ? 'ok' : 'unreachable')
    })

  const customerRequest = { project_id: SPECTRA_PROJECT_ID, display_name: 'Spectra Tester' }
  const handleCreateCustomer = () =>
    run(async () => {
      const result = await createCustomer({ displayName: 'Spectra Tester' })
      setCustomer(result)
    })

  const checkoutRequest = customer
    ? {
        project_id: SPECTRA_PROJECT_ID,
        customer_id: customer.id,
        amount: '10.00',
        currency: 'ILS',
        checkout_mode: 'hosted',
        language: 'he',
      }
    : undefined
  const handleCreateCheckoutSession = () =>
    run(async () => {
      if (!customer) return
      const result = await createHostedCheckoutSession({ customerId: customer.id, amount: 10 })
      setCheckoutSession(result)
    })

  const handleVerify = () =>
    run(async () => {
      if (!checkoutSession) return
      const result = await verifyCheckoutSession(checkoutSession.checkout_session_id)
      setVerifyResult(result)
      const paymentResult = await getPayment(result.payment_id)
      setPayment(paymentResult)
    })

  return (
    <div className="design-pane" aria-disabled={disabled}>
      <p className="cta-copy">
        A separate learning path against spectra-payments -- our own normalized Payment
        API, not raw Cardcom. Every panel below shows what WE sent and what
        spectra-payments (never Cardcom directly) returned.
      </p>

      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <button type="button" className="cta-button" onClick={handleCheckHealth} disabled={busy}>
            1. Check spectra-payments connection
          </button>
          {health === 'ok' ? (
            <p style={{ fontSize: 13, opacity: 0.8 }}>spectra-payments is reachable.</p>
          ) : health === 'unreachable' ? (
            <p style={{ fontSize: 13, color: '#c0392b' }}>spectra-payments did not respond ok.</p>
          ) : null}
        </div>

        <div>
          <button
            type="button"
            className="cta-button"
            onClick={handleCreateCustomer}
            disabled={busy || health !== 'ok'}
          >
            2. Create Customer
          </button>
          <StepPanel
            title="Create Customer"
            request={customer ? customerRequest : undefined}
            response={customer ?? undefined}
          />
        </div>

        <div>
          <button
            type="button"
            className="cta-button"
            onClick={handleCreateCheckoutSession}
            disabled={busy || !customer}
          >
            3. Create hosted CheckoutSession
          </button>
          <StepPanel
            title="Create CheckoutSession (hosted)"
            request={checkoutSession ? checkoutRequest : undefined}
            response={checkoutSession ?? undefined}
          />
          {checkoutSession?.checkout_url ? (
            <button
              type="button"
              className="cta-button"
              style={{ marginTop: 6 }}
              onClick={() => setOverlayOpen(true)}
            >
              Open Cardcom test checkout
            </button>
          ) : null}
        </div>

        <div>
          <button
            type="button"
            className="cta-button"
            onClick={handleVerify}
            disabled={busy || !checkoutSession}
          >
            4. Verify (authoritative)
          </button>
          <StepPanel
            title="Verify CheckoutSession"
            request={
              verifyResult && checkoutSession
                ? { checkout_session_id: checkoutSession.checkout_session_id, project_id: SPECTRA_PROJECT_ID }
                : undefined
            }
            response={verifyResult ?? undefined}
          />
          <StepPanel title="Persisted Payment (GET /payments/{id})" response={payment ?? undefined} />
        </div>

        {error ? <p style={{ color: '#c0392b' }}>{error}</p> : null}
      </div>

      {overlayOpen && checkoutSession?.checkout_url ? (
        <PaymentOverlay src={checkoutSession.checkout_url} onClose={() => setOverlayOpen(false)} />
      ) : null}
    </div>
  )
}
