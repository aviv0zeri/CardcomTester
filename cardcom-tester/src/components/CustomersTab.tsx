import { useEffect, useState } from 'react'
import {
  listCustomers,
  listPaymentsForCustomer,
  listSubscriptionsForCustomer,
  type SpectraCustomer,
  type SpectraPayment,
  type SpectraSubscription,
} from './spectraClient'
import type { BusinessProfile } from './profiles'
import type { UiLang } from './uiLang'
import './customersTab.css'

// Customer inspection, backed entirely by spectra-payments' own persisted
// truth -- nothing here is invented or remembered locally. Picking a business
// profile picks a real, isolated spectra-payments project; this list is that
// project's own Customers, read straight from GET /customers. Clicking one
// shows its real Payments and Subscriptions (GET /payments, GET /subscriptions,
// both filtered by customer_id) -- the start of the resource graph, not a CRM:
// no create/edit/delete here, no search, just what already exists.

type Props = {
  profile: BusinessProfile
  lang: UiLang
}

const STRINGS: Record<UiLang, Record<string, string>> = {
  en: {
    kicker: 'Persisted Customers',
    countOne: '1 customer',
    countMany: '{n} customers',
    empty: 'No Customers yet for this project. Create one from the Guided tab, then come back here.',
    loading: 'Loading…',
    loadMore: 'Load more',
    pickOne: 'Pick a Customer on the left to see its Payments and Subscriptions.',
    noName: '(no name)',
    payments: 'Payments',
    subscriptions: 'Subscriptions',
    noPayments: 'No Payments for this Customer yet.',
    noSubscriptions: 'No Subscriptions for this Customer yet.',
    showRaw: 'Show as JSON',
    hideRaw: 'Hide JSON',
    amount: 'Amount',
    status: 'Status',
    created: 'Created',
    currentPeriodEnd: 'Current period ends',
    willRenew: 'Renews automatically',
    willCancel: 'Cancels at period end',
  },
  he: {
    kicker: 'לקוחות שמורים',
    countOne: 'לקוח אחד',
    countMany: '{n} לקוחות',
    empty: 'עדיין אין לקוחות לפרויקט הזה. צרו אחד בלשונית המודרך, ואז חזרו הנה.',
    loading: 'טוען…',
    loadMore: 'טען עוד',
    pickOne: 'בחרו לקוח משמאל כדי לראות את התשלומים והמנויים שלו.',
    noName: '(ללא שם)',
    payments: 'תשלומים',
    subscriptions: 'מנויים',
    noPayments: 'עדיין אין תשלומים ללקוח הזה.',
    noSubscriptions: 'עדיין אין מנויים ללקוח הזה.',
    showRaw: 'הצג כ-JSON',
    hideRaw: 'הסתר JSON',
    amount: 'סכום',
    status: 'סטטוס',
    created: 'נוצר',
    currentPeriodEnd: 'התקופה הנוכחית מסתיימת',
    willRenew: 'מתחדש אוטומטית',
    willCancel: 'יבוטל בסוף התקופה',
  },
}

function fmtDate(iso: string | null, lang: UiLang): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function StatusBadge({ status }: { status: string }) {
  const cls = status.toLowerCase().replace(/[^a-z]+/g, '-')
  return <span className={`ct-status ct-status--${cls}`}>{status}</span>
}

