import { useState } from 'react'

type PaymentOverlayProps = {
  src: string
  onClose: () => void
}

export function PaymentOverlay({ src, onClose }: PaymentOverlayProps) {
  const [frameReady, setFrameReady] = useState(false)

  return (
    <div className="checkout-overlay checkout-overlay--iframe">
      <div className="checkout-stage checkout-stage--iframe">
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
            allowPaymentRequest
            onLoad={() => setFrameReady(true)}
          />
        </div>
      </div>
    </div>
  )
}
