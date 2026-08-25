import { useState } from 'react'

type Mode = 'redirect' | 'iframe'

type DualVersion = {
  id: string
  label: string
  src: string
  mode: Mode
}

const DUAL_HEBREW: DualVersion[] = [
  { id: 'he-dual-redirect', label: 'Redirect', src: '/cardcom-preview/', mode: 'redirect' },
  { id: 'he-dual-iframe', label: 'Iframe', src: '/cardcom-preview/iframe.html', mode: 'iframe' },
]

const DUAL_ENGLISH: DualVersion[] = [
  { id: 'en-dual-redirect', label: 'Redirect', src: '/cardcom-preview/english/', mode: 'redirect' },
  { id: 'en-dual-iframe', label: 'Iframe', src: '/cardcom-preview/english/iframe.html', mode: 'iframe' },
]

/**
 * Outer payment shell / test harness.
 * Opens iframe checkouts in an overlay. Redirect full-page buttons leave
 * this tester. Do not touch the iframe document.
 */
function App() {
  const [open, setOpen] = useState(false)
  const [frameReady, setFrameReady] = useState(false)
  const [status, setStatus] = useState('ready')
  const [src, setSrc] = useState('/cardcom-preview/')
  const [mode, setMode] = useState<Mode>('iframe')
  const [activeId, setActiveId] = useState<string | null>(null)

  const openOverlay = (version: DualVersion) => {
    setMode(version.mode)
    setSrc(version.src)
    setActiveId(version.id)
    setStatus('Loading...')
    setFrameReady(false)
    setOpen(true)
  }

  const goToPage = (href: string) => {
    window.location.assign(href)
  }

  const closeCheckout = () => {
    setOpen(false)
    setFrameReady(false)
    setActiveId(null)
    setStatus('ready')
  }

  return (
    <main className="app">
      <section className="start">
        <div className="cta">
          <h1>CardCom Tester</h1>
          <p className="cta-copy">Three ways to open the checkout.</p>

          <div className="cta-group">
            <h2>1. Redirect — full page</h2>
            <p className="cta-hint">Leaves this tester and opens the scrolling checkout.</p>
            <div className="cta-actions">
              <button className="cta-button" onClick={() => goToPage('/cardcom-preview/')}>
                Hebrew
              </button>
              <button className="cta-button" onClick={() => goToPage('/cardcom-preview/english/')}>
                English
              </button>
            </div>
          </div>

          <div className="cta-group">
            <h2>2. Iframe only</h2>
            <p className="cta-hint">The compact iframe-normal templates.</p>
            <div className="cta-actions">
              <button
                className="cta-button cta-button--secondary"
                onClick={() =>
                  openOverlay({
                    id: 'he-iframe-only',
                    label: 'Hebrew',
                    src: '/cardcom-preview/iframe-only.html',
                    mode: 'iframe',
                  })
                }
              >
                Hebrew
              </button>
              <button
                className="cta-button cta-button--secondary"
                onClick={() =>
                  openOverlay({
                    id: 'en-iframe-only',
                    label: 'English',
                    src: '/cardcom-preview/english/iframe-only.html',
                    mode: 'iframe',
                  })
                }
              >
                English
              </button>
            </div>
          </div>

          <div className="cta-group">
            <h2>3. Either — same HTML/CSS</h2>
            <p className="cta-hint">One file pair per language. Redirect or iframe.</p>
            <div className="cta-dual">
              <div>
                <h3>Hebrew</h3>
                <div className="cta-actions">
                  {DUAL_HEBREW.map((version) => (
                    <button
                      key={version.id}
                      className={version.mode === 'iframe' ? 'cta-button cta-button--secondary' : 'cta-button'}
                      onClick={() => openOverlay(version)}
                    >
                      {version.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3>English</h3>
                <div className="cta-actions">
                  {DUAL_ENGLISH.map((version) => (
                    <button
                      key={version.id}
                      className={version.mode === 'iframe' ? 'cta-button cta-button--secondary' : 'cta-button'}
                      onClick={() => openOverlay(version)}
                    >
                      {version.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="status status--muted">Status: {status}</p>
        </div>
      </section>

      {open ? (
        <div
          className={`checkout-overlay${mode === 'iframe' ? ' checkout-overlay--iframe' : ' checkout-overlay--redirect'}`}
        >
          <div
            className={`checkout-stage${mode === 'iframe' ? ' checkout-stage--iframe' : ' checkout-stage--redirect'}`}
          >
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
                title={activeId ? `CardCom ${activeId}` : 'CardCom payment'}
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
