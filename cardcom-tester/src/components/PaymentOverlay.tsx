import { useLayoutEffect, useRef, useState } from 'react'
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
  const stageRef = useRef<HTMLDivElement>(null)
  const sized = Boolean(width && height)
  const stageWidth = dual && width ? width + SUMMARY_WIDTH + 1 : width

  // Entrance: the summary column slides in from its edge, the divider draws
  // itself, and (when already visible) the payment column follows from the
  // other edge. Skipped under prefers-reduced-motion.
  useLayoutEffect(() => {
    if (!dual || !stageRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.from('.checkout-panel--summary', { x: rtl ? 40 : -40, opacity: 0, duration: 0.65, ease: 'power3.out' })
      gsap.from('.checkout-divider', { scaleY: 0, duration: 0.7, delay: 0.15, ease: 'power2.out' })
      if (dualMode === 'side-by-side') {
        gsap.from('.checkout-panel--payment', { x: rtl ? -40 : 40, opacity: 0, duration: 0.65, delay: 0.1, ease: 'power3.out' })
      } else {
        gsap.from('.checkout-panel--pending', { opacity: 0, duration: 0.6, delay: 0.3 })
      }
    }, stageRef)
    return () => ctx.revert()
    // Mount-only entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 'continue': the payment column slides in when revealed.
  useLayoutEffect(() => {
    if (!dual || dualMode !== 'continue' || !revealed || !stageRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.from('.checkout-panel--payment', { x: rtl ? -60 : 60, opacity: 0, duration: 0.6, ease: 'power3.out' })
    }, stageRef)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed])

  const paymentPanel = (
    <div className={dual ? 'checkout-panel checkout-panel--payment' : 'checkout-panel-frame'}>
      {frameReady ? null : (
        <div className="checkout-loading">
          <div className="checkout-spinner" />
          <p>Loading payment…</p>
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
        <button
          type="button"
          className="checkout-close"
          onClick={onClose}
          aria-label="Close payment"
        >
          ×
        </button>
        <div
          className={`checkout-sheet${dual ? ' checkout-sheet--dual' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Payment"
        >
          {dual ? (
            <>
              <div className="checkout-panel checkout-panel--summary">
                <div className="checkout-panel-frame">
                  {summaryReady ? null : (
                    <div className="checkout-loading">
                      <div className="checkout-spinner" />
                    </div>
                  )}
                  <iframe
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
