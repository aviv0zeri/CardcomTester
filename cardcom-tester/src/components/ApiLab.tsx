import { useMemo, useState, type ReactNode } from 'react'
import { LANGUAGES, type Language } from './CheckoutControls'
import { MenuSelect } from './MenuSelect'
import {
  asRecord,
  asText,
  checkLabResult,
  createLabSession,
  newProduct,
  productAmount,
  readStoredLowProfileId,
  responseCode,
  storeLowProfileId,
  type CardcomPayload,
  type LabCustomer,
  type LabProduct,
  type LabScenario,
} from './labClient'

const SCENARIOS: { value: LabScenario; label: string }[] = [
  { value: 'charge', label: 'Charge' },
  { value: 'document', label: 'Invoice' },
  { value: 'customer', label: 'Customer' },
]

const DOCUMENT_TYPES = [
  'TaxInvoiceAndReceipt',
  'TaxInvoice',
  'Receipt',
  'Order',
  'Auto',
]

const EMPTY_CUSTOMER: LabCustomer = {
  name: '',
  taxId: '',
  email: '',
  isSendByEmail: false,
  addressLine1: '',
  city: '',
  mobile: '',
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cta-field">
      {label}
      {children}
    </div>
  )
}

function Value({ label, value }: { label: string; value: unknown }) {
  const text = asText(value)
  if (!text) return null
  return (
    <>
      <dt>{label}</dt>
      <dd>{text}</dd>
    </>
  )
}

// Callers append " · {code}" themselves, so text here must never repeat the code.
function statusLabel(code: number | null): { kind: string; text: string } {
  if (code === 0) return { kind: 'ok', text: 'Success' }
  if (code === 5119) return { kind: 'pending', text: 'Pending / payment not completed' }
  if (code === 605) return { kind: 'error', text: 'Server unavailable (Sun–Thu until 17:00)' }
  if (code === null) return { kind: 'muted', text: 'Waiting for Cardcom' }
  return { kind: 'error', text: 'Cardcom error' }
}

function documentUrl(cardcom: CardcomPayload | null): string {
  const transaction = asRecord(cardcom?.TranzactionInfo)
  const document = asRecord(cardcom?.DocumentInfo)
  return asText(transaction?.DocumentUrl || document?.DocumentUrl)
}

function RawView({ title, payload }: { title: string; payload: unknown }) {
  if (payload === undefined) return null
  return (
    <details className="lab-raw">
      <summary>{title}</summary>
      <pre>{JSON.stringify(payload, null, 2)}</pre>
    </details>
  )
}

type ApiLabProps = {
  disabled?: boolean
}

