import { useState } from 'react'
import {
  CheckoutControls,
  deviceModeFrom,
  openAsFrom,
  type Design,
  type Device,
  type Language,
  type Mode,
} from './components/CheckoutControls'
import { ApiLab } from './components/ApiLab'
import { VersionMenu } from './components/VersionMenu'
import { PaymentOverlay } from './components/PaymentOverlay'
import { createCardcomSession } from './components/createSession'
import { isRealPhone, localPreviewUrl, type PreviewVersion } from './components/previewVersions'

type Overlay = {
  src: string
  width?: number
  height?: number
  scroll?: boolean
}

type Tab = 'lab' | 'design'
type DeviceError = 'needs-computer' | 'needs-phone'

function App() {
  const [tab, setTab] = useState<Tab>('lab')
  const [design, setDesign] = useState<Design>('new')
  const [language, setLanguage] = useState<Language>('he')
  const [device, setDevice] = useState<Device>('desktop')
  const [mode, setMode] = useState<Mode>('redirect')
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [deviceError, setDeviceError] = useState<DeviceError | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('ready')
  const [statusUrl, setStatusUrl] = useState<string | null>(null)
  const overlayOpen = Boolean(overlay)
  const openAs = openAsFrom(device, mode)
  const statusOk =
    status === 'ready' ||
    status === 'creating session…' ||
    status.startsWith('opened') ||
    status.startsWith('open ') ||
    Boolean(statusUrl)

  const handleOpenAs = (next: ReturnType<typeof openAsFrom>) => {
    const mapped = deviceModeFrom(next)
    setDevice(mapped.device)
    setMode(mapped.mode)
  }

  const guardDevice = (): boolean => {
    const phone = isRealPhone()
    if (device === 'mobile' && !phone) {
      setDeviceError('needs-phone')
      return false
    }
    if (device === 'desktop' && phone) {
      setDeviceError('needs-computer')
      return false
    }
    return true
  }

  const openFrame = (src: string, version: PreviewVersion, label: string) => {
    setOverlay({
      src,
      width: version.width,
      height: version.height,
      scroll: design === 'new' ? true : version.scroll,
    })
    setStatusUrl(null)
    setStatus(`open ${label} · ${version.note}`)
  }

  const openLocal = (version?: PreviewVersion) => {
    if (!guardDevice()) return
    const embed = Boolean(version?.embed)
    const src = localPreviewUrl(language, embed, design)
    // The guard above already confirmed device matches reality, so on mobile
    // this is a real phone — show the real page, not a scaled-down box.
    // Boxing is only useful as a desktop-side simulation of the Iframe mode.
    const realTab = device === 'mobile' || !version
    if (!realTab && version) {
      openFrame(src, version, 'local')
      return
    }
    const tabWindow = window.open(src, '_blank', 'noopener,noreferrer')
    setStatusUrl(tabWindow ? null : src)
    setStatus(tabWindow ? 'opened local in a new tab' : 'Popup blocked. Open the local preview:')
  }

  const openCardcom = async (version?: PreviewVersion) => {
    if (busy) return
    if (!guardDevice()) return
    const realTab = device === 'mobile' || !version
    if (realTab) version = undefined
    const tabWindow = version ? null : window.open('', '_blank')
    setBusy(true)
    setStatus('creating session…')
    setStatusUrl(null)
    try {
      const url = await createCardcomSession(language)
      if (version) {
        openFrame(url, version, 'cardcom')
      } else if (tabWindow && !tabWindow.closed) {
        tabWindow.location.href = url
        setStatus('opened Cardcom in a new tab')
      } else {
        tabWindow?.close()
        setStatusUrl(url)
        setStatus('Popup blocked. Open the Cardcom session:')
      }
    } catch (error) {
      tabWindow?.close()
      setStatus(error instanceof Error ? error.message : 'request failed')
    }
    setBusy(false)
  }

  return (
    <main className="app">
      <section className="start">
        <div className="shell">
          <header className="shell-head">
            <div>
              <h1>
                Cardcom <span className="shell-title-accent">tester</span>
              </h1>
              <p className="shell-sub">Visual API laboratory</p>
            </div>
            <div className="seg" role="tablist" aria-label="Tester">
              <button
                type="button"
                role="tab"
                className={`seg-btn${tab === 'design' ? ' is-on' : ''}`}
                aria-selected={tab === 'design'}
                onClick={() => setTab('design')}
              >
                Design
              </button>
              <button
                type="button"
                role="tab"
                className={`seg-btn${tab === 'lab' ? ' is-on' : ''}`}
                aria-selected={tab === 'lab'}
                onClick={() => setTab('lab')}
              >
                API lab
              </button>
            </div>
          </header>

          {tab === 'lab' ? (
            <ApiLab disabled={overlayOpen} />
          ) : (
            <div className="design-pane">
              <p className="cta-copy">
                How the hosted checkout looks. Preview is our HTML/CSS. Live Cardcom is a real
                session in that same frame or tab.
              </p>
              <CheckoutControls
                design={design}
                language={language}
                openAs={openAs}
                disabled={overlayOpen || busy}
                onDesignChange={setDesign}
                onLanguageChange={setLanguage}
                onOpenAsChange={handleOpenAs}
              />
              <VersionMenu
                key={`${design}-${device}-${mode}`}
                design={design}
                language={language}
                device={device}
                mode={mode}
                busy={busy}
                disabled={overlayOpen}
                onLocal={openLocal}
                onCardcom={(version) => void openCardcom(version)}
              />
              <p className={`status${statusOk ? ' status--muted' : ' status--error'}`}>
                {status}
                {statusUrl ? (
                  <>
                    {' '}
                    <a href={statusUrl} target="_blank" rel="noopener noreferrer">
                      Open link
                    </a>
                  </>
                ) : null}
              </p>
              <p className="shell-foot">
                <a
                  href="/cardcom-preview/open.html?v=competition-template"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Competition template
                </a>
                {' · '}
                <a href="https://cardcom-tester.vercel.app" target="_blank" rel="noreferrer">
                  cardcom-tester.vercel.app
                </a>
              </p>
            </div>
          )}
        </div>
      </section>

      {deviceError ? (
        <div className="device-modal" role="alertdialog" aria-modal="true" aria-label="Wrong device">
          <div className="device-modal-card">
            <p className="device-modal-title">
              {deviceError === 'needs-phone' ? 'Try this on a phone' : 'Try this on a computer'}
            </p>
            <p className="device-modal-text">
              {deviceError === 'needs-phone'
                ? 'Phone mode tests the real mobile experience — open cardcom-tester.vercel.app on your phone. On a computer, use Page or Iframe.'
                : 'Page and Iframe are desktop modes — open this tester on a computer. On your phone, use Phone mode.'}
            </p>
            <button type="button" className="cta-button" onClick={() => setDeviceError(null)}>
              Got it
            </button>
          </div>
        </div>
      ) : null}

      {overlay ? (
        <PaymentOverlay
          src={overlay.src}
          width={overlay.width}
          height={overlay.height}
          scroll={overlay.scroll}
          rtl={language === 'he' || language === 'ar'}
          onClose={() => {
            setOverlay(null)
            setStatusUrl(null)
            setStatus('ready')
          }}
        />
      ) : null}
    </main>
  )
}

export default App
