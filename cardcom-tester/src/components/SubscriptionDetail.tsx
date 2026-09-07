import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  cancelSubscription,
  executeDuePeriod,
  getCustomer,
  getPaymentMethod,
  getSubscription,
  listPaymentAttempts,
  listPaymentDocuments,
  listPaymentsForSubscription,
  reconcilePayment,
  reexecutePayment,
  type SpectraCustomer,
  type SpectraExecuteDuePeriodResult,
  type SpectraPayment,
  type SpectraPaymentAttempt,
  type SpectraPaymentDocument,
  type SpectraPaymentMethod,
  type SpectraReconcileResult,
  type SpectraSubscription,
} from './spectraClient'
import type { BusinessProfile } from './profiles'
import {
  canCancelAtPeriodEnd as computeCanCancelAtPeriodEnd,
  canCancelImmediately as computeCanCancelImmediately,
  canExecuteDuePeriod as computeCanExecuteDuePeriod,
  isSubscriptionCancelled,
  isSubscriptionDue,
  reconcileEligible,
  reexecuteEligible,
} from './subscriptionOperationEligibility'
import type { UiLang } from './uiLang'
import { StatusBadge, fmtDate } from './consoleShared'
import './customersTab.css'
import './subscriptionsTab.css'
import './subscriptionDetail.css'