export function ApiLab({ disabled }: ApiLabProps) {
  const [language, setLanguage] = useState<Language>('he')
  const [scenario, setScenario] = useState<LabScenario>('charge')
  const [amount, setAmount] = useState('10')
  const [documentType, setDocumentType] = useState('TaxInvoiceAndReceipt')
  const [returnValue, setReturnValue] = useState('')
  const [products, setProducts] = useState<LabProduct[]>([newProduct()])
  const [customer, setCustomer] = useState<LabCustomer>(EMPTY_CUSTOMER)
  const [busy, setBusy] = useState<'create' | 'result' | null>(null)
  const [error, setError] = useState('')
  const [createSent, setCreateSent] = useState<CardcomPayload | null>(null)
  const [createCardcom, setCreateCardcom] = useState<CardcomPayload | null>(null)
  const [resultCardcom, setResultCardcom] = useState<CardcomPayload | null>(null)
  const [lowProfileId, setLowProfileId] = useState(readStoredLowProfileId)
  const [pane, setPane] = useState<'create' | 'result'>('create')

  const total = useMemo(
    () => (scenario === 'charge' ? Number(amount) || 0 : productAmount(products)),
    [amount, products, scenario],
  )
  const createCode = responseCode(createCardcom)
  const resultCode = responseCode(resultCardcom)
  const createStatus = statusLabel(createCode)
  const resultStatus = statusLabel(resultCode)
  const checkoutUrl = asText(createCardcom?.Url || createCardcom?.url)
  const blocked = disabled || Boolean(busy)
  const includeDocument = scenario !== 'charge'
  const canPay = Boolean(checkoutUrl)
  const canCheck = Boolean(lowProfileId.trim())
  const created = Boolean(createCardcom)
  const checked = Boolean(resultCardcom)

  const updateProduct = (id: string, patch: Partial<LabProduct>) => {
    setProducts((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const runCreate = async () => {
    if (busy) return
    setBusy('create')
    setError('')
    setCreateSent(null)
    setCreateCardcom(null)
    setResultCardcom(null)
    setPane('create')
    try {
      const data = await createLabSession({
        language,
        scenario,
        amount,
        documentType,
        returnValue,
        products,
        customer,
      })
      const cardcom = asRecord(data.cardcom)
      setCreateSent(asRecord(data.sent))
      setCreateCardcom(cardcom)
      const id = asText(cardcom?.LowProfileId)
      if (id) {
        setLowProfileId(id)
        storeLowProfileId(id)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Create failed')
    }
    setBusy(null)
  }

  const runResult = async () => {
    if (busy || !lowProfileId.trim()) return
    setBusy('result')
    setError('')
    try {
      const data = await checkLabResult(lowProfileId.trim())
      setResultCardcom(asRecord(data.cardcom))
      setPane('result')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'GetLpResult failed')
    }
    setBusy(null)
  }

  const transaction = asRecord(resultCardcom?.TranzactionInfo)
  const uiValues = asRecord(resultCardcom?.UIValues)
  const documentInfo = asRecord(resultCardcom?.DocumentInfo)
  const invoiceUrl = documentUrl(resultCardcom)

  return (
    <div className="lab-layout">
      <div className="lab-setup">
        <p className="seg-legend">Test</p>
        <div className="seg" role="radiogroup" aria-label="Test">
          {SCENARIOS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`seg-btn${scenario === option.value ? ' is-on' : ''}`}
              disabled={blocked}
              aria-pressed={scenario === option.value}
              onClick={() => setScenario(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {scenario === 'customer' ? (
          <p className="lab-later">
            Experimentally verified: Document.IsSendByEmail true → on successful payment,
            Cardcom emails the generated document (PDF attached) to Document.Email. Confirmed by
            inbox check, not by the API. Limitation: GetLpResult exposes no email delivery/status
            field — the response confirms the document was created, never that the email arrived.
            Treat send as fire-and-forget unless Cardcom exposes a delivery-status API later.
          </p>
        ) : null}

        <div className="lab-grid">
          <Field label="Language">
            <MenuSelect
              aria-label="Language"
              value={language}
              options={LANGUAGES}
              disabled={blocked}
              onChange={setLanguage}
            />
          </Field>
          {scenario === 'charge' ? (
            <Field label="Amount">
              <input
                value={amount}
                disabled={blocked}
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
          ) : (
            <Field label="Document type">
              <MenuSelect
                aria-label="Document type"
                value={documentType}
                options={DOCUMENT_TYPES.map((type) => ({ value: type, label: type }))}
                disabled={blocked}
                onChange={setDocumentType}
              />
            </Field>
          )}
          <Field label="Order id">
            <input
              value={returnValue}
              disabled={blocked}
              placeholder="optional ReturnValue"
              onChange={(event) => setReturnValue(event.target.value)}
            />
          </Field>
        </div>

        {includeDocument ? (
          <div className="lab-products">
            {products.map((row, index) => (
              <div key={row.id} className="lab-product">
                <Field label={index === 0 ? 'Product' : `Product ${index + 1}`}>
                  <input
                    value={row.description}
                    disabled={blocked}
                    onChange={(event) => updateProduct(row.id, { description: event.target.value })}
                  />
                </Field>
                <Field label="Qty">
                  <input
                    value={row.quantity}
                    disabled={blocked}
                    inputMode="decimal"
                    onChange={(event) => updateProduct(row.id, { quantity: event.target.value })}
                  />
                </Field>
                <Field label="Unit">
                  <input
                    value={row.unitCost}
                    disabled={blocked}
                    inputMode="decimal"
                    onChange={(event) => updateProduct(row.id, { unitCost: event.target.value })}
                  />
                </Field>
                <button
                  type="button"
                  className="text-btn"
                  disabled={blocked || products.length === 1}
                  onClick={() => setProducts((rows) => rows.filter((item) => item.id !== row.id))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-btn"
              disabled={blocked}
              onClick={() => setProducts((rows) => [...rows, newProduct()])}
            >
              Add product
            </button>
          </div>
        ) : null}

        {scenario === 'customer' ? (
          <div className="lab-grid">
            <Field label="Name">
              <input
                value={customer.name}
                disabled={blocked}
                onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
              />
            </Field>
            <Field label="TaxId">
              <input
                value={customer.taxId}
                disabled={blocked}
                onChange={(event) => setCustomer({ ...customer, taxId: event.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                value={customer.email}
                disabled={blocked}
                onChange={(event) => setCustomer({ ...customer, email: event.target.value })}
              />
            </Field>
            <Field label="Address">
              <input
                value={customer.addressLine1}
                disabled={blocked}
                onChange={(event) => setCustomer({ ...customer, addressLine1: event.target.value })}
              />
            </Field>
            <Field label="City">
              <input
                value={customer.city}
                disabled={blocked}
                onChange={(event) => setCustomer({ ...customer, city: event.target.value })}
              />
            </Field>
            <Field label="Mobile">
              <input
                value={customer.mobile}
                disabled={blocked}
                onChange={(event) => setCustomer({ ...customer, mobile: event.target.value })}
              />
            </Field>
            <label className="cta-radio">
              <input
                type="checkbox"
                checked={customer.isSendByEmail}
                disabled={blocked}
                onChange={(event) =>
                  setCustomer({ ...customer, isSendByEmail: event.target.checked })
                }
              />
              Send by email — unverified
            </label>
          </div>
        ) : null}

        <p className="lab-total">
          Cardcom will charge <strong>{Number.isFinite(total) ? total.toFixed(2) : '—'}</strong>
          <span> · {language}</span>
        </p>

        <ol className="stepper">
          <li className={`step${created ? ' is-done' : ' is-now'}`}>
            <span className="step-index">1</span>
            <div className="step-body">
              <p className="step-title">Create session</p>
              <button
                type="button"
                className="cta-button"
                disabled={blocked}
                onClick={() => void runCreate()}
              >
                {busy === 'create' ? 'Creating…' : created ? 'Create again' : 'Create session'}
              </button>
            </div>
          </li>
          <li className={`step${canPay ? ' is-now' : ' is-wait'}${canPay && checked ? ' is-done' : ''}`}>
            <span className="step-index">2</span>
            <div className="step-body">
              <p className="step-title">Pay on Cardcom</p>
              <p className="cta-hint">Opens the hosted checkout. Come back here after paying.</p>
              {canPay ? (
                <a className="cta-button" href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                  Pay on Cardcom
                </a>
              ) : (
                <button type="button" className="cta-button" disabled>
                  Pay on Cardcom
                </button>
              )}
            </div>
          </li>
          <li className={`step${checked ? ' is-done' : canCheck ? ' is-now' : ' is-wait'}`}>
            <span className="step-index">3</span>
            <div className="step-body">
              <p className="step-title">Check result</p>
              <Field label="LowProfileId">
                <input
                  value={lowProfileId}
                  disabled={blocked}
                  placeholder="filled after Create"
                  onChange={(event) => {
                    setLowProfileId(event.target.value)
                    storeLowProfileId(event.target.value)
                  }}
                />
              </Field>
              <button
                type="button"
                className="cta-button"
                disabled={blocked || !canCheck}
                onClick={() => void runResult()}
              >
                {busy === 'result' ? 'Checking…' : 'Check result'}
              </button>
            </div>
          </li>
        </ol>

        <p className="lab-later">Webhooks, tokens, refunds, subscriptions — add later.</p>
      </div>

      <section className="lab-pane">
        <div className="lab-pane-head">
          <h2>Cardcom response</h2>
          {createCardcom && resultCardcom ? (
            <div className="seg seg--small">
              <button
                type="button"
                className={`seg-btn${pane === 'create' ? ' is-on' : ''}`}
                onClick={() => setPane('create')}
              >
                Create
              </button>
              <button
                type="button"
                className={`seg-btn${pane === 'result' ? ' is-on' : ''}`}
                onClick={() => setPane('result')}
              >
                Result
              </button>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="lab-badge lab-badge--error">{error}</p>
        ) : !createCardcom && !resultCardcom ? (
          <p className="lab-empty">Create a session. Cardcom’s reply shows up here.</p>
        ) : pane === 'result' && resultCardcom ? (
          <>
            <p className={`lab-badge lab-badge--${resultStatus.kind}`}>
              {resultStatus.text}
              {resultCode !== null ? ` · ${resultCode}` : ''}
              {asText(resultCardcom.Description) ? ` — ${asText(resultCardcom.Description)}` : ''}
            </p>
            <h3>Status</h3>
            <dl className="lab-dl">
              <Value label="ResponseCode" value={resultCardcom.ResponseCode} />
              <Value label="Description" value={resultCardcom.Description} />
              <Value label="LowProfileId" value={resultCardcom.LowProfileId} />
              <Value label="ReturnValue" value={resultCardcom.ReturnValue} />
              <Value label="Operation" value={resultCardcom.Operation} />
            </dl>
            {transaction ? (
              <>
                <h3>Transaction</h3>
                <dl className="lab-dl">
                  <Value label="Amount" value={transaction.Amount} />
                  <Value
                    label="TranzactionId"
                    value={transaction.TranzactionId || transaction.TransactionId}
                  />
                  <Value label="CreateDate" value={transaction.CreateDate} />
                  <Value label="ApprovalNumber" value={transaction.ApprovalNumber} />
                  <Value label="NumberOfPayments" value={transaction.NumberOfPayments} />
                  <Value label="Brand" value={transaction.Brand} />
                  <Value label="CardName" value={transaction.CardName} />
                  <Value
                    label="Last4"
                    value={transaction.Last4CardDigitsString || transaction.Last4CardDigits}
                  />
                  <Value label="CouponNumber" value={transaction.CouponNumber} />
                </dl>
              </>
            ) : null}
            {uiValues || transaction ? (
              <>
                <h3>Customer</h3>
                <dl className="lab-dl">
                  <Value label="Name" value={uiValues?.CardOwnerName || transaction?.CardOwnerName} />
                  <Value label="Email" value={uiValues?.CardOwnerEmail || transaction?.CardOwnerEmail} />
                  <Value label="Phone" value={uiValues?.CardOwnerPhone || transaction?.CardOwnerPhone} />
                  <Value
                    label="Identity"
                    value={uiValues?.CardOwnerIdentityNumber || transaction?.CardOwnerIdentityNumber}
                  />
                </dl>
              </>
            ) : null}
            {documentInfo || invoiceUrl ? (
              <>
                <h3>Document</h3>
                <dl className="lab-dl">
                  <Value
                    label="DocumentType"
                    value={documentInfo?.DocumentType || transaction?.DocumentType}
                  />
                  <Value
                    label="DocumentNumber"
                    value={documentInfo?.DocumentNumber || transaction?.DocumentNumber}
                  />
                  <Value label="DocumentInfo.DocumentUrl" value={documentInfo?.DocumentUrl} />
                  <Value label="TranzactionInfo.DocumentUrl" value={transaction?.DocumentUrl} />
                </dl>
                {invoiceUrl ? (
                  <a className="cta-button" href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                    Open document
                  </a>
                ) : (
                  <p className="cta-hint">
                    No DocumentUrl yet. Cardcom may put it on TranzactionInfo, not DocumentInfo.
                  </p>
                )}
              </>
            ) : null}
            <RawView title="Raw GetLpResult JSON" payload={resultCardcom} />
          </>
        ) : createCardcom ? (
          <>
            <p className={`lab-badge lab-badge--${createStatus.kind}`}>
              {createCode === 0 ? 'Session created' : createStatus.text}
              {createCode !== null ? ` · ${createCode}` : ''}
              {asText(createCardcom.Description) ? ` — ${asText(createCardcom.Description)}` : ''}
            </p>
            <dl className="lab-dl">
              <Value label="ResponseCode" value={createCardcom.ResponseCode} />
              <Value label="Description" value={createCardcom.Description} />
              <Value label="LowProfileId" value={createCardcom.LowProfileId} />
              <Value label="Url" value={createCardcom.Url || createCardcom.url} />
              <Value label="UrlToPayPal" value={createCardcom.UrlToPayPal} />
              <Value label="UrlToBit" value={createCardcom.UrlToBit} />
            </dl>
            {asText(createCardcom.UrlToPayPal) || asText(createCardcom.UrlToBit) ? (
              <p className="cta-hint">
                {asText(createCardcom.UrlToPayPal) ? (
                  <a href={asText(createCardcom.UrlToPayPal)} target="_blank" rel="noopener noreferrer">
                    PayPal URL
                  </a>
                ) : null}
                {asText(createCardcom.UrlToPayPal) && asText(createCardcom.UrlToBit) ? ' · ' : null}
                {asText(createCardcom.UrlToBit) ? (
                  <a href={asText(createCardcom.UrlToBit)} target="_blank" rel="noopener noreferrer">
                    Bit URL
                  </a>
                ) : null}
              </p>
            ) : null}
            <RawView title="Raw Create JSON" payload={{ sent: createSent, cardcom: createCardcom }} />
          </>
        ) : null}
      </section>
    </div>
  )
}
