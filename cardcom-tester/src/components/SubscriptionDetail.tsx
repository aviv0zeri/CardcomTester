import { useEffect, useState } from 'react'
import {
  getCustomer,
  getPaymentMethod,
  getSubscription,
  listPaymentAttempts,
  listPaymentDocuments,
  listPaymentsForSubscription,
  type SpectraCustomer,
  type SpectraPayment,
  type SpectraPaymentAttempt,
  type SpectraPaymentDocument,
  type SpectraPaymentMethod,
  type SpectraSubscription,
} from './spectraClient'
import type { BusinessProfile } from './profiles'
import type { UiLang } from './uiLang'
import { StatusBadge, fmtDate } from './consoleShared'
import './customersTab.css'
import './subscriptionsTab.css'
import './subscriptionDetail.css'

// The Subscription detail/resource-graph view: Subscription -> Customer ->
// PaymentMethod, and Subscription -> Payments -> Attempts -> Documents, all
// read straight from spectra-payments persisted truth (no frontend billing
// logic, no invented fields). Inspection-first -- no execute/cancel/reconcile
// controls here; those belong to a later, operational slice.

type Props = {
  subscriptionId: string
  profile: BusinessProfile
  lang: UiLang
  onBack: () => void
  onNavigateToCustomer: (customerId: string) => void
}

