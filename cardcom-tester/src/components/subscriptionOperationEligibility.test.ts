import { describe, expect, it } from 'vitest'
import {
  canCancelAtPeriodEnd,
  canCancelImmediately,
  canExecuteDuePeriod,
  isSubscriptionCancelled,
  isSubscriptionDue,
  reconcileEligible,
  reexecuteEligible,
} from './subscriptionOperationEligibility'
import type { SpectraPayment, SpectraPaymentAttempt, SpectraSubscription } from './spectraClient'

// Regression coverage for a real bug: SubscriptionStatus values are lowercase
// ('active'/'past_due'/'cancelled'), unlike every other status enum in this
// API. The first version of this logic compared against 'ACTIVE'/'CANCELLED'
// (uppercase) and silently never matched -- caught only by live verification
// against a real cancelled subscription, where the action buttons kept
// showing after cancellation. These tests use the real lowercase values the
// backend actually sends, exactly as observed live.

function makeSubscription(overrides: Partial<SpectraSubscription> = {}): SpectraSubscription {
  return {
    id: 'sub-1',
    project_id: 'proj',
    customer_id: 'cust-1',
    payment_method_id: 'pm-1',
    external_plan_reference: null,
    amount: '49.90',
    currency: 'ILS',
    billing_interval: 'monthly',
    billing_anchor_day: 7,
    status: 'active',
    current_period_start: '2026-09-07T00:00:00+00:00',
    current_period_end: '2026-10-07T00:00:00+00:00',
    next_charge_date: '2026-10-07T00:00:00+00:00',
    cancel_at_period_end: false,
    latest_payment_id: null,
    created_at: '2026-09-07T00:00:00+00:00',
    updated_at: '2026-09-07T00:00:00+00:00',
    ...overrides,
  }
}

function makePayment(overrides: Partial<SpectraPayment> = {}): SpectraPayment {
  return {
    id: 'pay-1',
    project_id: 'proj',
    customer_id: 'cust-1',
    checkout_session_id: null,
    amount: '49.90',
    currency: 'ILS',
    source: 'server_side',
    business_reference: null,
    status: 'PENDING',
    subscription_id: 'sub-1',
    subscription_period_start: '2026-09-07T00:00:00+00:00',
    subscription_period_end: '2026-10-07T00:00:00+00:00',
    created_at: '2026-09-07T00:00:00+00:00',
    updated_at: '2026-09-07T00:00:00+00:00',
    ...overrides,
  }
}

function makeAttempt(status: string): SpectraPaymentAttempt {
  return {
    id: `attempt-${status}`,
    project_id: 'proj',
    payment_id: 'pay-1',
    payment_method_id: null,
    status,
    provider: 'cardcom',
    provider_reference: null,
    idempotency_operation_id: null,
    created_at: '2026-09-07T00:00:00+00:00',
    updated_at: '2026-09-07T00:00:00+00:00',
  }
}

describe('isSubscriptionDue', () => {
  it('is due when active and now is past current_period_end', () => {
    const sub = makeSubscription({ status: 'active', current_period_end: '2026-01-01T00:00:00+00:00' })
    expect(isSubscriptionDue(sub, new Date('2026-02-01T00:00:00+00:00'))).toBe(true)
  })

  it('is not due when active but current_period_end is in the future', () => {
    const sub = makeSubscription({ status: 'active', current_period_end: '2026-12-01T00:00:00+00:00' })
    expect(isSubscriptionDue(sub, new Date('2026-01-01T00:00:00+00:00'))).toBe(false)
  })

  it('is never due when cancelled, even if current_period_end has passed', () => {
    const sub = makeSubscription({ status: 'cancelled', current_period_end: '2026-01-01T00:00:00+00:00' })
    expect(isSubscriptionDue(sub, new Date('2026-02-01T00:00:00+00:00'))).toBe(false)
  })
})

describe('isSubscriptionCancelled / cancellation button eligibility', () => {
  it('recognizes the real lowercase "cancelled" status', () => {
    const sub = makeSubscription({ status: 'cancelled' })
    expect(isSubscriptionCancelled(sub)).toBe(true)
    expect(canCancelAtPeriodEnd(sub)).toBe(false)
    expect(canCancelImmediately(sub)).toBe(false)
    expect(canExecuteDuePeriod(sub)).toBe(false)
  })

  it('does not treat an active subscription as cancelled', () => {
    const sub = makeSubscription({ status: 'active' })
    expect(isSubscriptionCancelled(sub)).toBe(false)
    expect(canCancelImmediately(sub)).toBe(true)
    expect(canExecuteDuePeriod(sub)).toBe(true)
  })

  it('hides "cancel at period end" once already scheduled, keeps "cancel immediately"', () => {
    const sub = makeSubscription({ status: 'active', cancel_at_period_end: true })
    expect(canCancelAtPeriodEnd(sub)).toBe(false)
    expect(canCancelImmediately(sub)).toBe(true)
  })

  it('offers both cancel modes on an active subscription with no cancellation scheduled', () => {
    const sub = makeSubscription({ status: 'active', cancel_at_period_end: false })
    expect(canCancelAtPeriodEnd(sub)).toBe(true)
    expect(canCancelImmediately(sub)).toBe(true)
  })
})

describe('reconcileEligible / reexecuteEligible', () => {
  it('reconcile is eligible for a PENDING payment with an UNKNOWN attempt', () => {
    const payment = makePayment({ status: 'PENDING' })
    expect(reconcileEligible(payment, [makeAttempt('UNKNOWN')])).toBe(true)
    expect(reexecuteEligible(payment, [makeAttempt('UNKNOWN')])).toBe(false)
  })

  it('reconcile and re-execute are both eligible for a PENDING payment with a TECHNICAL_FAILED attempt', () => {
    const payment = makePayment({ status: 'PENDING' })
    expect(reconcileEligible(payment, [makeAttempt('TECHNICAL_FAILED')])).toBe(true)
    expect(reexecuteEligible(payment, [makeAttempt('TECHNICAL_FAILED')])).toBe(true)
  })

  it('neither is eligible once the payment is no longer PENDING', () => {
    const payment = makePayment({ status: 'SUCCEEDED' })
    expect(reconcileEligible(payment, [makeAttempt('TECHNICAL_FAILED')])).toBe(false)
    expect(reexecuteEligible(payment, [makeAttempt('TECHNICAL_FAILED')])).toBe(false)
  })

  it('neither is eligible for a settled SUCCEEDED/DECLINED attempt', () => {
    const payment = makePayment({ status: 'PENDING' })
    expect(reconcileEligible(payment, [makeAttempt('DECLINED')])).toBe(false)
    expect(reexecuteEligible(payment, [makeAttempt('SUCCEEDED')])).toBe(false)
  })

  it('neither is eligible with no attempts at all', () => {
    const payment = makePayment({ status: 'PENDING' })
    expect(reconcileEligible(payment, [])).toBe(false)
    expect(reexecuteEligible(payment, [])).toBe(false)
  })
})
