import type { SpectraPayment, SpectraPaymentAttempt, SpectraSubscription } from './spectraClient'

// Pure eligibility logic for Subscription Detail's action buttons (Slice 5) --
// extracted so it's testable with plain vitest, no DOM/React needed. Button
// visibility only: the backend alone still authorizes every request, so a
// stale/wrong guess here just gets a plain rejection back, never a silent
// bypass.
//
// SubscriptionStatus values are lowercase ('active'/'past_due'/'cancelled') --
// unlike every other status enum in this API (Payment/PaymentAttempt/
// PaymentMethod/PaymentDocument are all UPPERCASE). Confirmed directly against
// spectra-payments' app/models.py. StatusBadge's own display still reads
// uppercase regardless (CSS text-transform), which is exactly what silently
// masked a real bug here the first time through -- these must use the actual
// lowercase values, not screen appearance.
export const SUBSCRIPTION_STATUS_ACTIVE = 'active'
export const SUBSCRIPTION_STATUS_CANCELLED = 'cancelled'

export function isSubscriptionDue(subscription: SpectraSubscription, now: Date): boolean {
  if (subscription.status !== SUBSCRIPTION_STATUS_ACTIVE) return false
  if (!subscription.current_period_end) return false
  return now >= new Date(subscription.current_period_end)
}

export function isSubscriptionCancelled(subscription: SpectraSubscription): boolean {
  return subscription.status === SUBSCRIPTION_STATUS_CANCELLED
}

export function canCancelAtPeriodEnd(subscription: SpectraSubscription): boolean {
  return !isSubscriptionCancelled(subscription) && !subscription.cancel_at_period_end
}

export function canCancelImmediately(subscription: SpectraSubscription): boolean {
  return !isSubscriptionCancelled(subscription)
}

export function canExecuteDuePeriod(subscription: SpectraSubscription): boolean {
  return !isSubscriptionCancelled(subscription)
}

// PaymentStatus/PaymentAttemptStatus ARE uppercase (unlike Subscription's own
// status), matching the enums the backend actually uses.
export function reconcileEligible(payment: SpectraPayment, attempts: SpectraPaymentAttempt[]): boolean {
  if (payment.status !== 'PENDING') return false
  return attempts.some((attempt) => attempt.status === 'UNKNOWN' || attempt.status === 'TECHNICAL_FAILED')
}

export function reexecuteEligible(payment: SpectraPayment, attempts: SpectraPaymentAttempt[]): boolean {
  if (payment.status !== 'PENDING') return false
  return attempts.some((attempt) => attempt.status === 'TECHNICAL_FAILED')
}
