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
import { GuidedWalkthrough } from './components/GuidedWalkthrough'
import { VersionMenu } from './components/VersionMenu'
import { PaymentOverlay } from './components/PaymentOverlay'
import { createCardcomSession } from './components/createSession'
import { loadUiLang, saveUiLang, type UiLang } from './components/uiLang'
import {
  isRealPhone,
  localPreviewUrl,
  openFieldsUrl,
  type OpenFieldsRegion,
  type PreviewVersion,
} from './components/previewVersions'

type Overlay = {
  src: string
  width?: number
  height?: number
  scroll?: boolean
  summarySrc?: string
}

type Tab = 'guide' | 'lab' | 'design'
type DeviceError = 'needs-computer' | 'needs-phone'

// One toggle, whole platform: tab names and the Guided tab follow it today;
// the Design/API-lab body copy is still English and can join later.
const TAB_LABELS: Record<UiLang, Record<Tab, string>> = {
  en: { guide: 'Guided', design: 'Design', lab: 'API lab' },
  he: { guide: 'מודרך', design: 'עיצוב', lab: 'מעבדת API' },
}

function App() {
  const [tab, setTab] = useState<Tab>('guide')
  const [uiLang, setUiLang] = useState<UiLang>(loadUiLang)
  const [design, setDesign] = useState<Design>('new')
  const [language, setLanguage] = useState<Language>('he')
  const [region, setRegion] = useState<OpenFieldsRegion>('il')
  const [device, setDevice] = useState<Device>('desktop')
  const [mode, setMode] = useState<Mode>('redirect')
  const [doubleView, setDoubleView] = useState(false)
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

  const handleDesignChange = (next: Design) => {
    setDesign(next)
    // Open Fields' credits iframe only speaks he/en (Cardcom's own limit).
    if (next === 'openfields' && language !== 'he' && language !== 'en') setLanguage('he')
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
      summarySrc: design === 'new' && doubleView ? '/cardcom-preview/order-summary.html' : undefined,
    })
    setStatusUrl(null)
    setStatus(`open ${label} · ${version.note}`)
  }

  const openLocal = (version?: PreviewVersion) => {
    if (!guardDevice()) return
    const embed = Boolean(version?.embed)
    const src = localPreviewUrl(language, embed, design, region)
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
    if (design === 'openfields') {
      // No session is created here -- the Open Fields page itself calls
      // LowProfile/Create when its "Continue to checkout" is pressed.
      const src = openFieldsUrl(language, { region })
      const tabWindow = window.open(src, '_blank', 'noopener,noreferrer')
      setStatusUrl(tabWindow ? null : src)
      setStatus(tabWindow ? 'opened Open Fields (live) in a new tab' : 'Popup blocked. Open the live page:')
      return
    }
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
        <div className="page-bar">
          <div className="seg seg--small" role="radiogroup" aria-label="Interface language">
            {(['en', 'he'] as UiLang[]).map((option) => (
              <button
                key={option}
                type="button"
                className={`seg-btn${uiLang === option ? ' is-on' : ''}`}
                onClick={() => {
                  setUiLang(option)
                  saveUiLang(option)
                }}
              >
                {option === 'en' ? 'English' : 'עברית'}
              </button>
            ))}
          </div>
        </div>
        <div className="shell">
          <header className="shell-head">
            <div>
              <h1>
                Cardcom <span className="shell-title-accent">tester</span>
              </h1>
              <p className="shell-sub">Visual API laboratory</p>
            </div>
            <div className="shell-head-controls">
              <div className="seg" role="tablist" aria-label="Tester">
                {(['guide', 'design', 'lab'] as Tab[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    className={`seg-btn${tab === option ? ' is-on' : ''}`}
                    aria-selected={tab === option}
                    onClick={() => setTab(option)}
                  >
                    {TAB_LABELS[uiLang][option]}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {tab === 'guide' ? (
            <GuidedWalkthrough disabled={overlayOpen} lang={uiLang} />
          ) : tab === 'lab' ? (
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
                region={region}
                openAs={openAs}
                disabled={overlayOpen || busy}
                onDesignChange={handleDesignChange}
                onLanguageChange={setLanguage}
                onRegionChange={setRegion}
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
                doubleView={doubleView}
                onDoubleViewChange={setDoubleView}
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
          summarySrc={overlay.summarySrc}
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
