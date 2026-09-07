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

type Props = {
  profile: BusinessProfile
  lang: UiLang
  onNavigateToCustomer: (customerId: string) => void
}

const STRINGS: Record<UiLang, Record<string, string>> = {
  en: {
    kicker: 'Persisted Subscriptions',
    countOne: '1 subscription',
    countMany: '{n} subscriptions',
    empty: 'No Subscriptions yet for this project.',
    loading: 'Loading…',
    loadMore: 'Load more',
    customer: 'Customer',
    periodEnd: 'Current period ends',
    willRenew: 'Renews automatically',
    willCancel: 'Cancels at period end',
    plan: 'Plan reference',
  },
  he: {
    kicker: 'מנויים שמורים',
    countOne: 'מנוי אחד',
    countMany: '{n} מנויים',
    empty: 'עדיין אין מנויים לפרויקט הזה.',
    loading: 'טוען…',
    loadMore: 'טען עוד',
    customer: 'לקוח',
    periodEnd: 'התקופה הנוכחית מסתיימת',
    willRenew: 'מתחדש אוטומטית',
    willCancel: 'יבוטל בסוף התקופה',
    plan: 'הפניית תוכנית',
  },
}

export function SubscriptionsTab({ profile, lang, onNavigateToCustomer }: Props) {
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
      <SubscriptionDetail
        subscriptionId={selectedId}
        profile={profile}
        lang={lang}
        onBack={() => setSelectedId(null)}
        onNavigateToCustomer={onNavigateToCustomer}
      />
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

      <ul className="st-rows">
        {subscriptions.map((subscription) => (
          <li key={subscription.id} className="st-row-wrap">
            <button
              type="button"
              className="ct-row st-row st-row--clickable"
              onClick={() => setSelectedId(subscription.id)}
            >
              <StatusBadge status={subscription.status} />
              <span className="ct-row-amount">
                {subscription.amount} {subscription.currency}
              </span>
              <span className="ct-row-date">
                {T.periodEnd}: {fmtDate(subscription.current_period_end, lang)}
              </span>
              <span className={`ct-renew-tag${subscription.cancel_at_period_end ? ' is-cancelling' : ''}`}>
                {subscription.cancel_at_period_end ? T.willCancel : T.willRenew}
              </span>
              {subscription.external_plan_reference ? (
                <span className="st-plan-tag">{subscription.external_plan_reference}</span>
              ) : null}
              <span className="st-customer">
                {T.customer}: <span className="ct-id">{subscription.customer_id}</span>
              </span>
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
  )
}
