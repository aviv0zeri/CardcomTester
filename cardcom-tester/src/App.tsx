import { useState } from 'react'
import {
  CheckoutControls,
  type Language,
  type Mode,
} from './components/CheckoutControls'
import { CheckoutButton } from './components/CheckoutButton'
import {
  ClaudeTester,
  claudePreviewUrl,
  type ClaudeFrame,
} from './components/ClaudeTester'
import {
  UnifiedTester,
  unifiedPreviewUrl,
  type UnifiedPreset,
} from './components/UnifiedTester'
import { PaymentOverlay } from './components/PaymentOverlay'

type Overlay = {
  src: string
  width?: number
  height?: number
  scroll?: boolean
}

/**
 * Live Cardcom Low Profile tester.
 * Localhost HTML/CSS preview stays on cardcom_open. Do not touch the iframe DOM.
 */
function App() {
  const [language, setLanguage] = useState<Language>('he')
  const [mode, setMode] = useState<Mode>('redirect')
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [status, setStatus] = useState('ready')
  const overlayOpen = Boolean(overlay)

  const handleUrl = (url: string) => {
    if (mode === 'redirect') {
      const tab = window.open(url, '_blank')
      setStatus(tab ? 'opened in a new tab' : `Popup blocked. Open: ${url}`)
      return
    }

    setOverlay({ src: url })
    setStatus('open')
  }

  const handleUnifiedPreset = (preset: UnifiedPreset) => {
    setOverlay({
      src: unifiedPreviewUrl(language, preset),
      width: preset.width,
      height: preset.height,
      scroll: preset.scroll,
    })
    setStatus(`all ${preset.note}`)
  }

  const handleClaudeFrame = (frame: ClaudeFrame, hideInvoice: boolean) => {
    setOverlay({
      src: claudePreviewUrl(language, hideInvoice),
      width: frame.width,
      height: frame.height,
    })
    setStatus(
      hideInvoice
        ? `claude ${frame.label} ${frame.width}×${frame.height}, no invoice`
        : `claude ${frame.label} ${frame.width}×${frame.height}`,
    )
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
            disabled={overlayOpen}
            onLanguageChange={setLanguage}
            onModeChange={setMode}
          />

          <CheckoutButton
            language={language}
            disabled={overlayOpen}
            onUrl={handleUrl}
            onError={(message) => setStatus(message)}
          />

          <p
            className={`status${
              status === 'ready' ||
              status === 'open' ||
              status.startsWith('claude') ||
              status.startsWith('all ') ||
              status.startsWith('opened')
                ? ' status--muted'
                : ' status--error'
            }`}
          >
            Status: {status}
          </p>

          <UnifiedTester
            language={language}
            disabled={overlayOpen}
            onOpen={handleUnifiedPreset}
          />

          <ClaudeTester
            language={language}
            disabled={overlayOpen}
            onOpen={handleClaudeFrame}
          />
        </div>
      </section>

      {overlay ? (
        <PaymentOverlay
          src={overlay.src}
          width={overlay.width}
          height={overlay.height}
          scroll={overlay.scroll}
          onClose={() => {
            setOverlay(null)
            setStatus('ready')
          }}
        />
      ) : null}
    </main>
  )
}

export default App
