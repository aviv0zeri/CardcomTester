import { useState } from 'react'

const CHECKOUT_SRC = {
  he: {
    redirect: '/cardcom-preview/',
    iframe: '/cardcom-preview/iframe.html',
  },
  en: {
    redirect: '/cardcom-preview/english/',
    iframe: '/cardcom-preview/english/iframe.html',
  },
} as const

type Lang = keyof typeof CHECKOUT_SRC
type Mode = 'redirect' | 'iframe'

/**
 * Outer payment shell / test harness.
 * Opens the checkout in an overlay iframe. Do not touch the iframe document.
 */
function App() {
  const [open, setOpen] = useState(false)
  const [frameReady, setFrameReady] = useState(false)
  const [status, setStatus] = useState('ready')
  const [src, setSrc] = useState(CHECKOUT_SRC.he.redirect)
  const [mode, setMode] = useState<Mode>('redirect')

  const openCheckout = (lang: Lang, nextMode: Mode) => {
    setMode(nextMode)
    setSrc(CHECKOUT_SRC[lang][nextMode])
    setStatus('Loading...')
    setFrameReady(false)
    setOpen(true)
  }

  const closeCheckout = () => {
    setOpen(false)
    setFrameReady(false)
    setStatus('ready')
  }

  return (
    <main className="app">
      <section className="start">
        <div className="cta">
          <h1>CardCom Tester</h1>
          <p className="cta-copy">
            Redirect = full scrolling checkout. Iframe = the same HTML/CSS,
            compact, in a larger frame.
          </p>
          <div className="cta-actions">
            <button className="cta-button" onClick={() => openCheckout('he', 'redirect')}>
              Hebrew redirect
            </button>
            <button className="cta-button" onClick={() => openCheckout('en', 'redirect')}>
              English redirect
            </button>
            <button className="cta-button cta-button--secondary" onClick={() => openCheckout('he', 'iframe')}>
              Hebrew iframe
            </button>
            <button className="cta-button cta-button--secondary" onClick={() => openCheckout('en', 'iframe')}>
              English iframe
            </button>
          </div>
          <p className="status status--muted">Status: {status}</p>
        </div>
      </section>

      {open ? (
        <div className="checkout-overlay">
          <div className={`checkout-stage${mode === 'iframe' ? ' checkout-stage--iframe' : ''}`}>
            <button
              type="button"
              className="checkout-close"
              onClick={closeCheckout}
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
                onLoad={() => {
                  setFrameReady(true)
                  setStatus('open')
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default App