const STRINGS = {
  en: {
    back: '← Back to Subscriptions',
    loading: 'Loading…',
    error: 'Could not load this Subscription',
    subscription: 'Subscription',
    subscriptionId: 'Subscription ID',
    status: 'Status',
    amount: 'Amount',
    planReference: 'Plan reference (caller-supplied metadata, not a real Plan entity)',
    noPlanReference: 'None',
    anchorDay: 'Anchor day',
    createdAt: 'Created at',
    updatedAt: 'Updated at',
    billingPeriod: 'Billing period',
    periodStart: 'Current period start',
    periodEnd: 'Current period end',
    dueNow: 'Due now — current_period_end has already passed',
    notDueYet: 'Not due yet',
    dueNote: 'Derived from current_period_end, not a separate stored field.',
    cancelAtPeriodEnd: 'Cancel at period end',
    willCancelAt: (date: string) => `Scheduled to cancel at period end (${date})`,
    willRenew: 'Will renew automatically',
    alreadyCancelled: 'This Subscription has already been cancelled.',
    customer: 'Customer',
    customerName: 'Display name',
    customerId: 'Customer ID',
    viewCustomer: 'View Customer →',
    paymentMethod: 'Payment method',
    pmId: 'PaymentMethod ID',
    pmProvider: 'Provider',
    pmStatus: 'Status',
    pmExpiry: 'Card expiry',
    pmBrand: 'Card brand',
    pmLast4: 'Last 4',
    notAvailable: 'Not available',
    pmLoadError: 'Could not load the PaymentMethod for this Subscription.',
    paymentHistory: 'Payment history',
    noPayments: 'No Payments for this Subscription yet.',
    initialPayment: 'Initial Payment',
    renewalPayment: (n: number) => `Renewal Payment #${n}`,
    expand: 'Show attempts & documents',
    collapse: 'Hide attempts & documents',
    attempts: 'Payment attempts',
    noAttempts: 'No attempts recorded for this Payment.',
    documents: 'Documents',
    noDocuments: 'No document for this Payment.',
    resourceGraph: 'Resource graph',
    showRaw: 'Show as JSON (all resources on this page)',
    hideRaw: 'Hide JSON',
    explain: {
      SUCCEEDED: 'Provider confirmed the financial attempt succeeded.',
      DECLINED: 'Provider financially rejected the attempt.',
      UNKNOWN: 'The request may have reached the provider; the financial outcome is not yet safely known.',
      TECHNICAL_FAILED:
        'The system knows no financial attempt was accepted/reached, per our classification invariant.',
    } as Record<string, string>,
  },
  he: {
    back: '← חזרה למנויים',
    loading: 'טוען…',
    error: 'לא ניתן היה לטעון את המנוי הזה',
    subscription: 'מנוי',
    subscriptionId: 'מזהה מנוי',
    status: 'סטטוס',
    amount: 'סכום',
    planReference: 'הפניית תוכנית (מטא-דאטה שסופקה על ידי הקורא, לא ישות תוכנית אמיתית)',
    noPlanReference: 'ללא',
    anchorDay: 'יום עוגן',
    createdAt: 'נוצר בתאריך',
    updatedAt: 'עודכן בתאריך',
    billingPeriod: 'תקופת חיוב',
    periodStart: 'תחילת התקופה הנוכחית',
    periodEnd: 'סוף התקופה הנוכחית',
    dueNow: 'חייב עכשיו — current_period_end כבר חלף',
    notDueYet: 'עדיין לא חייב',
    dueNote: 'נגזר מ-current_period_end, לא שדה שמור נפרד.',
    cancelAtPeriodEnd: 'ביטול בסוף התקופה',
    willCancelAt: (date: string) => `מתוזמן לביטול בסוף התקופה (${date})`,
    willRenew: 'יתחדש אוטומטית',
    alreadyCancelled: 'המנוי הזה כבר בוטל.',
    customer: 'לקוח',
    customerName: 'שם תצוגה',
    customerId: 'מזהה לקוח',
    viewCustomer: '→ צפייה בלקוח',
    paymentMethod: 'אמצעי תשלום',
    pmId: 'מזהה אמצעי תשלום',
    pmProvider: 'ספק',
    pmStatus: 'סטטוס',
    pmExpiry: 'תוקף כרטיס',
    pmBrand: 'מותג כרטיס',
    pmLast4: '4 ספרות אחרונות',
    notAvailable: 'לא זמין',
    pmLoadError: 'לא ניתן היה לטעון את אמצעי התשלום של המנוי הזה.',
    paymentHistory: 'היסטוריית תשלומים',
    noPayments: 'עדיין אין תשלומים למנוי הזה.',
    initialPayment: 'תשלום ראשוני',
    renewalPayment: (n: number) => `תשלום חידוש #${n}`,
    expand: 'הצג ניסיונות ומסמכים',
    collapse: 'הסתר ניסיונות ומסמכים',
    attempts: 'ניסיונות תשלום',
    noAttempts: 'לא נרשמו ניסיונות לתשלום הזה.',
    documents: 'מסמכים',
    noDocuments: 'אין מסמך לתשלום הזה.',
    resourceGraph: 'גרף המשאבים',
    showRaw: 'הצג כ-JSON (כל המשאבים בדף)',
    hideRaw: 'הסתר JSON',
    explain: {
      SUCCEEDED: 'הספק אישר שהניסיון הכספי הצליח.',
      DECLINED: 'הספק דחה את הניסיון מבחינה כספית.',
      UNKNOWN: 'ייתכן שהבקשה הגיעה לספק; התוצאה הכספית עדיין לא ידועה בבטחה.',
      TECHNICAL_FAILED: 'המערכת יודעת שאף ניסיון כספי לא התקבל/הגיע, לפי אינווריאנט הסיווג שלנו.',
    } as Record<string, string>,
  },
} satisfies Record<UiLang, unknown>

