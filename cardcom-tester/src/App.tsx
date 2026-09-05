import { useState } from 'react'
import {
  CheckoutControls,
  deviceModeFrom,
  isNewDesign,
  isOpenFieldsDesign,
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
import { DEFAULT_PROFILE, profileById } from './components/profiles'
import { loadSfxMuted, playClick, saveSfxMuted, setSfxMuted } from './components/sfx'
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
  // Which business the tester acts as (Cardcom terminal + Spectra project +
  // brand). Picked in the walkthrough's first step; the other tabs follow it.
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE.id)
  const profile = profileById(profileId)
  const [uiLang, setUiLang] = useState<UiLang>(loadUiLang)
  const [sfxMuted, setSfxMutedState] = useState<boolean>(loadSfxMuted)
  const [design, setDesign] = useState<Design>('new')
  const [language, setLanguage] = useState<Language>('he')
  const [region, setRegion] = useState<OpenFieldsRegion>('il')
  const [device, setDevice] = useState<Device>('desktop')
  const [mode, setMode] = useState<Mode>('redirect')
  const [doubleView, setDoubleView] = useState(false)
  const [dualMode, setDualMode] = useState<'side-by-side' | 'continue'>('side-by-side')
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [deviceError, setDeviceError] = useState<DeviceError | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('ready')
  const [statusUrl, setStatusUrl] = useState<string | null>(null)
  const overlayOpen = Boolean(overlay)
  const openAs = openAsFrom(device, mode)
  const dualView = (isNewDesign(design) || isOpenFieldsDesign(design)) && doubleView
  // Two-panel chrome/theme. Only the Open Fields page honours a forced theme;
  // the Low Profile skin is light-only, so its stage stays light. Accent is
  // the business's own colour (the Design tab has no accent picker).
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  const stageTheme: 'light' | 'dark' =
    isOpenFieldsDesign(design) && prefersDark ? 'dark' : 'light'
  const stageAccent = profile.accent.replace(/^#/, '')
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
    if (isOpenFieldsDesign(next) && language !== 'he' && language !== 'en') setLanguage('he')
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
      scroll: isNewDesign(design) ? true : version.scroll,
      // The summary column follows the tester's language and business; the
      // Design tab has no amount or theme controls, so those stay default.
      summarySrc: dualView
        ? `/cardcom-preview/order-summary.html?${new URLSearchParams({ lang: language === 'en' ? 'en' : 'he', brand: profile.id, theme: stageTheme, accent: stageAccent })}`
        : undefined,
    })
    setStatusUrl(null)
    setStatus(`open ${label} · ${version.note}`)
  }

  const openLocal = (version?: PreviewVersion) => {
    if (!guardDevice()) return
    const embed = Boolean(version?.embed)
    const screen = isOpenFieldsDesign(design) && embed && dualView ? 'checkout' : undefined
    const src = localPreviewUrl(language, embed, design, { region, screen, brand: profile.id })
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
    if (isOpenFieldsDesign(design)) {
      // No session is created here -- the Open Fields page itself calls
      // LowProfile/Create when its "Continue to checkout" is pressed (or on
      // load, in the two-panel view where the tester's summary replaces the
      // page's own cart screen).
      const fields = design === 'openfields21' ? ('box' as const) : undefined
      const framed = device === 'desktop' && Boolean(version)
      if (framed && version) {
        const src = openFieldsUrl(language, {
          region,
          embed: true,
          screen: dualView ? 'checkout' : undefined,
          layout: dualView ? 'split' : undefined,
          brand: profile.id,
          fields,
          theme: stageTheme,
          accent: profile.accent,
        })
        openFrame(src, version, 'Open Fields (live)')
        return
      }
      const src = openFieldsUrl(language, { region, brand: profile.id, fields })
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
      const url = await createCardcomSession(language, profile.expressProfileId)
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
            <div className="shell-head-left">
              {/* Top-left, above the title -- not tucked into the top-right
                  controls bar where it read as an afterthought next to the tabs. */}
              <div className="shell-head-top">
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
                <button
                  type="button"
                  className="sfx-toggle"
                  aria-pressed={!sfxMuted}
                  aria-label={sfxMuted ? 'Unmute UI sounds' : 'Mute UI sounds'}
                  title={sfxMuted ? 'Unmute UI sounds' : 'Mute UI sounds'}
                  onClick={() => {
                    const next = !sfxMuted
                    if (!next) playClick()
                    setSfxMuted(next)
                    saveSfxMuted(next)
                    setSfxMutedState(next)
                  }}
                >
                  {sfxMuted ? (
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M3 8v4h3.2L11 16V4L6.2 8H3Z" fill="currentColor" />
                      <path
                        d="M13.5 7.5l4 4m0-4l-4 4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M3 8v4h3.2L11 16V4L6.2 8H3Z" fill="currentColor" />
                      <path
                        d="M13.3 7.2a3.6 3.6 0 0 1 0 5.6M15.4 5.2a6.6 6.6 0 0 1 0 9.6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                  )}
                </button>
              </div>
              <div>
                <h1>
                  Cardcom <span className="shell-title-accent">tester</span>
                </h1>
                <p className="shell-sub">Visual API laboratory</p>
              </div>
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
            <GuidedWalkthrough
              disabled={overlayOpen}
              lang={uiLang}
              profile={profile}
              onProfileChange={setProfileId}
            />
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
                dualMode={dualMode}
                onDualModeChange={setDualMode}
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
          dualMode={dualMode}
          theme={stageTheme}
          continueLabel={language === 'he' ? 'המשך לתשלום ←' : 'Continue to payment →'}
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
