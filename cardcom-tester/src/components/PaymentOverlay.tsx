import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'

type DualMode = 'side-by-side' | 'continue'

type PaymentOverlayProps = {
  src: string
  onClose: () => void
  width?: number
  height?: number
  scroll?: boolean
  rtl?: boolean
  // Optional first column: your-own-app order summary beside the real
  // payment frame (Stripe-style two-column checkout). Two layouts:
  // 'side-by-side' shows both columns at once; 'continue' shows the summary
  // first and slides the payment column in on its Continue button. Set by
  // the Design tab's double view and the Guided walkthrough's desktop
  // device; every other caller omits it and gets the single frame.
  summarySrc?: string
  dualMode?: DualMode
  continueLabel?: string
  // Draw a device bezel around the sheet (the Guided walkthrough's device
  // step): a phone with a speaker slot, or a tablet. Purely visual.
  frame?: 'phone' | 'tablet'
  // Stage chrome follows the payment page's theme so the two panels read as
  // one page.
  theme?: 'light' | 'dark'
}

const SUMMARY_WIDTH = 420
const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function PaymentOverlay({
  src,
  onClose,
  width,
  height,
  scroll,
  rtl,
  summarySrc,
  dualMode = 'side-by-side',
  continueLabel = 'Continue to payment →',
  frame,
  theme,
}: PaymentOverlayProps) {
  const [frameReady, setFrameReady] = useState(false)
  const [summaryReady, setSummaryReady] = useState(false)
  const dual = Boolean(summarySrc)
  const [revealed, setRevealed] = useState(!dual || dualMode === 'side-by-side')
  // Stacked (narrow) layout: the summary collapses to a one-line bar with the
  // total, Stripe-style, and expands on tap. Label/amount come from summarySrc's
  // own query (the summary page is ours; its URL carries amount + lang).
  const [summaryOpen, setSummaryOpen] = useState(false)
  const summaryMeta = (() => {
    if (!summarySrc) return null
    try {
      const params = new URL(summarySrc, window.location.origin).searchParams
      const amount = Number(params.get('amount'))
      return { he: params.get('lang') === 'he', amount: Number.isFinite(amount) && amount > 0 ? amount : null }
    } catch {
      return null
    }
  })()
  const stageRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const paymentRef = useRef<HTMLDivElement>(null)
  const sized = Boolean(width && height)
  const stageWidth = dual && width ? width + SUMMARY_WIDTH + 1 : width

  // Each iframe's spinner/opacity gate re-arms whenever its src changes: the
  // states are one-shot booleans, so without this a second load would show a
  // blank frame with the spinner already dismissed.
  useEffect(() => setFrameReady(false), [src])
  useEffect(() => setSummaryReady(false), [summarySrc])

  // A payment frame that never fires load (a stalled third-party script, a
  // blocked request) would leave the spinner up forever with no way out; after
  // 15s offer the same URL as a plain tab. Re-armed for each src, dropped the
  // moment the frame is ready or the overlay unmounts.
  const [frameSlow, setFrameSlow] = useState(false)
  useEffect(() => {
    setFrameSlow(false)
    if (frameReady) return
    const timer = window.setTimeout(() => setFrameSlow(true), 15_000)
    return () => window.clearTimeout(timer)
  }, [src, frameReady])

  // Modal contract: focus the close button on open, trap Tab within the sheet,
  // close on Escape, and restore focus to whatever was focused before.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !stageRef.current) return
      const focusable = stageRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], iframe, input, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  // Entrance, once per overlay. gsap.context scopes selectors to the stage and
  // its revert() cleans up under React's dev double-mount; every tween clears
  // its own inline props on finish, so nothing is ever left stranded mid-way.
  // The payment column animates here only when it is visible from the start
  // (side-by-side); in 'continue' it is handled by the reveal effect below,
  // so the two never fight over the same element.
  useLayoutEffect(() => {
    if (!dual || !stageRef.current || reduceMotion()) return
    const dir = rtl ? -1 : 1
    const ctx = gsap.context(() => {
      gsap.fromTo('.checkout-panel--summary', { x: -40 * dir, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out', clearProps: 'all' })
      gsap.fromTo('.checkout-divider', { scaleY: 0 }, { scaleY: 1, duration: 0.7, delay: 0.15, ease: 'power2.out', clearProps: 'all' })
      if (dualMode === 'side-by-side') {
        gsap.fromTo('.checkout-panel--payment', { x: 40 * dir, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.6, delay: 0.1, ease: 'power3.out', clearProps: 'all' })
      }
    }, stageRef)
    return () => ctx.revert()
    // Mount-only entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 'continue': slide the payment column in when it is revealed -- but never on
  // the initial render (guarded by a ref), so it can't collide with the
  // entrance effect above. Also move focus into the newly-shown payment column,
  // otherwise the unmounted Continue button strands focus on <body>.
  const mountedRef = useRef(false)
  useLayoutEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (!dual || dualMode !== 'continue' || !revealed || !stageRef.current) return
    paymentRef.current?.focus()
    if (reduceMotion()) return
    const dir = rtl ? -1 : 1
    const ctx = gsap.context(() => {
      gsap.fromTo('.checkout-panel--payment', { x: 60 * dir, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.55, ease: 'power3.out', clearProps: 'all' })
    }, stageRef)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed])

  const paymentPanel = (
    <div
      ref={paymentRef}
      tabIndex={-1}
      className={dual ? 'checkout-panel checkout-panel--payment' : 'checkout-panel-frame'}
    >
      {frameReady ? null : (
        <div className="checkout-loading">
          <div className="checkout-spinner" />
          <p>Loading payment…</p>
          {frameSlow ? (
            <p className="checkout-loading-slow">
              Still loading…{' '}
              <a href={src} target="_blank" rel="noreferrer">
                open in a new tab
              </a>
            </p>
          ) : null}
        </div>
      )}
      <iframe
        key={src}
        className={`payment-frame${frameReady ? ' is-ready' : ''}`}
        src={src}
        title="CardCom payment"
        allow="payment"
        {...{ allowpaymentrequest: 'true' }}
        onLoad={() => setFrameReady(true)}
      />
    </div>
  )

  return (
    <div className="checkout-overlay checkout-overlay--iframe">
      <div
        ref={stageRef}
        dir={rtl ? 'rtl' : 'ltr'}
        className={`checkout-stage checkout-stage--iframe${sized ? ' checkout-stage--sized' : ''}${scroll ? ' checkout-stage--scroll' : ''}${rtl ? '' : ' checkout-stage--ltr'}${dual ? ' checkout-stage--dual' : ''}${frame ? ` checkout-stage--frame-${frame}` : ''}${theme === 'dark' ? ' checkout-stage--dark' : ''}`}
        style={
          sized
            ? {
                ['--overlay-w' as string]: `${stageWidth}px`,
                ['--overlay-h' as string]: `${height}px`,
              }
            : undefined
        }
      >
        <div
          className={`checkout-sheet${dual ? ' checkout-sheet--dual' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Payment"
        >
          {/* Inside the dialog subtree so an aria-modal reader can reach it. */}
          <button
            ref={closeRef}
            type="button"
            className="checkout-close"
            onClick={onClose}
            aria-label="Close payment"
          >
            ×
          </button>
          {dual ? (
            <>
              <div className={`checkout-panel checkout-panel--summary${summaryOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="checkout-summary-toggle"
                  aria-expanded={summaryOpen}
                  onClick={() => setSummaryOpen((value) => !value)}
                >
                  <span>{summaryMeta?.he ? 'סיכום הזמנה' : 'Order summary'}</span>
                  {summaryMeta?.amount != null ? <b dir="ltr">₪{summaryMeta.amount.toFixed(2)}</b> : null}
                  <span className="checkout-summary-chevron" aria-hidden="true">
                    ▾
                  </span>
                </button>
                <div className="checkout-panel-frame">
                  {summaryReady ? null : (
                    <div className="checkout-loading">
                      <div className="checkout-spinner" />
                    </div>
                  )}
                  <iframe
                    key={summarySrc}
                    className={`payment-frame${summaryReady ? ' is-ready' : ''}`}
                    src={summarySrc}
                    title="Order summary"
                    onLoad={() => setSummaryReady(true)}
                  />
                </div>
                {!revealed ? (
                  <button type="button" className="cta-button checkout-continue" onClick={() => setRevealed(true)}>
                    {continueLabel}
                  </button>
                ) : null}
              </div>
              <div className="checkout-divider" aria-hidden="true" />
              {revealed ? (
                paymentPanel
              ) : (
                <div className="checkout-panel checkout-panel--payment checkout-panel--pending" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="5" y="10" width="14" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </div>
              )}
            </>
          ) : (
            paymentPanel
          )}
        </div>
      </div>
    </div>
  )
}