export function SubscriptionDetail({ subscriptionId, profile, lang, onBack, onNavigateToCustomer }: Props) {
  const T = STRINGS[lang]
  const [subscription, setSubscription] = useState<SpectraSubscription | null>(null)
  const [customer, setCustomer] = useState<SpectraCustomer | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<SpectraPaymentMethod | null>(null)
  const [paymentMethodError, setPaymentMethodError] = useState('')
  const [payments, setPayments] = useState<SpectraPayment[]>([])
  const [attemptsByPayment, setAttemptsByPayment] = useState<Record<string, SpectraPaymentAttempt[]>>({})
  const [documentsByPayment, setDocumentsByPayment] = useState<Record<string, SpectraPaymentDocument[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setPaymentMethodError('')

    async function run() {
      const sub = await getSubscription(subscriptionId, profile.spectraProjectId, profile.id)
      if (cancelled) return
      setSubscription(sub)

      const [customerResult, paymentsResult] = await Promise.all([
        getCustomer(sub.customer_id, profile.spectraProjectId, profile.id),
        listPaymentsForSubscription(subscriptionId, profile.spectraProjectId, profile.id),
      ])
      if (cancelled) return
      setCustomer(customerResult)
      setPayments(paymentsResult.payments)

      getPaymentMethod(sub.payment_method_id, profile.spectraProjectId, profile.id)
        .then((method) => {
          if (!cancelled) setPaymentMethod(method)
        })
        .catch((cause) => {
          if (!cancelled) setPaymentMethodError(cause instanceof Error ? cause.message : 'failed to load')
        })

      const attemptsEntries = await Promise.all(
        paymentsResult.payments.map((payment) =>
          listPaymentAttempts(payment.id, profile.spectraProjectId, profile.id).then(
            (result) => [payment.id, result.attempts] as const,
          ),
        ),
      )
      const documentsEntries = await Promise.all(
        paymentsResult.payments.map((payment) =>
          listPaymentDocuments(payment.id, profile.spectraProjectId, profile.id).then(
            (result) => [payment.id, result.documents] as const,
          ),
        ),
      )
      if (cancelled) return
      setAttemptsByPayment(Object.fromEntries(attemptsEntries))
      setDocumentsByPayment(Object.fromEntries(documentsEntries))
    }

    run()
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'failed to load subscription')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [subscriptionId, profile.id, profile.spectraProjectId])

  if (loading) {
    return (
      <div className="subscription-detail" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <button type="button" className="sd-back" onClick={onBack}>
          {T.back}
        </button>
        <p className="ct-loading">{T.loading}</p>
      </div>
    )
  }

  if (error || !subscription) {
    return (
      <div className="subscription-detail" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <button type="button" className="sd-back" onClick={onBack}>
          {T.back}
        </button>
        <p className="ct-error">{error || T.error}</p>
      </div>
    )
  }

  const now = new Date()
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null
  const isDue = subscription.status === 'ACTIVE' && periodEnd !== null && now >= periodEnd

  // Ordered by subscription_period_start, not created_at: every Payment in this
  // list has subscription_id set, so period_start is always present too (DB
  // CHECK constraint) and is monotonic by construction -- unlike created_at,
  // which is the *transaction's* start time in Postgres and can collide when
  // several Payments are inserted in one transaction (as this session's own
  // synthetic test fixtures did), making wall-clock order an unreliable signal
  // for which billing period actually came first.
  const orderedPayments = [...payments].sort((a, b) => {
    const aTime = a.subscription_period_start ? new Date(a.subscription_period_start).getTime() : 0
    const bTime = b.subscription_period_start ? new Date(b.subscription_period_start).getTime() : 0
    return aTime - bTime
  })

  return (
    <div className="subscription-detail" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <button type="button" className="sd-back" onClick={onBack}>
        {T.back}
      </button>

      {/* Section 1 -- Subscription */}
      <section className="sd-card">
        <div className="sd-card-head">
          <h3>{T.subscription}</h3>
          <StatusBadge status={subscription.status} />
        </div>
        <dl className="sd-fields">
          <div>
            <dt>{T.subscriptionId}</dt>
            <dd className="ct-id">{subscription.id}</dd>
          </div>
          <div>
            <dt>{T.amount}</dt>
            <dd>
              {subscription.amount} {subscription.currency}
            </dd>
          </div>
          <div>
            <dt>{T.planReference}</dt>
            <dd>{subscription.external_plan_reference || T.noPlanReference}</dd>
          </div>
          <div>
            <dt>{T.anchorDay}</dt>
            <dd>{subscription.billing_anchor_day ?? '—'}</dd>
          </div>
          <div>
            <dt>{T.createdAt}</dt>
            <dd>{fmtDate(subscription.created_at, lang)}</dd>
          </div>
          <div>
            <dt>{T.updatedAt}</dt>
            <dd>{fmtDate(subscription.updated_at, lang)}</dd>
          </div>
        </dl>
      </section>

      {/* Section 2 -- Billing period */}
      <section className="sd-card">
        <h3>{T.billingPeriod}</h3>
        <dl className="sd-fields">
          <div>
            <dt>{T.periodStart}</dt>
            <dd>{fmtDate(subscription.current_period_start, lang)}</dd>
          </div>
          <div>
            <dt>{T.periodEnd}</dt>
            <dd>{fmtDate(subscription.current_period_end, lang)}</dd>
          </div>
        </dl>
        <p className={`sd-due${isDue ? ' is-due' : ''}`}>{isDue ? T.dueNow : T.notDueYet}</p>
        <p className="sd-note">{T.dueNote}</p>
        {subscription.status === 'CANCELLED' ? (
          <p className="sd-cancel-note is-cancelled">{T.alreadyCancelled}</p>
        ) : subscription.cancel_at_period_end ? (
          <p className="sd-cancel-note is-cancelling">
            {T.willCancelAt(fmtDate(subscription.current_period_end, lang))}
          </p>
        ) : (
          <p className="sd-cancel-note">{T.willRenew}</p>
        )}
      </section>

      {/* Section 3 -- Customer */}
      <section className="sd-card">
        <h3>{T.customer}</h3>
        {customer ? (
          <>
            <dl className="sd-fields">
              <div>
                <dt>{T.customerName}</dt>
                <dd>{customer.display_name || '—'}</dd>
              </div>
              <div>
                <dt>{T.customerId}</dt>
                <dd className="ct-id">{customer.id}</dd>
              </div>
              <div>
                <dt>{T.customer}</dt>
                <dd className="ct-project-badge">{customer.project_id}</dd>
              </div>
            </dl>
            <button type="button" className="sd-link-button" onClick={() => onNavigateToCustomer(customer.id)}>
              {T.viewCustomer}
            </button>
          </>
        ) : null}
      </section>

      {/* Section 4 -- Payment method */}
      <section className="sd-card">
        <h3>{T.paymentMethod}</h3>
        {paymentMethodError ? <p className="ct-error">{T.pmLoadError}</p> : null}
        {paymentMethod ? (
          <dl className="sd-fields">
            <div>
              <dt>{T.pmId}</dt>
              <dd className="ct-id">{paymentMethod.id}</dd>
            </div>
            <div>
              <dt>{T.pmProvider}</dt>
              <dd>{paymentMethod.provider}</dd>
            </div>
            <div>
              <dt>{T.pmStatus}</dt>
              <dd>
                <StatusBadge status={paymentMethod.status} />
              </dd>
            </div>
            <div>
              <dt>{T.pmBrand}</dt>
              <dd>{paymentMethod.card_brand || T.notAvailable}</dd>
            </div>
            <div>
              <dt>{T.pmLast4}</dt>
              <dd>{paymentMethod.card_last4 ? `•••• ${paymentMethod.card_last4}` : T.notAvailable}</dd>
            </div>
            <div>
              <dt>{T.pmExpiry}</dt>
              <dd>
                {paymentMethod.card_month && paymentMethod.card_year
                  ? `${String(paymentMethod.card_month).padStart(2, '0')}/${paymentMethod.card_year}`
                  : T.notAvailable}
              </dd>
            </div>
          </dl>
        ) : !paymentMethodError ? (
          <p className="ct-loading">{T.loading}</p>
        ) : null}
      </section>

      {/* Section 5/6/7 -- Payment history, attempts, documents */}
      <section className="sd-card">
        <h3>{T.paymentHistory}</h3>
        {orderedPayments.length === 0 ? <p className="ct-empty">{T.noPayments}</p> : null}
        <ul className="ct-rows">
          {orderedPayments.map((payment, index) => {
            const attempts = attemptsByPayment[payment.id] ?? []
            const documents = documentsByPayment[payment.id] ?? []
            const expanded = expandedPaymentId === payment.id
            return (
              <li key={payment.id} className="sd-payment">
                <div className="ct-row sd-payment-row">
                  <span className="sd-payment-label">
                    {index === 0 ? T.initialPayment : T.renewalPayment(index)}
                  </span>
                  <span className="ct-row-amount">
                    {payment.amount} {payment.currency}
                  </span>
                  <StatusBadge status={payment.status} />
                  <span className="ct-row-date">{fmtDate(payment.created_at, lang)}</span>
                  <span className="ct-id ct-id--inline">{payment.id}</span>
                  <button
                    type="button"
                    className="ct-raw-toggle"
                    onClick={() => setExpandedPaymentId(expanded ? null : payment.id)}
                  >
                    {expanded ? T.collapse : T.expand}
                  </button>
                </div>
                {expanded ? (
                  <div className="sd-payment-expanded">
                    <h4>{T.attempts}</h4>
                    {attempts.length === 0 ? <p className="ct-empty">{T.noAttempts}</p> : null}
                    <ul className="ct-rows">
                      {attempts.map((attempt) => (
                        <li key={attempt.id} className="ct-row sd-attempt-row">
                          <StatusBadge status={attempt.status} />
                          <span className="ct-row-date">{fmtDate(attempt.created_at, lang)}</span>
                          {attempt.provider_reference ? (
                            <span className="ct-id">{attempt.provider_reference}</span>
                          ) : null}
                          <span className="ct-id ct-id--inline">{attempt.id}</span>
                          <p className="sd-attempt-explain">{T.explain[attempt.status] ?? ''}</p>
                        </li>
                      ))}
                    </ul>

                    <h4>{T.documents}</h4>
                    {documents.length === 0 ? <p className="ct-empty">{T.noDocuments}</p> : null}
                    <ul className="ct-rows">
                      {documents.map((document) => (
                        <li key={document.id} className="ct-row">
                          <StatusBadge status={document.status} />
                          {document.provider_reference ? (
                            <span className="ct-id">{document.provider_reference}</span>
                          ) : null}
                          <span className="ct-row-date">{fmtDate(document.created_at, lang)}</span>
                          <span className="ct-id ct-id--inline">{document.id}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      {/* Section 8 -- Resource graph */}
      <section className="sd-card">
        <h3>{T.resourceGraph}</h3>
        <ul className="sd-graph">
          <li>
            <span className="sd-graph-node">
              {customer?.display_name || T.noPlanReference} · {T.customer}
            </span>
            <ul>
              <li>
                <span className="sd-graph-node sd-graph-node--main">
                  <StatusBadge status={subscription.status} /> {T.subscription}
                </span>
                <ul>
                  <li>
                    <span className="sd-graph-node">
                      {T.paymentMethod}:{' '}
                      {paymentMethod
                        ? `${paymentMethod.provider} ${
                            paymentMethod.card_last4 ? `•••• ${paymentMethod.card_last4}` : T.notAvailable
                          }`
                        : T.notAvailable}
                    </span>
                  </li>
                  {orderedPayments.map((payment, index) => (
                    <li key={payment.id}>
                      <span className="sd-graph-node">
                        {index === 0 ? T.initialPayment : T.renewalPayment(index)} ({payment.amount}{' '}
                        {payment.currency})
                      </span>
                      <ul>
                        {(attemptsByPayment[payment.id] ?? []).map((attempt) => (
                          <li key={attempt.id}>
                            <span className="sd-graph-node">
                              → <StatusBadge status={attempt.status} />
                            </span>
                            <ul>
                              {(documentsByPayment[payment.id] ?? [])
                                .filter((document) => document.payment_attempt_id === attempt.id)
                                .map((document) => (
                                  <li key={document.id}>
                                    <span className="sd-graph-node">
                                      → {T.documents}: <StatusBadge status={document.status} />
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      </section>

      {/* Raw / Under the hood */}
      <button type="button" className="ct-raw-toggle sd-raw-toggle" onClick={() => setShowRaw((v) => !v)}>
        🤓 {showRaw ? T.hideRaw : T.showRaw}
      </button>
      {showRaw ? (
        <pre className="ct-raw">
          {JSON.stringify(
            {
              'GET /subscriptions/{id}': subscription,
              'GET /customers/{id}': customer,
              'GET /payment-methods/{id}': paymentMethod,
              'GET /payments?subscription_id=': payments,
              'GET /payments/{id}/attempts': attemptsByPayment,
              'GET /payments/{id}/documents': documentsByPayment,
            },
            null,
            2,
          )}
        </pre>
      ) : null}
    </div>
  )
}
