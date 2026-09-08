import { useEffect, useState } from 'react'
import { listSubscriptions, type SpectraSubscription } from './spectraClient'
import type { BusinessProfile } from './profiles'
import type { UiLang } from './uiLang'
import { StatusBadge, fmtDate } from './consoleShared'
import { SubscriptionDetail } from './SubscriptionDetail'
import './customersTab.css'
import './subscriptionsTab.css'

// The project's own Subscriptions, straight from persisted truth (GET
// /subscriptions, project-wide) -- the list view for a standalone console tab
// that WATCHES recurring billing, distinct from Guided (which teaches how a
// Subscription gets CREATED). Inspection-first: no actions yet (execute-due-
// period / cancel / reconcile come with a later slice), just what already
// exists. Clicking a row opens its full detail/resource-graph view.
//
// Each row's customer_display_name comes back attached to the list response
// itself (the backend resolves it with one batched lookup) -- there is no
// separate Customers tab to cross-reference against, and no per-row fetch here:
// every extra round trip through this app's proxy chain costs a real 1-2s, so a
// list view is exactly where an N+1 pattern would actually be felt.

type Props = {
  profile: BusinessProfile
  lang: UiLang
}

const STRINGS: Record<UiLang, Record<string, string>> = {
  en: {
    kicker: 'Persisted Subscriptions',
    countOne: '1 subscription',
    countMany: '{n} subscriptions',
    empty: 'No Subscriptions yet for this project.',
    loading: 'Loading…',
    loadMore: 'Load more',
    colStatus: 'Status',
    colAmount: 'Amount',
    colCustomer: 'Customer',
    colPlan: 'Plan',
    colCreated: 'Created',
    colPeriodEnd: 'Current period ends',
    colRenewal: 'Renewal',
    willRenew: 'Renews automatically',
    willCancel: 'Cancels at period end',
  },
  he: {
    kicker: 'מנויים שמורים',
    countOne: 'מנוי אחד',
    countMany: '{n} מנויים',
    empty: 'עדיין אין מנויים לפרויקט הזה.',
    loading: 'טוען…',
    loadMore: 'טען עוד',
    colStatus: 'סטטוס',
    colAmount: 'סכום',
    colCustomer: 'לקוח',
    colPlan: 'תוכנית',
    colCreated: 'נוצר',
    colPeriodEnd: 'התקופה הנוכחית מסתיימת',
    colRenewal: 'חידוש',
    willRenew: 'מתחדש אוטומטית',
    willCancel: 'יבוטל בסוף התקופה',
  },
}

export function SubscriptionsTab({ profile, lang }: Props) {
  const T = STRINGS[lang]
  const [subscriptions, setSubscriptions] = useState<SpectraSubscription[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = async (cursor?: string) => {
    setLoading(true)
    setError('')
    try {
      const result = await listSubscriptions(profile.spectraProjectId, profile.id, { cursor })
      setSubscriptions((prev) => (cursor ? [...prev, ...result.subscriptions] : result.subscriptions))
      setNextCursor(result.next_cursor)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'failed to load subscriptions')
    }
    setLoading(false)
  }

  useEffect(() => {
    setSubscriptions([])
    setNextCursor(null)
    setSelectedId(null)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  if (selectedId) {
    return (
      <SubscriptionDetail subscriptionId={selectedId} profile={profile} lang={lang} onBack={() => setSelectedId(null)} />
    )
  }

  const countLabel = subscriptions.length === 1 ? T.countOne : T.countMany.replace('{n}', String(subscriptions.length))

  return (
    <div className="subscriptions-tab" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <div className="st-head">
        <span className="ct-kicker">{T.kicker}</span>
        <span className="ct-project-badge">{profile.spectraProjectId}</span>
      </div>
      <p className="ct-count">{countLabel}</p>
      {error ? <p className="ct-error">{error}</p> : null}
      {subscriptions.length === 0 && !loading && !error ? <p className="ct-empty">{T.empty}</p> : null}

      {subscriptions.length > 0 ? (
        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <th>{T.colStatus}</th>
                <th>{T.colAmount}</th>
                <th>{T.colCustomer}</th>
                <th>{T.colPlan}</th>
                <th>{T.colCreated}</th>
                <th>{T.colPeriodEnd}</th>
                <th>{T.colRenewal}</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => {
                return (
                  <tr
                    key={subscription.id}
                    className="st-table-row"
                    tabIndex={0}
                    role="button"
                    onClick={() => setSelectedId(subscription.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') setSelectedId(subscription.id)
                    }}
                  >
                    <td>
                      <StatusBadge status={subscription.status} />
                    </td>
                    <td>
                      {subscription.amount} {subscription.currency}
                    </td>
                    <td>
                      {subscription.customer_display_name || <span className="ct-id">{subscription.customer_id}</span>}
                    </td>
                    <td>{subscription.external_plan_reference || '—'}</td>
                    <td>{fmtDate(subscription.created_at, lang)}</td>
                    <td>{fmtDate(subscription.current_period_end, lang)}</td>
                    <td>
                      <span className={`ct-renew-tag${subscription.cancel_at_period_end ? ' is-cancelling' : ''}`}>
                        {subscription.cancel_at_period_end ? T.willCancel : T.willRenew}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {nextCursor ? (
        <button type="button" className="ct-load-more" disabled={loading} onClick={() => load(nextCursor)}>
          {loading ? T.loading : T.loadMore}
        </button>
      ) : loading ? (
        <p className="ct-loading">{T.loading}</p>
      ) : null}
    </div>
  )
}