// The Subscription detail/resource-graph view: Subscription -> Customer ->
// PaymentMethod, and Subscription -> Payments -> Attempts -> Documents, all
// read straight from spectra-payments persisted truth (no frontend billing
// logic, no invented fields). Also exposes the real operations spectra-payments
// already implements (execute-due-period, cancel, reconcile, re-execute) --
// every one of them requires an explicit two-step confirmation, disables while
// in flight, and always refetches persisted state afterward rather than
// optimistically guessing the result. The backend alone decides every
// financial/state transition; this file never invents one.

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
      DECLINED: 'Provider financially rejected the attempt. We know the financial outcome.',
      UNKNOWN:
        'Cardcom may have processed this request, but spectra-payments does not yet know the authoritative financial outcome. DO NOT CHARGE AGAIN.',
      TECHNICAL_FAILED:
        'Spectra Payments knows the financial request was not accepted/reached, per our current failure classification.',
    } as Record<string, string>,
    actions: 'Actions',
    actionsNote: 'Every action below requires explicit confirmation. None of them fires from opening, refreshing, or expanding this page.',
    executeDuePeriod: 'Execute due period',
    executeDuePeriodConfirmDue:
      'This operation may charge the subscription’s stored payment method if the subscription is currently due.',
    executeDuePeriodConfirmNotDue:
      'Based on current_period_end, this Subscription is not due yet. The backend will decide authoritatively and will not attempt a charge if it agrees.',
    cancelAtPeriodEndAction: 'Cancel at period end',
    cancelAtPeriodEndConfirm:
      'The subscription remains active through the current paid period and will not renew after the period ends.',
    cancelImmediatelyAction: 'Cancel immediately',
    cancelImmediatelyConfirm:
      'The subscription will be cancelled immediately. This does not issue a refund, reversal, Cardcom credit, or document cancellation — cancellation is not a refund.',
    confirm: 'Confirm',
    cancelPrompt: 'Cancel',
    reconcileAction: 'Reconcile',
    reconcileConfirm:
      'Ask Cardcom for the authoritative result of the existing financial attempt. This does not submit a new charge.',
    reexecuteAction: 'Re-execute',
    reexecuteConfirm:
      'This can create a new Cardcom financial request. Only safe because spectra-payments has classified the existing attempt as TECHNICAL_FAILED and currently permits reexecution.',
    working: 'Working…',
    resultTitle: 'Last operation',
    resultOutcomeNotDue: 'NOT DUE — no charge was attempted.',
    resultOutcomeCancelledAtBoundary: 'CANCELLED AT BOUNDARY — the scheduled cancellation took effect. No charge was attempted.',
    resultOutcomeSucceeded: 'RENEWAL SUCCEEDED',
    resultOutcomeDeclined: 'RENEWAL DECLINED — Cardcom rejected the financial attempt. We know the financial outcome.',
    resultOutcomeUnknown: 'RENEWAL UNKNOWN — do not charge again. Use Reconcile to ask Cardcom for the authoritative result.',
    resultOutcomeTechnicalFailed: 'RENEWAL TECHNICAL_FAILED — no financial attempt reached Cardcom.',
    resultCancelled: 'Cancellation applied.',
    resultReconcileResolved: 'RESOLVED — the authoritative outcome is now known.',
    resultReconcileUnresolved: 'UNRESOLVED — Cardcom has no record yet. The attempt remains as it was; nothing changed.',
    resultReconcileAlreadyResolved: 'ALREADY RESOLVED — this Payment was no longer PENDING; no provider call was made.',
    resultReexecuteHeading: 'RE-EXECUTE RESULT',
    payment: 'Payment',
    attempt: 'Attempt',
    oldPeriod: 'Old period',
    newPeriod: 'New period',
    subscriptionNowLabel: 'Subscription now',
    operationFailed: 'Operation failed',
    underTheHoodOperation: 'Under the Hood — this operation',
    request: 'request',
    response: 'response',
    persistedChanged: 'Persisted resources refreshed from the backend after this operation.',
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
      DECLINED: 'הספק דחה את הניסיון מבחינה כספית. אנחנו יודעים את התוצאה הכספית.',
      UNKNOWN: 'ייתכן שקארדקום עיבד את הבקשה, אך עדיין לא ידוע ל-spectra-payments מה התוצאה הכספית הסמכותית. אין לחייב שוב.',
      TECHNICAL_FAILED: 'Spectra Payments יודעת שהבקשה הכספית לא התקבלה/הגיעה, לפי סיווג הכשל הנוכחי שלנו.',
    } as Record<string, string>,
    actions: 'פעולות',
    actionsNote: 'כל פעולה למטה דורשת אישור מפורש. אף אחת מהן לא מופעלת מפתיחת הדף, רענון, או הרחבת שורה.',
    executeDuePeriod: 'הפעל תקופת חיוב',
    executeDuePeriodConfirmDue: 'פעולה זו עשויה לחייב את אמצעי התשלום השמור של המנוי אם המנוי חייב כרגע.',
    executeDuePeriodConfirmNotDue:
      'לפי current_period_end, המנוי הזה עדיין לא חייב. השרת יחליט באופן סמכותי ולא ינסה לחייב אם הוא מסכים.',
    cancelAtPeriodEndAction: 'ביטול בסוף התקופה',
    cancelAtPeriodEndConfirm: 'המנוי יישאר פעיל לאורך התקופה המשולמת הנוכחית ולא יתחדש לאחר סיומה.',
    cancelImmediatelyAction: 'ביטול מיידי',
    cancelImmediatelyConfirm:
      'המנוי יבוטל מיידית. פעולה זו אינה כוללת החזר כספי, ביטול חיוב, זיכוי בקארדקום, או ביטול מסמך — ביטול אינו החזר כספי.',
    confirm: 'אישור',
    cancelPrompt: 'ביטול',
    reconcileAction: 'התאמה (Reconcile)',
    reconcileConfirm: 'שאלו את קארדקום מהי התוצאה הסמכותית של הניסיון הכספי הקיים. פעולה זו אינה שולחת חיוב חדש.',
    reexecuteAction: 'ביצוע חוזר (Re-execute)',
    reexecuteConfirm:
      'פעולה זו עשויה ליצור בקשה כספית חדשה בקארדקום. בטוחה רק מכיוון ש-spectra-payments סיווגה את הניסיון הקיים כ-TECHNICAL_FAILED ומתירה כרגע ביצוע חוזר.',
    working: 'מבצע…',
    resultTitle: 'הפעולה האחרונה',
    resultOutcomeNotDue: 'לא חייב (NOT_DUE) — לא בוצע ניסיון חיוב.',
    resultOutcomeCancelledAtBoundary: 'בוטל בגבול התקופה — הביטול המתוזמן נכנס לתוקף. לא בוצע ניסיון חיוב.',
    resultOutcomeSucceeded: 'חידוש הצליח',
    resultOutcomeDeclined: 'חידוש נדחה — קארדקום דחה את הניסיון הכספי. אנחנו יודעים את התוצאה הכספית.',
    resultOutcomeUnknown: 'חידוש לא ידוע (UNKNOWN) — אין לחייב שוב. השתמשו ב״התאמה״ כדי לבקש מקארדקום את התוצאה הסמכותית.',
    resultOutcomeTechnicalFailed: 'חידוש נכשל טכנית — אף בקשה כספית לא הגיעה לקארדקום.',
    resultCancelled: 'הביטול הוחל.',
    resultReconcileResolved: 'נפתר (RESOLVED) — התוצאה הסמכותית ידועה כעת.',
    resultReconcileUnresolved: 'לא נפתר (UNRESOLVED) — לקארדקום אין עדיין רשומה. הניסיון נשאר כפי שהיה; שום דבר לא השתנה.',
    resultReconcileAlreadyResolved: 'כבר נפתר — התשלום הזה כבר לא היה PENDING; לא בוצעה קריאה לספק.',
    resultReexecuteHeading: 'תוצאת ביצוע חוזר',
    payment: 'תשלום',
    attempt: 'ניסיון',
    oldPeriod: 'תקופה ישנה',
    newPeriod: 'תקופה חדשה',
    subscriptionNowLabel: 'המנוי כעת',
    operationFailed: 'הפעולה נכשלה',
    underTheHoodOperation: 'מתחת למכסה המנוע — הפעולה הזו',
    request: 'בקשה',
    response: 'תגובה',
    persistedChanged: 'המשאבים השמורים רועננו מהשרת לאחר הפעולה הזו.',
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

  // Operations (Slice 5): armedAction is which confirmation is currently open
  // ('execute-due-period' | 'cancel-at-period-end' | 'cancel-immediately' |
  // `reconcile:${paymentId}` | `reexecute:${paymentId}`), operating disables
  // every action button while a request is in flight, lastOperation drives
  // both the result panel and its own Under the Hood trace.
  const [armedAction, setArmedAction] = useState<string | null>(null)
  const [operating, setOperating] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [lastOperation, setLastOperation] = useState<{
    kind: 'execute-due-period' | 'cancel' | 'reconcile' | 'reexecute'
    endpoint: string
    request: unknown
    response: unknown
    previousSubscription?: SpectraSubscription
  } | null>(null)

  const loadAll = useCallback(async () => {
    const sub = await getSubscription(subscriptionId, profile.spectraProjectId, profile.id)
    setSubscription(sub)

    const [customerResult, paymentsResult] = await Promise.all([
      getCustomer(sub.customer_id, profile.spectraProjectId, profile.id),
      listPaymentsForSubscription(subscriptionId, profile.spectraProjectId, profile.id),
    ])
    setCustomer(customerResult)
    setPayments(paymentsResult.payments)

    setPaymentMethodError('')
    try {
      setPaymentMethod(await getPaymentMethod(sub.payment_method_id, profile.spectraProjectId, profile.id))
    } catch (cause) {
      setPaymentMethodError(cause instanceof Error ? cause.message : 'failed to load')
    }

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
    setAttemptsByPayment(Object.fromEntries(attemptsEntries))
    setDocumentsByPayment(Object.fromEntries(documentsEntries))
    return sub
  }, [subscriptionId, profile.id, profile.spectraProjectId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    loadAll()
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'failed to load subscription')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadAll])

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

  const isDue = isSubscriptionDue(subscription, new Date())

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

  // Button visibility only, mirroring the backend's own documented eligibility
  // (app.services.subscriptions/reconciliation/recovery) -- the backend alone
  // still authorizes/decides every request; a stale/wrong guess here just gets
  // a plain rejection back, never a silent bypass. Logic lives in
  // subscriptionOperationEligibility.ts (plain functions, unit-tested there).
  const canCancelAtPeriodEnd = computeCanCancelAtPeriodEnd(subscription)
  const canCancelImmediately = computeCanCancelImmediately(subscription)
  const canExecuteDuePeriod = computeCanExecuteDuePeriod(subscription)

  const paymentReconcileEligible = (payment: SpectraPayment) =>
    reconcileEligible(payment, attemptsByPayment[payment.id] ?? [])
  const paymentReexecuteEligible = (payment: SpectraPayment) =>
    reexecuteEligible(payment, attemptsByPayment[payment.id] ?? [])

  async function runOperation(
    kind: 'execute-due-period' | 'cancel' | 'reconcile' | 'reexecute',
    endpoint: string,
    request: unknown,
    call: () => Promise<unknown>,
    previousSubscription?: SpectraSubscription,
  ) {
    setOperating(true)
    setOperationError('')
    try {
      const response = await call()
      setLastOperation({ kind, endpoint, request, response, previousSubscription })
      await loadAll()
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : 'operation failed')
    }
    setOperating(false)
    setArmedAction(null)
  }

  const runExecuteDuePeriod = () =>
    runOperation(
      'execute-due-period',
      `POST /subscriptions/${subscriptionId}/execute-due-period`,
      { project_id: profile.spectraProjectId },
      () => executeDuePeriod(subscriptionId, profile.spectraProjectId, profile.id),
      subscription,
    )

  const runCancel = (atPeriodEnd: boolean) =>
    runOperation(
      'cancel',
      `POST /subscriptions/${subscriptionId}/cancel`,
      { project_id: profile.spectraProjectId, at_period_end: atPeriodEnd },
      () => cancelSubscription(subscriptionId, atPeriodEnd, profile.spectraProjectId, profile.id),
    )

  const runReconcile = (paymentId: string) =>
    runOperation(
      'reconcile',
      `POST /payments/${paymentId}/reconcile`,
      { project_id: profile.spectraProjectId },
      () => reconcilePayment(paymentId, profile.spectraProjectId, profile.id),
    )

  const runReexecute = (paymentId: string) =>
    runOperation(
      'reexecute',
      `POST /payments/${paymentId}/re-execute`,
      { project_id: profile.spectraProjectId },
      () => reexecutePayment(paymentId, profile.spectraProjectId, profile.id),
    )

  function renderAction(
    id: string,
    label: string,
    variant: 'safe' | 'financial' | 'state',
    explainText: string,
    onConfirm: () => void,
  ) {
    if (armedAction !== id) {
      return (
        <button
          key={id}
          type="button"
          className={`sd-action-btn sd-action-btn--${variant}`}
          disabled={operating}
          onClick={() => setArmedAction(id)}
        >
          {label}
        </button>
      )
    }
    return (
      <div key={id} className="sd-confirm">
        <p>{explainText}</p>
        <div className="sd-confirm-actions">
          <button type="button" className="sd-confirm-cancel" disabled={operating} onClick={() => setArmedAction(null)}>
            {T.cancelPrompt}
          </button>
          <button
            type="button"
            className={`sd-confirm-go sd-confirm-go--${variant}`}
            disabled={operating}
            onClick={onConfirm}
          >
            {operating ? T.working : T.confirm}
          </button>
        </div>
      </div>
    )
  }

  function renderResultPanel() {
    if (!lastOperation) return null
    const { kind, response, previousSubscription, endpoint, request } = lastOperation
    let heading = ''
    let body: ReactNode = null
    if (kind === 'execute-due-period') {
      const r = response as SpectraExecuteDuePeriodResult
      if (r.outcome === 'NOT_DUE') {
        heading = T.resultOutcomeNotDue
      } else if (r.outcome === 'CANCELLED_AT_BOUNDARY') {
        heading = T.resultOutcomeCancelledAtBoundary
      } else if (r.attempt_status === 'SUCCEEDED') {
        heading = T.resultOutcomeSucceeded
        body = (
          <dl className="sd-fields">
            <div>
              <dt>{T.payment}</dt>
              <dd className="ct-id">{r.payment_id}</dd>
            </div>
            <div>
              <dt>{T.oldPeriod}</dt>
              <dd>
                {fmtDate(previousSubscription?.current_period_start ?? null, lang)} →{' '}
                {fmtDate(previousSubscription?.current_period_end ?? null, lang)}
              </dd>
            </div>
            <div>
              <dt>{T.newPeriod}</dt>
              <dd>
                {fmtDate(r.subscription.current_period_start, lang)} →{' '}
                {fmtDate(r.subscription.current_period_end, lang)}
              </dd>
            </div>
          </dl>
        )
      } else if (r.attempt_status === 'DECLINED') {
        heading = T.resultOutcomeDeclined
        body = (
          <p>
            {T.subscriptionNowLabel}: <StatusBadge status={r.subscription.status} />
          </p>
        )
      } else if (r.attempt_status === 'UNKNOWN') {
        heading = T.resultOutcomeUnknown
      } else if (r.attempt_status === 'TECHNICAL_FAILED') {
        heading = T.resultOutcomeTechnicalFailed
      }
    } else if (kind === 'cancel') {
      heading = T.resultCancelled
    } else if (kind === 'reconcile') {
      const r = response as SpectraReconcileResult
      heading =
        r.reconciliation_outcome === 'RESOLVED'
          ? T.resultReconcileResolved
          : r.reconciliation_outcome === 'UNRESOLVED'
            ? T.resultReconcileUnresolved
            : T.resultReconcileAlreadyResolved
    } else if (kind === 'reexecute') {
      heading = T.resultReexecuteHeading
    }
    return (
      <section className="sd-card sd-result">
        <h3>{T.resultTitle}</h3>
        <p className="sd-result-heading">{heading}</p>
        {body}
        <p className="sd-note">{T.persistedChanged}</p>
        <details className="sd-operation-raw">
          <summary>
            {T.underTheHoodOperation}: {endpoint}
          </summary>
          <pre className="ct-raw">
            {JSON.stringify({ [T.request]: request, [T.response]: response }, null, 2)}
          </pre>
        </details>
      </section>
    )
  }

  return (
    <div className="subscription-detail" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <button type="button" className="sd-back" onClick={onBack}>
        {T.back}
      </button>

      {renderResultPanel()}

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
        {isSubscriptionCancelled(subscription) ? (
          <p className="sd-cancel-note is-cancelled">{T.alreadyCancelled}</p>
        ) : subscription.cancel_at_period_end ? (
          <p className="sd-cancel-note is-cancelling">
            {T.willCancelAt(fmtDate(subscription.current_period_end, lang))}
          </p>
        ) : (
          <p className="sd-cancel-note">{T.willRenew}</p>
        )}
      </section>

      {/* Actions -- every one requires explicit confirmation; none fires from
          opening/refreshing/expanding this page. */}
      <section className="sd-card">
        <h3>{T.actions}</h3>
        <p className="sd-note">{T.actionsNote}</p>
        <div className="sd-actions-row">
          {canExecuteDuePeriod
            ? renderAction(
                'execute-due-period',
                T.executeDuePeriod,
                'financial',
                isDue ? T.executeDuePeriodConfirmDue : T.executeDuePeriodConfirmNotDue,
                runExecuteDuePeriod,
              )
            : null}
          {canCancelAtPeriodEnd
            ? renderAction(
                'cancel-at-period-end',
                T.cancelAtPeriodEndAction,
                'state',
                T.cancelAtPeriodEndConfirm,
                () => runCancel(true),
              )
            : null}
          {canCancelImmediately
            ? renderAction(
                'cancel-immediately',
                T.cancelImmediatelyAction,
                'state',
                T.cancelImmediatelyConfirm,
                () => runCancel(false),
              )
            : null}
        </div>
        {operationError ? (
          <p className="ct-error">
            {T.operationFailed}: {operationError}
          </p>
        ) : null}
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

                    {paymentReconcileEligible(payment) || paymentReexecuteEligible(payment) ? (
                      <div className="sd-payment-actions">
                        {paymentReconcileEligible(payment)
                          ? renderAction(
                              `reconcile:${payment.id}`,
                              T.reconcileAction,
                              'safe',
                              T.reconcileConfirm,
                              () => runReconcile(payment.id),
                            )
                          : null}
                        {paymentReexecuteEligible(payment)
                          ? renderAction(
                              `reexecute:${payment.id}`,
                              T.reexecuteAction,
                              'financial',
                              T.reexecuteConfirm,
                              () => runReexecute(payment.id),
                            )
                          : null}
                      </div>
                    ) : null}

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
