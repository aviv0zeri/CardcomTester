import { useState } from 'react'
import {
  CheckoutControls,
  type Language,
  type Mode,
} from './components/CheckoutControls'
import { CheckoutButton } from './components/CheckoutButton'
import { PaymentOverlay } from './components/PaymentOverlay'

/**
 * Live Cardcom Low Profile tester.
 * Localhost HTML/CSS preview stays on cardcom_open. Do not touch the iframe DOM.
 */
function App() {
  const [language, setLanguage] = useState<Language>('he')
  const [mode, setMode] = useState<Mode>('redirect')
  const [overlaySrc, setOverlaySrc] = useState<string | null>(null)
  const [status, setStatus] = useState('ready')

  const handleUrl = (url: string) => {
    if (mode === 'redirect') {
      const tab = window.open(url, '_blank')
      setStatus(tab ? 'opened in a new tab' : `Popup blocked. Open: ${url}`)
      return
    }

    setOverlaySrc(url)
    setStatus('open')
  }

  return (
    <main className="app">
      <section className="start">
        <div className="cta">
          <h1>CardCom Tester</h1>
          <p className="cta-copy">Live Low Profile session. Local preview is cardcom_open.</p>

          <CheckoutControls
            language={language}
            mode={mode}
            disabled={Boolean(overlaySrc)}
            onLanguageChange={setLanguage}
            onModeChange={setMode}
          />

          <CheckoutButton
            language={language}
            disabled={Boolean(overlaySrc)}
            onUrl={handleUrl}
            onError={(message) => setStatus(message)}
          />

          <p className="status status--muted">Status: {status}</p>
        </div>
      </section>

      {overlaySrc ? (
        <PaymentOverlay src={overlaySrc} onClose={() => {
          setOverlaySrc(null)
          setStatus('ready')
        }} />
      ) : null}
    </main>
  )
}

export default App