export function CustomersTab({ profile, lang }: Props) {
  const T = STRINGS[lang]
  const [customers, setCustomers] = useState<SpectraCustomer[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<SpectraCustomer | null>(null)

  const load = async (cursor?: string) => {
    setLoading(true)
    setError('')
    try {
      const result = await listCustomers(profile.spectraProjectId, profile.id, { cursor })
      setCustomers((prev) => (cursor ? [...prev, ...result.customers] : result.customers))
      setNextCursor(result.next_cursor)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'failed to load customers')
    }
    setLoading(false)
  }

  // A new business is a different spectra-payments project -- the whole list
  // (and whatever was selected from the old one) must not carry over.
  useEffect(() => {
    setSelected(null)
    setCustomers([])
    setNextCursor(null)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  const countLabel = (T.countMany.includes('{n}') ? T.countMany.replace('{n}', String(customers.length)) : T.countMany)

  return (
    <div className="customers-tab" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <div className="ct-list-pane">
        <div className="ct-list-head">
          <span className="ct-kicker">{T.kicker}</span>
          <span className="ct-project-badge">{profile.spectraProjectId}</span>
        </div>
        <p className="ct-count">{customers.length === 1 ? T.countOne : countLabel}</p>
        {error ? <p className="ct-error">{error}</p> : null}
        {customers.length === 0 && !loading && !error ? <p className="ct-empty">{T.empty}</p> : null}
        <ul className="ct-list">
          {customers.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                className={`ct-list-item${selected?.id === customer.id ? ' is-selected' : ''}`}
                onClick={() => setSelected(customer)}
              >
                <strong>{customer.display_name || T.noName}</strong>
                <span className="ct-id">{customer.id}</span>
              </button>
            </li>
          ))}
        </ul>
        {nextCursor ? (
          <button type="button" className="ct-load-more" disabled={loading} onClick={() => load(nextCursor)}>
            {loading ? T.loading : T.loadMore}
          </button>
        ) : loading ? (
          <p className="ct-loading">{T.loading}</p>
        ) : null}
      </div>
      <div className="ct-detail-pane">
        {selected ? (
          <CustomerDetail key={selected.id} customer={selected} profile={profile} lang={lang} strings={T} />
        ) : (
          <p className="ct-pick-one">{T.pickOne}</p>
        )}
      </div>
    </div>
  )
}

function CustomerDetail({
  customer,
  profile,
  lang,
  strings: T,
}: {
  customer: SpectraCustomer
  profile: BusinessProfile
  lang: UiLang
  strings: Record<string, string>
}) {
  const [payments, setPayments] = useState<SpectraPayment[]>([])
  const [subscriptions, setSubscriptions] = useState<SpectraSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      listPaymentsForCustomer(customer.id, profile.spectraProjectId, profile.id),
      listSubscriptionsForCustomer(customer.id, profile.spectraProjectId, profile.id),
    ])
      .then(([paymentsResult, subscriptionsResult]) => {
        if (cancelled) return
        setPayments(paymentsResult.payments)
        setSubscriptions(subscriptionsResult.subscriptions)
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [customer.id, profile.id, profile.spectraProjectId])

  return (
    <div className="ct-detail">
      <div className="ct-detail-head">
        <div>
          <strong>{customer.display_name || T.noName}</strong>
          <span className="ct-id">{customer.id}</span>
        </div>
        <span className="ct-project-badge">{customer.project_id}</span>
      </div>

      {error ? <p className="ct-error">{error}</p> : null}
      {loading ? <p className="ct-loading">{T.loading}</p> : null}

      <section className="ct-section">
        <h3>{T.payments}</h3>
        {!loading && payments.length === 0 ? <p className="ct-empty">{T.noPayments}</p> : null}
        {payments.length ? (
          <ul className="ct-rows">
            {payments.map((payment) => (
              <li key={payment.id} className="ct-row">
                <span className="ct-row-amount">
                  {payment.amount} {payment.currency}
                </span>
                <StatusBadge status={payment.status} />
                <span className="ct-row-date">{fmtDate(payment.created_at, lang)}</span>
                <span className="ct-id ct-id--inline">{payment.id}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="ct-section">
        <h3>{T.subscriptions}</h3>
        {!loading && subscriptions.length === 0 ? <p className="ct-empty">{T.noSubscriptions}</p> : null}
        {subscriptions.length ? (
          <ul className="ct-rows">
            {subscriptions.map((subscription) => (
              <li key={subscription.id} className="ct-row ct-row--subscription">
                <span className="ct-row-amount">
                  {subscription.amount} {subscription.currency}
                </span>
                <StatusBadge status={subscription.status} />
                <span className="ct-row-date">
                  {T.currentPeriodEnd}: {fmtDate(subscription.current_period_end, lang)}
                </span>
                <span className={`ct-renew-tag${subscription.cancel_at_period_end ? ' is-cancelling' : ''}`}>
                  {subscription.cancel_at_period_end ? T.willCancel : T.willRenew}
                </span>
                <span className="ct-id ct-id--inline">{subscription.id}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <button type="button" className="ct-raw-toggle" onClick={() => setShowRaw((v) => !v)}>
        🤓 {showRaw ? T.hideRaw : T.showRaw}
      </button>
      {showRaw ? (
        <pre className="ct-raw">
          {JSON.stringify({ customer, payments, subscriptions }, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}
