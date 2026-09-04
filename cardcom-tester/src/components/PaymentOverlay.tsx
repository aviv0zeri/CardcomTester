import { useState } from 'react'

type PaymentOverlayProps = {
  src: string
  onClose: () => void
  width?: number
  height?: number
  scroll?: boolean
  rtl?: boolean
  // Optional second panel: your-own-app's order summary shown alongside the
  // real payment iframe, gated behind its own "Continue" step so the summary
  // is seen first, then the payment panel appears next to it -- not instead
  // of it. Only ever set by the Design tab's "double view" checkbox; every
  // other caller (including the Guided walkthrough) omits it and gets the
  // single-panel behavior unchanged.
  summarySrc?: string
  summaryLabel?: string
  continueLabel?: string
}

const SUMMARY_WIDTH = 340
const SUMMARY_GAP = 18

export function PaymentOverlay({
  src,
  onClose,
  width,
  height,
  scroll,
  rtl,
  summarySrc,
  summaryLabel = "Your app's screen",
  continueLabel = 'Continue to payment →',
}: PaymentOverlayProps) {
  const [frameReady, setFrameReady] = useState(false)
  const [summaryReady, setSummaryReady] = useState(false)
  const [revealed, setRevealed] = useState(!summarySrc)
  const sized = Boolean(width && height)
  const dual = Boolean(summarySrc)
  const stageWidth = dual && width ? width + SUMMARY_WIDTH + SUMMARY_GAP : width

  return (
    <div className="checkout-overlay checkout-overlay--iframe">
      <div
        className={`checkout-stage checkout-stage--iframe${sized ? ' checkout-stage--sized' : ''}${scroll ? ' checkout-stage--scroll' : ''}${rtl ? '' : ' checkout-stage--ltr'}${dual ? ' checkout-stage--dual' : ''}`}
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
            <div className="checkout-panel checkout-panel--summary">
              <p className="checkout-panel-label">{summaryLabel}</p>
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
                <button type="button" className="cta-button" onClick={() => setRevealed(true)}>
                  {continueLabel}
                </button>
              ) : null}
            </div>
          ) : null}

          {revealed ? (
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
          ) : null}
        </div>
      </div>
    </div>
  )
}
