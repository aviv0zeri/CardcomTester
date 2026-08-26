import { useState } from 'react'

type PaymentOverlayProps = {
  src: string
  onClose: () => void
  width?: number
  height?: number
  scroll?: boolean
  rtl?: boolean
}

export function PaymentOverlay({ src, onClose, width, height, scroll, rtl }: PaymentOverlayProps) {
  const [frameReady, setFrameReady] = useState(false)
  const sized = Boolean(width && height)

  return (
    <div className="checkout-overlay checkout-overlay--iframe">
      <div
        className={`checkout-stage checkout-stage--iframe${sized ? ' checkout-stage--sized' : ''}${scroll ? ' checkout-stage--scroll' : ''}${rtl ? '' : ' checkout-stage--ltr'}`}
        style={
          sized
            ? {
                ['--overlay-w' as string]: `${width}px`,
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
        <div className="checkout-sheet" role="dialog" aria-modal="true" aria-label="Payment">
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
      </div>
    </div>
  )
}
